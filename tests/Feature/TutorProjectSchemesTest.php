<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Tutor\ServiceWorkflows;
use App\Services\Tutor\TutorFlows;
use App\Services\Tutor\TutorProjectSchemes;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class TutorProjectSchemesTest extends TestCase
{
    private const URL = '/api/tutor/flows/project-schemes';

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        Schema::create('app_settings', function ($table) {
            $table->string('key')->primary();
            $table->longText('value');
            $table->timestamps();
        });
    }

    private function actor(bool $admin = true): User
    {
        $user = \Mockery::mock(User::class)->makePartial();
        $user->forceFill(['id' => 101, 'name' => 'Administrator', 'email' => 'project@example.test']);
        $user->shouldReceive('isFrontendAdmin')->andReturn($admin);

        return $user;
    }

    public function test_admin_access_and_read_only_default_keep_every_working_group(): void
    {
        $this->getJson(self::URL)->assertUnauthorized();
        $this->postJson(self::URL, ['name' => 'Example'])->assertUnauthorized();
        $this->putJson(self::URL.'/main')->assertUnauthorized();
        $this->actingAs($this->actor(false))->getJson(self::URL)->assertForbidden();
        $this->postJson(self::URL, ['name' => 'Example', 'is_admin' => true])->assertForbidden();
        $data = $this->actingAs($this->actor())->getJson(self::URL)->assertOk()->assertHeader('Cache-Control', 'no-store, private')->json('data');
        $this->assertCount(1, $data['schemes']);
        $this->assertSame('main', $data['schemes'][0]['id']);
        $this->assertSame(['tutor', 'memory', 'exams', 'english_exams', 'translation', 'references'], array_column($data['schemes'][0]['graph']['modules'], 'id'));
        $this->assertEqualsCanonicalizing(['tutor', ...array_keys(ServiceWorkflows::SCHEMES)], array_keys($data['modules']));
        foreach ($data['contract']['connections'] as $edge) {
            $this->assertFileExists(base_path($edge['handler']));
        }
        $this->assertDatabaseCount('app_settings', 0);
    }

    public function test_layout_save_is_cas_protected_and_does_not_touch_working_versions(): void
    {
        DB::table('app_settings')->insert(['key' => 'tutor_preset_economy', 'value' => '{"keep":"admin settings"}']);
        $before = DB::table('app_settings')->first();
        $this->actingAs($this->actor());
        $document = $this->getJson(self::URL)->json('data.schemes.0');
        $graph = $document['graph'];
        $graph['modules'][0]['position'] = ['x' => -150, 'y' => 987];
        $result = $this->putJson(self::URL.'/main', ['graph' => $graph, 'expected_revision' => $document['revision']])->assertOk();
        $this->assertSame($graph, $result->json('data.schemes.0.graph'));
        $this->assertSame(1, $result->json('data.schemes.0.version'));
        $this->assertEquals($before, DB::table('app_settings')->where('key', 'tutor_preset_economy')->first());
        $this->putJson(self::URL.'/main', ['graph' => $graph, 'expected_revision' => $document['revision']])->assertConflict();
        $this->assertDatabaseCount('app_settings', 2);
        $stored = json_decode(DB::table('app_settings')->where('key', 'tutor_project_scheme:main')->value('value'), true);
        $this->assertCount(1, $stored['history']);
        $this->assertSame($document['graph'], $stored['history'][0]['graph']);
    }

    public function test_block_snapshots_require_admin_and_are_read_only_working_graphs(): void
    {
        $this->getJson(self::URL.'/blocks')->assertUnauthorized();
        $this->actingAs($this->actor(false))->getJson(self::URL.'/blocks')->assertForbidden();
        $data = $this->actingAs($this->actor())->getJson(self::URL.'/blocks')->assertOk()->assertHeader('Cache-Control', 'no-store, private')->json('data.modules');
        $this->assertCount(6, $data);
        foreach ($data as $group) {
            $this->assertSame(count($group['graph']['nodes']), $group['nodes']);
            $this->assertSame(count($group['graph']['edges']), $group['edges']);
            $this->assertNull($group['active']);
        }
        $this->assertSame(app(ServiceWorkflows::class)->defaultGraph('english_exams'), $data['english_exams']['graph']);
        $this->assertDatabaseCount('app_settings', 0);
    }

    public function test_additional_schemes_are_persistent_empty_and_do_not_replace_main(): void
    {
        $this->actingAs($this->actor());
        $created = $this->postJson(self::URL, ['name' => 'Будущая схема'])->assertCreated()->json('data');
        $this->assertCount(2, $created['schemes']);
        $this->assertSame('main', $created['schemes'][0]['id']);
        $other = collect($created['schemes'])->firstWhere('id', $created['id']);
        $this->assertSame([], $other['graph']['modules']);
        $other['graph']['modules'] = [app(TutorProjectSchemes::class)->defaultGraph()['modules'][0]];
        $this->putJson(self::URL.'/'.$created['id'], ['graph' => $other['graph'], 'expected_revision' => $other['revision']])->assertOk();
        $again = $this->getJson(self::URL)->assertOk()->json('data.schemes');
        $this->assertCount(2, $again);
        $this->assertCount(6, $again[0]['graph']['modules']);
        $this->assertSame(['tutor'], array_column(collect($again)->firstWhere('id', $created['id'])['graph']['modules'], 'id'));
        $this->assertSame(0, DB::table('app_settings')->where('key', 'like', 'ai_workflow_%')->count());
    }

    public function test_main_cannot_lose_groups_or_accept_executable_or_arbitrary_connections(): void
    {
        $this->actingAs($this->actor());
        $document = $this->getJson(self::URL)->json('data.schemes.0');
        $invalid = [];
        $graph = $document['graph'];
        $graph['modules'] = array_slice($graph['modules'], 1);
        $invalid[] = $graph;
        $graph = $document['graph'];
        $graph['edges'] = [['source' => 'english_exams', 'target' => 'references']];
        $invalid[] = $graph;
        $graph = $document['graph'];
        $graph['modules'][0]['data'] = ['code' => 'execute arbitrary code'];
        $invalid[] = $graph;
        $graph = $document['graph'];
        $graph['modules'][0]['id'] = 'unknown';
        $invalid[] = $graph;
        $graph = $document['graph'];
        $graph['modules'][0]['position']['x'] = '100';
        $invalid[] = $graph;
        $graph = $document['graph'];
        $graph['modules'][0]['position']['y'] = 100001;
        $invalid[] = $graph;
        foreach ($invalid as $graph) {
            $this->putJson(self::URL.'/main', ['graph' => $graph, 'expected_revision' => $document['revision']])->assertUnprocessable();
        }
        $this->postJson(self::URL, ['name' => ' ', 'ignored' => 'field'])->assertUnprocessable();
        $this->putJson(self::URL.'/../../invalid', ['graph' => $document['graph'], 'expected_revision' => $document['revision']])->assertNotFound();
        $this->assertDatabaseCount('app_settings', 0);
    }

    public function test_legacy_groups_read_as_module_references_without_rewriting_cas_or_history(): void
    {
        $legacy = ['version' => 1, 'name' => 'Custom project', 'groups' => array_map(fn ($module) => ['id' => $module['id'], 'position' => $module['position']], app(TutorProjectSchemes::class)->defaultGraph()['modules'])];
        $legacy['groups'][0]['position'] = ['x' => -117, 'y' => 612];
        $state = ['graph' => $legacy, 'version' => 9, 'history' => [['graph' => $legacy, 'version' => 8]], 'updated_by' => 101];
        $raw = json_encode($state, JSON_THROW_ON_ERROR);
        DB::table('app_settings')->insert(['key' => 'tutor_project_scheme:main', 'value' => $raw]);
        $this->actingAs($this->actor());
        $document = $this->getJson(self::URL)->assertOk()->json('data.schemes.0');
        $this->assertSame(2, $document['graph']['version']);
        $this->assertArrayNotHasKey('groups', $document['graph']);
        $this->assertSame($legacy['groups'][0]['position'], $document['graph']['modules'][0]['position']);
        $this->assertSame(hash('sha256', $raw), $document['revision']);
        $this->assertSame($raw, DB::table('app_settings')->where('key', 'tutor_project_scheme:main')->value('value'));
        $document['graph']['modules'][0]['expanded'] = true;
        $document['graph']['modules'][0]['detailPosition'] = ['x' => 123, 'y' => -50];
        $this->putJson(self::URL.'/main', ['graph' => $document['graph'], 'expected_revision' => $document['revision']])->assertOk();
        $stored = json_decode(DB::table('app_settings')->where('key', 'tutor_project_scheme:main')->value('value'), true);
        $this->assertSame($legacy, $stored['history'][0]['graph']);
        $this->assertSame($state['history'][0], $stored['history'][1]);
        $this->assertSame($document['graph'], $stored['graph']);
    }

    public function test_module_conversion_keeps_actual_active_graphs_prompts_and_version_pointers(): void
    {
        Schema::create('tutor_flow_state', fn ($table) => [$table->integer('id')->primary(), $table->integer('active_version_id')->nullable()]);
        Schema::create('tutor_flow_versions', fn ($table) => [$table->integer('id')->primary(), $table->longText('graph')]);
        $chat = app(TutorFlows::class)->defaultGraph();
        foreach ($chat['nodes'] as &$node) {
            if ($node['type'] === 'prompt') {
                $node['data']['text'] = 'Administrator custom prompt: preserve exactly.';
            }
        }
        unset($node);
        DB::table('tutor_flow_state')->insert(['id' => 1, 'active_version_id' => 17]);
        DB::table('tutor_flow_versions')->insert(['id' => 17, 'graph' => json_encode($chat)]);
        $exams = app(ServiceWorkflows::class)->defaultGraph('exams');
        $state = ['active' => 11, 'head' => 12, 'versions' => [['id' => 11, 'name' => $exams['name'], 'graph' => $exams], ['id' => 12, 'name' => $exams['name'], 'graph' => $exams]]];
        $raw = json_encode($state, JSON_THROW_ON_ERROR);
        DB::table('app_settings')->insert(['key' => 'ai_workflow_exams', 'value' => $raw]);
        $this->actingAs($this->actor());
        $modules = $this->getJson(self::URL.'/blocks')->assertOk()->json('data.modules');
        $this->assertSame(17, $modules['tutor']['active']);
        $this->assertSame(json_decode(json_encode($chat), true), $modules['tutor']['graph']);
        $this->assertSame(['engine' => 'tutor_flow', 'key' => 'tutor'], $modules['tutor']['binding']);
        $this->assertSame(11, $modules['exams']['active']);
        $this->assertSame($exams, $modules['exams']['graph']);
        $this->assertSame(['engine' => 'service_workflow', 'key' => 'exams'], $modules['exams']['binding']);
        $document = $this->getJson(self::URL)->json('data.schemes.0');
        foreach ($document['graph']['modules'] as &$module) {
            $module['expanded'] = true;
        }
        unset($module);
        $this->putJson(self::URL.'/main', ['graph' => $document['graph'], 'expected_revision' => $document['revision']])->assertOk();
        $this->assertSame($raw, DB::table('app_settings')->where('key', 'ai_workflow_exams')->value('value'));
        $this->assertSame(17, DB::table('tutor_flow_state')->where('id', 1)->value('active_version_id'));
        $this->assertSame(json_decode(json_encode($chat), true), $this->getJson(self::URL.'/blocks')->json('data.modules.tutor.graph'));
    }
}
