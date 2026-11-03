<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Tutor\TutorFlows;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class TutorFlowsTest extends TestCase
{
    private const URL = '/api/tutor/flows';

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        // Apply only this migration: no application data or users table is needed.
        (require database_path('migrations/2026_10_28_000001_create_tutor_flows.php'))->up();

    }

    private function actor(bool $admin = true): User
    {
        $user = \Mockery::mock(User::class)->makePartial();
        $user->forceFill(['id' => 101, 'name' => 'Flow administrator', 'email' => 'flow@example.test']);
        $user->shouldReceive('isFrontendAdmin')->andReturn($admin);

        return $user;
    }

    private function graph(): array
    {
        $nodes = [
            ['id' => 'message', 'type' => 'event', 'data' => ['event' => 'user.message']],
            ['id' => 'audio', 'type' => 'event', 'data' => ['event' => 'user.audio']],
            ['id' => 'result', 'type' => 'event', 'data' => ['event' => 'tool.result']],
            ['id' => 'context', 'type' => 'context', 'data' => (object) []],
            ['id' => 'model', 'type' => 'model', 'data' => ['model' => 'preset', 'reasoning' => 'preset', 'maxOutputTokens' => 8192]],
            ['id' => 'tools', 'type' => 'tools', 'data' => ['allCommands' => true, 'allowedCommands' => [], 'maxSteps' => 6]],
            ['id' => 'reply', 'type' => 'reply', 'data' => (object) []],
            ['id' => 'speech', 'type' => 'speech', 'data' => ['enabled' => true]],
        ];
        foreach ($nodes as $index => &$node) {
            $node['position'] = ['x' => $index * 100, 'y' => 0];
        }
        $pairs = [['message', 'context'], ['audio', 'context'], ['result', 'context'],
            ['context', 'model'], ['model', 'tools'], ['tools', 'reply'], ['reply', 'speech']];
        $edges = [];
        foreach ($pairs as $index => [$source, $target]) {
            $edges[] = ['id' => 'e'.$index, 'source' => $source, 'target' => $target, 'sourceHandle' => 'out', 'targetHandle' => 'in'];
        }

        return ['version' => 2, 'name' => 'Учебный поток', 'nodes' => $nodes, 'edges' => $edges];
    }

    private function saveGraph(?int $head = null, ?array $graph = null)
    {
        return $this->postJson(self::URL, ['expected_head_version_id' => $head, 'graph' => $graph ?? $this->graph()]);
    }

    public function test_migration_is_independent_and_reversible_on_a_fresh_database(): void
    {
        $this->assertFalse(Schema::hasTable('users'));
        $this->assertDatabaseCount('tutor_flow_state', 1);
        $this->assertDatabaseHas('tutor_flow_state', ['id' => 1, 'head_version_id' => null, 'active_version_id' => null]);
        $migration = require database_path('migrations/2026_10_28_000001_create_tutor_flows.php');
        $migration->down();
        $this->assertFalse(Schema::hasTable('tutor_flow_versions'));
        $this->assertFalse(Schema::hasTable('tutor_flow_state'));
        $migration->up();
        $this->assertNull(app(TutorFlows::class)->active());
    }

    public function test_all_endpoints_deny_guests_and_non_admins_even_with_forged_flags(): void
    {
        $calls = [['GET', self::URL], ['POST', self::URL], ['GET', self::URL.'/1'],
            ['POST', self::URL.'/1/activate'], ['POST', self::URL.'/deactivate']];
        foreach ($calls as [$method, $url]) {
            $this->json($method, $url, ['is_admin' => true])->assertUnauthorized();
        }
        $this->actingAs($this->actor(false));
        foreach ($calls as [$method, $url]) {
            $this->json($method, $url, ['is_admin' => true])->assertForbidden();
        }
        $this->assertDatabaseCount('tutor_flow_versions', 0);
    }

    public function test_defaults_and_catalog_are_valid_without_reading_application_tables(): void
    {
        $flows = app(TutorFlows::class);
        $this->assertEqualsCanonicalizing(['event', 'source', 'prompt', 'condition', 'compact', 'context', 'serialize', 'mcp', 'model', 'tools', 'reply', 'speech'], array_keys($flows->catalog()));
        $this->assertSame(2, $flows->defaultGraph()['version']);
        $this->actingAs($this->actor())->getJson(self::URL)->assertOk()
            ->assertJsonPath('data.versions', [])->assertJsonPath('data.head_version_id', null)
            ->assertJsonPath('data.active_version_id', null)->assertJsonPath('data.default_graph.version', 2);
        $this->assertNull($flows->active());
    }

    public function test_save_is_immutable_and_does_not_activate_and_empty_settings_remain_objects(): void
    {
        $this->actingAs($this->actor());
        $response = $this->saveGraph()->assertCreated()->assertJsonPath('data.active_version_id', null)
            ->assertJsonPath('data.version.created_by', 101)->assertJsonPath('data.version.name', 'Учебный поток');
        $first = $response->json('data.version.id');
        $response->assertJsonPath('data.head_version_id', $first);
        $this->assertMatchesRegularExpression('/T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/', $response->json('data.version.created_at'));
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $objects = json_decode($response->getContent());
        $this->assertInstanceOf(\stdClass::class, $objects->data->version->graph->nodes[3]->data);
        $this->assertInstanceOf(\stdClass::class, $objects->data->version->graph->nodes[6]->data);
        $snapshot = DB::table('tutor_flow_versions')->where('id', $first)->first();
        $graph = $this->graph();
        $graph['name'] = 'Новая редакция';
        $second = $this->saveGraph($first, $graph)->assertCreated()->json('data.version.id');
        $this->getJson(self::URL.'/'.$first)->assertOk()->assertJsonPath('data.graph.name', 'Учебный поток');
        $this->assertEquals($snapshot, DB::table('tutor_flow_versions')->where('id', $first)->first());
        $this->getJson(self::URL)->assertOk()->assertJsonPath('data.versions.0.id', $second)->assertJsonPath('data.versions.1.id', $first);
        $this->assertNull(app(TutorFlows::class)->active());
    }

    public function test_stale_saves_conflict_without_creating_versions_or_changing_active(): void
    {
        $this->actingAs($this->actor());
        $first = $this->saveGraph()->assertCreated()->json('data.version.id');
        $this->postJson(self::URL.'/'.$first.'/activate', ['expected_active_version_id' => null])->assertOk();
        $this->saveGraph()->assertConflict();
        $second = $this->saveGraph($first)->assertCreated()->json('data.version.id');
        $this->saveGraph($first)->assertConflict();
        $this->assertDatabaseCount('tutor_flow_versions', 2);
        $this->assertDatabaseHas('tutor_flow_state', ['id' => 1, 'head_version_id' => $second, 'active_version_id' => $first]);
    }

    public function test_engine_round_trips_in_immutable_versions_and_legacy_remains_native_without_automatic_activation(): void
    {
        $this->actingAs($this->actor());
        $legacy = $this->saveGraph()->assertCreated()->json('data.version.id');
        $this->postJson(self::URL.'/'.$legacy.'/activate', ['expected_active_version_id' => null])->assertOk();
        $legacyGraph = $this->getJson(self::URL.'/'.$legacy)->assertOk()->json('data.graph');
        $this->assertArrayNotHasKey('engine', $legacyGraph);
        $this->assertSame('native', app(TutorFlows::class)->active()['graph']['engine'] ?? 'native');

        $graph = $this->graph();
        $graph['engine'] = 'langgraph';
        $langgraph = $this->saveGraph($legacy, $graph)->assertCreated()
            ->assertJsonPath('data.version.graph.engine', 'langgraph')->assertJsonPath('data.active_version_id', $legacy)
            ->json('data.version.id');
        $graph['engine'] = 'native';
        $native = $this->saveGraph($langgraph, $graph)->assertCreated()
            ->assertJsonPath('data.version.graph.engine', 'native')->assertJsonPath('data.active_version_id', $legacy)
            ->json('data.version.id');
        $this->getJson(self::URL.'/'.$langgraph)->assertOk()->assertJsonPath('data.graph.engine', 'langgraph');
        $this->postJson(self::URL.'/'.$langgraph.'/activate', ['expected_active_version_id' => $legacy])->assertOk();
        $this->assertSame('langgraph', app(TutorFlows::class)->active()['graph']['engine']);
        $this->postJson(self::URL.'/'.$legacy.'/activate', ['expected_active_version_id' => $langgraph])->assertOk();
        $this->assertSame('native', app(TutorFlows::class)->active()['graph']['engine'] ?? 'native');
        $this->getJson(self::URL.'/'.$native)->assertOk()->assertJsonPath('data.graph.engine', 'native');
        $this->assertArrayNotHasKey('engine', $this->getJson(self::URL.'/'.$legacy)->assertOk()->json('data.graph'));
        $this->assertDatabaseCount('tutor_flow_versions', 3);
    }

    public function test_activate_rollback_and_deactivate_preserve_head_and_snapshots(): void
    {
        $this->actingAs($this->actor());
        $first = $this->saveGraph()->assertCreated()->json('data.version.id');
        $graph = $this->graph();
        $graph['name'] = 'Второй';
        $second = $this->saveGraph($first, $graph)->assertCreated()->json('data.version.id');
        $this->postJson(self::URL.'/'.$second.'/activate', ['expected_active_version_id' => null])
            ->assertOk()->assertJsonPath('data.head_version_id', $second)->assertJsonPath('data.active_version_id', $second);
        $this->assertSame('Второй', app(TutorFlows::class)->active()['graph']['name']);
        $this->postJson(self::URL.'/'.$first.'/activate', ['expected_active_version_id' => null])->assertConflict();
        $this->postJson(self::URL.'/deactivate', ['expected_active_version_id' => $first])->assertConflict();
        $this->assertSame($second, app(TutorFlows::class)->active()['version_id']);
        $this->postJson(self::URL.'/'.$first.'/activate', ['expected_active_version_id' => $second])
            ->assertOk()->assertJsonPath('data.head_version_id', $second)->assertJsonPath('data.active_version_id', $first);
        $this->assertSame('Учебный поток', app(TutorFlows::class)->active()['graph']['name']);
        $this->postJson(self::URL.'/deactivate', ['expected_active_version_id' => $first])
            ->assertOk()->assertJsonPath('data.head_version_id', $second)->assertJsonPath('data.active_version_id', null);
        $this->assertNull(app(TutorFlows::class)->active());
        $this->assertDatabaseCount('tutor_flow_versions', 2);
        $this->getJson(self::URL.'/9999')->assertNotFound();
        $this->postJson(self::URL.'/9999/activate', ['expected_active_version_id' => null])->assertNotFound();
        $this->assertNull(app(TutorFlows::class)->active());
    }

    public function test_expected_versions_must_be_explicit_null_or_positive_json_integers(): void
    {
        $this->actingAs($this->actor());
        $this->postJson(self::URL, ['graph' => $this->graph()])->assertUnprocessable()->assertJsonValidationErrors('expected_head_version_id');
        foreach (['', '1', 0, -1, true, 1.5, [], (object) []] as $value) {
            $this->postJson(self::URL, ['graph' => $this->graph(), 'expected_head_version_id' => $value])->assertUnprocessable();
            $this->postJson(self::URL.'/1/activate', ['expected_active_version_id' => $value])->assertUnprocessable();
            $this->postJson(self::URL.'/deactivate', ['expected_active_version_id' => $value])->assertUnprocessable();
        }
        $this->postJson(self::URL.'/1/activate')->assertUnprocessable();
        $this->postJson(self::URL.'/deactivate')->assertUnprocessable();
        $this->assertDatabaseCount('tutor_flow_versions', 0);
    }

    public static function invalidSettings(): iterable
    {
        yield 'schema version' => ['version', 1];
        yield 'engine enum' => ['engine', 'python'];
        yield 'removed engine' => ['engine', 'langflow'];
        yield 'engine blank' => ['engine', ''];
        yield 'engine null' => ['engine', null];
        yield 'engine boolean' => ['engine', true];
        yield 'engine number' => ['engine', 1];
        yield 'engine object' => ['engine', ['type' => 'langgraph']];
        yield 'blank name' => ['name', '  '];
        yield 'long name' => ['name', str_repeat('n', 121)];
        yield 'unknown graph credential' => ['apiKey', 'fake-not-a-secret'];
        yield 'unknown type' => ['nodes.4.type', 'javascript'];
        yield 'duplicate node' => ['nodes.1.id', 'message'];
        yield 'node URL' => ['nodes.4.url', 'https://example.test'];
        yield 'node identifier' => ['nodes.4.id', '<script>'];
        yield 'position type' => ['nodes.4.position.x', '12'];
        yield 'position bound' => ['nodes.4.position.y', 100001];
        yield 'position extra key' => ['nodes.4.position.z', 1];
        yield 'event enum' => ['nodes.0.data.event', 'arbitrary.event'];
        yield 'duplicate main event' => ['nodes.1.data.event', 'user.message'];
        yield 'data credential' => ['nodes.4.data.apiKey', 'fake-not-a-secret'];
        yield 'data URL' => ['nodes.4.data.baseUrl', 'https://example.test'];
        yield 'data JS' => ['nodes.4.data.javascript', 'return 1'];
        yield 'model outside catalog' => ['nodes.4.data.model', 'gpt-made-up'];
        yield 'model URL' => ['nodes.4.data.model', 'https://example.test'];
        yield 'reasoning enum' => ['nodes.4.data.reasoning', 'unlimited'];
        yield 'token lower bound' => ['nodes.4.data.maxOutputTokens', 699];
        yield 'token upper bound' => ['nodes.4.data.maxOutputTokens', 8193];
        yield 'strict token integer' => ['nodes.4.data.maxOutputTokens', '700'];
        yield 'strict tools boolean' => ['nodes.5.data.allCommands', 1];
        yield 'too many commands' => ['nodes.5.data.allowedCommands', array_fill(0, 31, 'commands.list')];
        yield 'command URL' => ['nodes.5.data.allowedCommands', ['https://example.test']];
        yield 'command JS' => ['nodes.5.data.allowedCommands', ['eval()']];
        yield 'step lower bound' => ['nodes.5.data.maxSteps', 0];
        yield 'step upper bound' => ['nodes.5.data.maxSteps', 7];
        yield 'strict speech boolean' => ['nodes.7.data.enabled', 'true'];
        yield 'immutable safety setting' => ['nodes.3.data.baseRules', 'override'];
        yield 'data must be object' => ['nodes.3.data', []];
        yield 'duplicate edge ID' => ['edges.1.id', 'e0'];
        yield 'unknown target' => ['edges.0.target', 'missing'];
        yield 'unknown edge key' => ['edges.0.code', 'return 1'];
        yield 'source port' => ['edges.0.sourceHandle', 'true'];
        yield 'target port' => ['edges.0.targetHandle', 'wrong'];
        yield 'wrong ports' => ['edges.4.target', 'reply'];
        yield 'self edge' => ['edges.0.target', 'message'];
    }

    #[DataProvider('invalidSettings')]
    public function test_invalid_settings_are_rejected_without_writes(string $path, mixed $value): void
    {
        $graph = $this->graph();
        data_set($graph, $path, $value);
        $this->actingAs($this->actor());
        $this->saveGraph(graph: $graph)->assertUnprocessable()->assertJsonStructure(['errors']);
        $this->assertDatabaseCount('tutor_flow_versions', 0);
        $this->assertDatabaseHas('tutor_flow_state', ['id' => 1, 'head_version_id' => null, 'active_version_id' => null]);
    }

    private function withBranch(): array
    {
        $graph = $this->graph();
        $graph['nodes'][] = ['id' => 'condition', 'type' => 'condition', 'position' => ['x' => 0, 'y' => 300],
            'data' => ['field' => 'transcript', 'operator' => 'contains', 'value' => 'lesson']];
        $graph['nodes'][] = ['id' => 'source', 'type' => 'source', 'position' => ['x' => 100, 'y' => 300],
            'data' => ['source' => 'lesson_context', 'limitChars' => 100]];
        $graph['nodes'][] = ['id' => 'prompt', 'type' => 'prompt', 'position' => ['x' => 200, 'y' => 300], 'data' => ['text' => '']];
        foreach ([['message', 'condition', 'out'], ['condition', 'source', 'true'], ['condition', 'prompt', 'false'], ['source', 'context', 'out'], ['prompt', 'context', 'out']] as $index => [$source, $target, $handle]) {
            $graph['edges'][] = ['id' => 'branch'.$index, 'source' => $source, 'target' => $target, 'sourceHandle' => $handle];
        }

        return $graph;
    }

    public function test_condition_ports_source_prompt_and_optional_handles_are_accepted(): void
    {
        $graph = $this->withBranch();
        unset($graph['edges'][0]['sourceHandle'], $graph['edges'][0]['targetHandle']);
        $this->actingAs($this->actor());
        $this->saveGraph(graph: $graph)->assertCreated()->assertJsonPath('data.version.graph.nodes.10.data.text', '');
    }

    public function test_cycles_are_rejected_even_when_ports_are_compatible_and_sink_is_reachable(): void
    {
        $graph = $this->withBranch();
        $graph['nodes'][] = ['id' => 'other', 'type' => 'condition', 'position' => ['x' => 0, 'y' => 500],
            'data' => ['field' => 'current_page', 'operator' => 'equals', 'value' => '/course']];
        $graph['edges'][] = ['id' => 'cycle1', 'source' => 'condition', 'target' => 'other', 'sourceHandle' => 'true'];
        $graph['edges'][] = ['id' => 'cycle2', 'source' => 'other', 'target' => 'condition', 'sourceHandle' => 'false'];
        $this->actingAs($this->actor());
        $this->saveGraph(graph: $graph)->assertUnprocessable()->assertJsonValidationErrors('graph.edges');
        $this->assertDatabaseCount('tutor_flow_versions', 0);
    }

    public function test_orphans_disconnected_events_duplicate_links_and_missing_required_tools_are_rejected(): void
    {
        $this->actingAs($this->actor());
        $graph = $this->withBranch();
        array_splice($graph['edges'], 7, 1); // condition has outgoing edges but no incoming edge
        $this->saveGraph(graph: $graph)->assertUnprocessable();
        $graph = $this->graph();
        array_shift($graph['edges']); // message event cannot reach model/reply
        $this->saveGraph(graph: $graph)->assertUnprocessable();
        $graph = $this->graph();
        $graph['edges'][] = array_replace($graph['edges'][0], ['id' => 'duplicate']);
        $this->saveGraph(graph: $graph)->assertUnprocessable();
        $graph = $this->graph();
        array_splice($graph['nodes'], 5, 1);
        $this->saveGraph(graph: $graph)->assertUnprocessable();
        $graph = $this->graph();
        $graph['nodes'][] = array_replace($graph['nodes'][5], ['id' => 'second_tools']);
        $this->saveGraph(graph: $graph)->assertUnprocessable();
        $graph = $this->withBranch();
        $graph['edges'][8]['sourceHandle'] = 'out';
        $this->saveGraph(graph: $graph)->assertUnprocessable();
        $this->assertDatabaseCount('tutor_flow_versions', 0);
    }

    public function test_source_prompt_condition_limits_and_finite_coordinates_are_enforced(): void
    {
        $this->actingAs($this->actor());
        foreach ([['nodes.8.data.value', ''], ['nodes.8.data.value', str_repeat('v', 301)],
            ['nodes.8.data.field', 'token'], ['nodes.8.data.operator', 'eval'],
            ['nodes.9.data.source', 'remote_url'], ['nodes.9.data.limitChars', 99],
            ['nodes.9.data.limitChars', 24001], ['nodes.10.data.text', str_repeat('p', 12001)]] as [$path, $value]) {
            $graph = $this->withBranch();
            data_set($graph, $path, $value);
            $this->saveGraph(graph: $graph)->assertUnprocessable();
        }
        foreach ([INF, -INF, NAN] as $number) {
            $graph = $this->graph();
            $graph['nodes'][0]['position']['x'] = $number;
            try {
                app(TutorFlows::class)->save($graph, null, 101);
                $this->fail('Nonfinite coordinates were accepted.');
            } catch (\Illuminate\Validation\ValidationException $error) {
                $this->assertArrayHasKey('graph', $error->errors());
            }
        }
        $this->assertDatabaseCount('tutor_flow_versions', 0);
    }

    public function test_node_edge_and_utf8_byte_limits_apply_before_persistence(): void
    {
        $this->actingAs($this->actor());
        $graph = $this->graph();
        $graph['nodes'] = array_fill(0, 65, $graph['nodes'][0]);
        $this->saveGraph(graph: $graph)->assertUnprocessable()->assertJsonValidationErrors('graph.nodes');
        $graph = $this->graph();
        $graph['edges'] = array_fill(0, 129, $graph['edges'][0]);
        $this->saveGraph(graph: $graph)->assertUnprocessable()->assertJsonValidationErrors('graph.edges');
        $graph = $this->graph();
        for ($i = 0; $i < 6; $i++) {
            $graph['nodes'][] = ['id' => 'prompt'.$i, 'type' => 'prompt', 'position' => ['x' => 0, 'y' => 0], 'data' => ['text' => str_repeat('я', 12000)]];
            $graph['edges'][] = ['id' => 'start'.$i, 'source' => 'message', 'target' => 'prompt'.$i];
            $graph['edges'][] = ['id' => 'end'.$i, 'source' => 'prompt'.$i, 'target' => 'context'];
        }
        $json = json_encode($graph, JSON_UNESCAPED_UNICODE);
        $this->assertLessThan(TutorFlows::MAX_BYTES, mb_strlen($json));
        $this->assertGreaterThan(TutorFlows::MAX_BYTES, strlen($json));
        $this->saveGraph(graph: $graph)->assertUnprocessable()->assertJsonValidationErrors('graph');
        $this->assertDatabaseCount('tutor_flow_versions', 0);
    }

    public function test_history_is_capped_at_fifty_without_deleting_rollback_snapshots(): void
    {
        $this->actingAs($this->actor());
        $flows = app(TutorFlows::class);
        $head = null;
        $first = null;
        for ($i = 0; $i < 52; $i++) {
            $head = $flows->save($this->graph(), $head, 101)['head_version_id'];
            $first ??= $head;
        }
        $response = $this->getJson(self::URL)->assertOk()->assertJsonCount(50, 'data.versions');
        $response->assertJsonPath('data.versions.0.id', $head);
        $this->assertArrayNotHasKey('graph', $response->json('data.versions.0'));
        $this->getJson(self::URL.'/'.$first)->assertOk();
        $this->postJson(self::URL.'/'.$first.'/activate', ['expected_active_version_id' => null])->assertOk();
        $this->assertSame($first, $flows->active()['version_id']);
        $this->assertDatabaseCount('tutor_flow_versions', 52);
    }

    public function test_gateway_flow_requires_secret_live_session_and_its_own_live_token(): void
    {
        Schema::create('users', function ($table) {
            $table->id();
            $table->string('name');
            $table->string('email');
        });
        Schema::create('personal_access_tokens', function ($table) {
            $table->id();
            $table->unsignedBigInteger('tokenable_id');
            $table->timestamp('expires_at')->nullable();
        });
        (require database_path('migrations/2026_10_16_000001_create_credit_accounts.php'))->up();
        DB::table('users')->insert([
            ['id' => 101, 'name' => 'Owner', 'email' => 'owner@example.test'],
            ['id' => 102, 'name' => 'Other', 'email' => 'other@example.test'],
        ]);
        DB::table('personal_access_tokens')->insert(['id' => 7, 'tokenable_id' => 101, 'expires_at' => now()->addHour()]);
        $session = str_repeat('c', 64);
        $secret = str_repeat('s', 32);
        DB::table('credit_gateway_sessions')->insert([
            'ticket_hash' => hash('sha256', 'flow-fixture'), 'session_hash' => hash('sha256', $session),
            'user_id' => 101, 'access_token_id' => 7, 'ticket_expires_at' => now()->subMinute(),
            'expires_at' => now()->addHour(), 'created_at' => now(),
        ]);
        config(['credits.enabled' => true, 'credits.gateway_secret' => $secret]);
        $url = '/api/internal/credits';
        $input = ['action' => 'flow.active', 'session' => $session];
        $this->postJson($url, $input)->assertForbidden();
        $this->withHeader('X-Credit-Gateway', str_repeat('x', 32))->postJson($url, $input)->assertForbidden();
        $this->withHeader('X-Credit-Gateway', $secret);
        $this->postJson($url, ['action' => 'flow.active'])->assertUnauthorized();
        $this->postJson($url, array_replace($input, ['session' => str_repeat('u', 64)]))->assertUnauthorized();
        $this->postJson($url, $input)->assertOk()->assertJsonPath('flow', null);

        $flows = app(TutorFlows::class);
        $first = $flows->save($this->graph(), null, 101)['head_version_id'];
        $flows->activate($first, null);
        $this->postJson($url, $input)->assertOk()->assertJsonPath('flow.version_id', $first)
            ->assertJsonPath('flow.graph.name', 'Учебный поток');
        // A browser-supplied user ID cannot replace the session/token owner.
        DB::table('personal_access_tokens')->where('id', 7)->update(['tokenable_id' => 102]);
        $this->postJson($url, $input + ['user_id' => 102])->assertUnauthorized();
        DB::table('personal_access_tokens')->where('id', 7)->update(['tokenable_id' => 101, 'expires_at' => now()->subSecond()]);
        $this->postJson($url, $input)->assertUnauthorized();
        DB::table('personal_access_tokens')->where('id', 7)->update(['expires_at' => null]);
        DB::table('credit_gateway_sessions')->update(['expires_at' => now()->subSecond()]);
        $this->postJson($url, $input)->assertUnauthorized();
        DB::table('credit_gateway_sessions')->update(['expires_at' => now()->addHour()]);
        DB::table('personal_access_tokens')->where('id', 7)->delete();
        $this->postJson($url, $input)->assertUnauthorized();
        $flows->deactivate($first);
        DB::table('credit_gateway_sessions')->update(['access_token_id' => null]);
        $this->postJson($url, $input)->assertOk()->assertJsonPath('flow', null);
        $this->assertDatabaseCount('tutor_flow_versions', 1);
    }

    private function compactGraph(): array
    {
        $graph = $this->graph();
        $graph['nodes'][] = ['id' => 'count', 'type' => 'condition', 'position' => ['x' => 0, 'y' => 300],
            'data' => ['field' => 'user_message_count', 'operator' => 'gt', 'value' => '20']];
        $graph['nodes'][] = ['id' => 'compact', 'type' => 'compact', 'position' => ['x' => 100, 'y' => 300], 'data' => ['keepPairs' => 5]];
        $graph['nodes'][] = ['id' => 'parameters', 'type' => 'source', 'position' => ['x' => 200, 'y' => 300],
            'data' => ['source' => 'parameter_state', 'limitChars' => 24000]];
        $graph['nodes'][] = ['id' => 'journal', 'type' => 'source', 'position' => ['x' => 300, 'y' => 300],
            'data' => ['source' => 'message_stream', 'limitChars' => 120000]];
        foreach ([['message', 'count', 'out'], ['count', 'compact', 'true'], ['count', 'context', 'false'],
            ['compact', 'parameters', 'out'], ['compact', 'journal', 'out'], ['parameters', 'context', 'out'], ['journal', 'context', 'out']] as $index => [$source, $target, $handle]) {
            $graph['edges'][] = ['id' => 'compact_edge'.$index, 'source' => $source, 'target' => $target, 'sourceHandle' => $handle];
        }

        return $graph;
    }

    public function test_compact_count_condition_and_journal_sources_round_trip_without_changing_schema_version(): void
    {
        $this->actingAs($this->actor());
        $id = $this->saveGraph(graph: $this->compactGraph())->assertCreated()->assertJsonPath('data.version.graph.version', 2)
            ->assertJsonPath('data.version.graph.nodes.8.data.value', '20')
            ->assertJsonPath('data.version.graph.nodes.9.data.keepPairs', 5)
            ->assertJsonPath('data.version.graph.nodes.11.data.limitChars', 120000)->json('data.version.id');
        $this->postJson(self::URL.'/'.$id.'/activate', ['expected_active_version_id' => null])->assertOk();
        $active = app(TutorFlows::class)->active();
        $this->assertSame($id, $active['version_id']);
        $this->assertSame('message_stream', $active['graph']['nodes'][11]['data']['source']);
        $this->getJson(self::URL.'/'.$id)->assertOk()->assertJsonPath('data.graph.nodes.9.type', 'compact');
    }

    public function test_legacy_graph_without_compact_and_direct_event_compact_edges_remain_valid(): void
    {
        $this->actingAs($this->actor());
        $head = $this->saveGraph()->assertCreated()->json('data.head_version_id');
        $graph = $this->compactGraph();
        $graph['edges'][8] = ['id' => 'direct_compact', 'source' => 'audio', 'target' => 'compact'];
        $this->saveGraph($head, $graph)->assertCreated();
    }

    public function test_compact_pairs_and_count_threshold_boundaries_are_accepted(): void
    {
        $flows = app(TutorFlows::class);
        foreach ([[1, '1'], [10, '200']] as [$pairs, $threshold]) {
            $graph = $this->compactGraph();
            $graph['nodes'][9]['data']['keepPairs'] = $pairs;
            $graph['nodes'][8]['data']['value'] = $threshold;
            $validated = $flows->validateGraph($graph);
            $this->assertSame($pairs, $validated['nodes'][9]['data']['keepPairs']);
            $this->assertSame($threshold, $validated['nodes'][8]['data']['value']);
        }
    }

    public static function invalidCompactSettings(): iterable
    {
        yield 'zero retained pairs' => ['nodes.9.data.keepPairs', 0];
        yield 'too many retained pairs' => ['nodes.9.data.keepPairs', 11];
        yield 'string retained pairs' => ['nodes.9.data.keepPairs', '5'];
        yield 'decimal retained pairs' => ['nodes.9.data.keepPairs', 1.5];
        yield 'executable compact option' => ['nodes.9.data.code', 'return 1'];
        yield 'counter contains not allowed' => ['nodes.8.data.operator', 'contains'];
        yield 'counter equals not allowed' => ['nodes.8.data.operator', 'equals'];
        yield 'zero threshold' => ['nodes.8.data.value', '0'];
        yield 'negative threshold' => ['nodes.8.data.value', '-1'];
        yield 'threshold upper bound' => ['nodes.8.data.value', '201'];
        yield 'nonstring threshold' => ['nodes.8.data.value', 20];
        yield 'fractional threshold' => ['nodes.8.data.value', '20.5'];
        yield 'scientific threshold' => ['nodes.8.data.value', '2e1'];
        yield 'text field with gt' => ['nodes.8.data.field', 'transcript'];
        yield 'page field with gt' => ['nodes.8.data.field', 'current_page'];
        yield 'parameters retain existing limit' => ['nodes.10.data.limitChars', 24001];
        yield 'journal upper bound' => ['nodes.11.data.limitChars', 120001];
        yield 'journal lower bound' => ['nodes.11.data.limitChars', 99];
        yield 'count is not a source' => ['nodes.11.data.source', 'user_message_count'];
    }

    #[DataProvider('invalidCompactSettings')]
    public function test_invalid_compact_and_count_settings_never_create_snapshots(string $path, mixed $value): void
    {
        $graph = $this->compactGraph();
        data_set($graph, $path, $value);
        $this->actingAs($this->actor());
        $this->saveGraph(graph: $graph)->assertUnprocessable()->assertJsonStructure(['errors']);
        $this->assertDatabaseCount('tutor_flow_versions', 0);
    }

    public function test_compact_is_optional_but_cannot_be_duplicated_or_orphaned_or_form_a_cycle(): void
    {
        $this->actingAs($this->actor());
        $graph = $this->compactGraph();
        $graph['nodes'][] = array_replace($graph['nodes'][9], ['id' => 'compact_again']);
        $this->saveGraph(graph: $graph)->assertUnprocessable()->assertJsonValidationErrors('graph.nodes');
        $graph = $this->compactGraph();
        array_splice($graph['edges'], 8, 1); // compact retains outgoing edges but has no input
        $this->saveGraph(graph: $graph)->assertUnprocessable()->assertJsonValidationErrors('graph.edges');
        $graph = $this->compactGraph();
        $graph['edges'] = array_values(array_filter($graph['edges'], fn ($edge) => $edge['source'] !== 'compact'));
        $this->saveGraph(graph: $graph)->assertUnprocessable()->assertJsonValidationErrors('graph.edges');
        $graph = $this->compactGraph();
        $graph['edges'][] = ['id' => 'cycle', 'source' => 'compact', 'target' => 'count'];
        $this->saveGraph(graph: $graph)->assertUnprocessable()->assertJsonValidationErrors('graph.edges');
        $this->assertDatabaseCount('tutor_flow_versions', 0);
    }

    private function orderedGraph(): array
    {
        $graph = $this->compactGraph();
        $graph['nodes'][3]['data'] = ['order' => ['parameters', 'journal', 'instructions', '$request']];
        $graph['nodes'][] = ['id' => 'instructions', 'type' => 'prompt', 'position' => ['x' => 400, 'y' => 300], 'data' => ['text' => 'Short examples.']];
        $graph['edges'] = [];
        foreach ([['message', 'journal', 'out'], ['audio', 'journal', 'out'], ['result', 'journal', 'out'],
            ['journal', 'count', 'out'], ['count', 'compact', 'true'], ['count', 'context', 'false'],
            ['compact', 'parameters', 'out'], ['compact', 'instructions', 'out'], ['compact', 'context', 'out'],
            ['parameters', 'context', 'out'], ['instructions', 'context', 'out'],
            ['context', 'model', 'out'], ['model', 'tools', 'out'], ['tools', 'reply', 'out'], ['reply', 'speech', 'out']] as $index => [$source, $target, $handle]) {
            $graph['edges'][] = ['id' => 'ordered'.$index, 'source' => $source, 'target' => $target, 'sourceHandle' => $handle];
        }

        return $graph;
    }

    public function test_context_order_saves_reloads_and_activates_unchanged_with_immutable_versions(): void
    {
        $this->actingAs($this->actor());
        $graph = $this->orderedGraph();
        $order = $graph['nodes'][3]['data']['order'];
        $first = $this->saveGraph(graph: $graph)->assertCreated()
            ->assertJsonPath('data.version.graph.nodes.3.data.order', $order)->json('data.version.id');
        $this->getJson(self::URL.'/'.$first)->assertOk()->assertJsonPath('data.graph.nodes.3.data.order', $order);
        $this->postJson(self::URL.'/'.$first.'/activate', ['expected_active_version_id' => null])->assertOk();
        $this->assertSame($order, app(TutorFlows::class)->active()['graph']['nodes'][3]['data']['order']);
        $graph['nodes'][3]['data']['order'] = ['$request', 'instructions'];
        $second = $this->saveGraph($first, $graph)->assertCreated()
            ->assertJsonPath('data.version.graph.nodes.3.data.order', ['$request', 'instructions'])
            ->assertJsonPath('data.active_version_id', $first)->json('data.version.id');
        $this->getJson(self::URL.'/'.$first)->assertOk()->assertJsonPath('data.graph.nodes.3.data.order', $order);
        $this->postJson(self::URL.'/'.$second.'/activate', ['expected_active_version_id' => $first])->assertOk();
        $this->assertSame(['$request', 'instructions'], app(TutorFlows::class)->active()['graph']['nodes'][3]['data']['order']);
    }

    public function test_context_order_can_omit_connected_blocks_and_place_request_anywhere(): void
    {
        $flows = app(TutorFlows::class);
        foreach ([['$request'], ['$request', 'journal'], ['journal', '$request', 'instructions']] as $order) {
            $graph = $this->orderedGraph();
            $graph['nodes'][3]['data']['order'] = $order;
            $this->assertSame($order, $flows->validateGraph($graph)['nodes'][3]['data']['order']);
        }
    }

    public function test_context_order_accepts_forward_paths_through_count_and_compact_and_forward_node_references(): void
    {
        $graph = $this->orderedGraph();
        // Leave only journal -> condition -> compact -> context (no direct
        // journal/context edge and no condition's false shortcut).
        $graph['edges'] = array_values(array_filter($graph['edges'], fn ($edge) => $edge['id'] !== 'ordered5'));
        $graph['nodes'] = array_reverse($graph['nodes']);
        $validated = app(TutorFlows::class)->validateGraph($graph);
        $context = collect($validated['nodes'])->firstWhere('type', 'context');
        $this->assertSame(['parameters', 'journal', 'instructions', '$request'], $context['data']['order']);

        // Numeric-looking string IDs also retain their identity in PHP maps.
        foreach ($graph['nodes'] as &$node) {
            if ($node['id'] === 'context') {
                $node['id'] = '123';
            }
        }
        unset($node);
        foreach ($graph['edges'] as &$edge) {
            foreach (['source', 'target'] as $key) {
                if ($edge[$key] === 'context') {
                    $edge[$key] = '123';
                }
            }
        }
        unset($edge);
        $this->assertSame(2, app(TutorFlows::class)->validateGraph($graph)['version']);
    }

    public function test_message_stream_can_feed_compact_directly_while_legacy_event_conditions_and_empty_context_remain_valid(): void
    {
        $graph = $this->orderedGraph();
        $graph['edges'][3]['target'] = 'compact';
        $graph['edges'][] = ['id' => 'legacy_count_input', 'source' => 'message', 'target' => 'count'];
        $this->actingAs($this->actor());
        $first = $this->saveGraph(graph: $graph)->assertCreated()->json('data.version.id');
        $legacy = $this->withBranch();
        $second = $this->saveGraph($first, $legacy)->assertCreated()->json('data.version.id');
        $response = $this->getJson(self::URL.'/'.$second)->assertOk();
        $this->assertInstanceOf(\stdClass::class, json_decode($response->getContent())->data->graph->nodes[3]->data);
    }

    public static function invalidContextOrders(): iterable
    {
        yield 'null order' => [null];
        yield 'string order' => ['$request'];
        yield 'object order' => [['request' => '$request']];
        yield 'empty order' => [[]];
        yield 'over 65 entries' => [array_merge(['$request'], array_map(fn ($index) => 'block'.$index, range(1, 65)))];
        yield 'missing request' => [['journal']];
        yield 'duplicate request' => [['$request', '$request']];
        yield 'duplicate source' => [['journal', '$request', 'journal']];
        yield 'duplicate prompt' => [['instructions', 'instructions', '$request']];
        yield 'integer element' => [[1, '$request']];
        yield 'array element' => [[['journal'], '$request']];
        yield 'ghost block' => [['missing', '$request']];
        yield 'empty ID' => [['', '$request']];
        yield 'request case matters' => [['$Request', '$request']];
        yield 'event is not context data' => [['message', '$request']];
        yield 'context is not context data' => [['context', '$request']];
        yield 'model is not context data' => [['model', '$request']];
        yield 'condition is not context data' => [['count', '$request']];
        yield 'compact is not context data' => [['compact', '$request']];
    }

    #[DataProvider('invalidContextOrders')]
    public function test_invalid_context_order_is_rejected_without_a_new_version(mixed $order): void
    {
        $graph = $this->orderedGraph();
        $graph['nodes'][3]['data']['order'] = $order;
        $this->actingAs($this->actor());
        $response = $this->saveGraph(graph: $graph)->assertUnprocessable();
        $this->assertStringContainsString('graph.nodes.3.data.order', json_encode(array_keys($response->json('errors'))));
        $this->assertDatabaseCount('tutor_flow_versions', 0);
    }

    public static function invalidSourceGateConnections(): iterable
    {
        foreach (['recent_context', 'context_summary', 'important_notes', 'lesson_context', 'current_page', 'recent_tool_interactions', 'transcript_candidates', 'parameter_state'] as $source) {
            foreach (['condition', 'compact'] as $target) {
                yield $source.' -> '.$target => [$source, $target];
            }
        }
    }

    #[DataProvider('invalidSourceGateConnections')]
    public function test_only_message_stream_can_feed_condition_or_compact(string $source, string $target): void
    {
        $graph = $this->orderedGraph();
        $graph['nodes'][11]['data'] = ['source' => $source, 'limitChars' => 24000];
        $graph['edges'][3]['target'] = $target === 'compact' ? 'compact' : 'count';
        if ($target === 'compact') {
            $graph['edges'][] = ['id' => 'count_input', 'source' => 'message', 'target' => 'count'];
        }
        $this->actingAs($this->actor());
        $this->saveGraph(graph: $graph)->assertUnprocessable()->assertJsonValidationErrors('graph.edges.3');
        $this->assertDatabaseCount('tutor_flow_versions', 0);
    }

    public function test_message_stream_condition_requires_count_field_but_other_sources_can_still_feed_context(): void
    {
        $this->actingAs($this->actor());
        foreach (['transcript', 'current_page'] as $field) {
            $graph = $this->orderedGraph();
            $graph['nodes'][8]['data'] = ['field' => $field, 'operator' => 'contains', 'value' => 'lesson'];
            $this->saveGraph(graph: $graph)->assertUnprocessable()->assertJsonValidationErrors('graph.edges.3');
        }
        $graph = $this->orderedGraph();
        $graph['nodes'][11]['data'] = ['source' => 'recent_context', 'limitChars' => 24000];
        $graph['edges'][3]['target'] = 'context';
        $graph['edges'][] = ['id' => 'event_count_input', 'source' => 'message', 'target' => 'count'];
        $this->saveGraph(graph: $graph)->assertCreated();
    }

    public function test_order_does_not_admit_disconnected_sources_or_cycles_introduced_by_new_source_ports(): void
    {
        $this->actingAs($this->actor());
        $graph = $this->orderedGraph();
        $graph['edges'] = array_values(array_filter($graph['edges'], fn ($edge) => $edge['source'] !== 'parameters'));
        $this->saveGraph(graph: $graph)->assertUnprocessable()->assertJsonValidationErrors('graph.edges');
        $graph = $this->orderedGraph();
        $graph['nodes'][10]['data'] = ['source' => 'message_stream', 'limitChars' => 24000];
        $graph['edges'][] = ['id' => 'new_source_cycle', 'source' => 'parameters', 'target' => 'count'];
        $this->saveGraph(graph: $graph)->assertUnprocessable()->assertJsonValidationErrors('graph.edges');
        $this->assertDatabaseCount('tutor_flow_versions', 0);
    }
}
