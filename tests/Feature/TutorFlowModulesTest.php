<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Tutor\TutorFlowModules;
use App\Services\Tutor\TutorFlows;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class TutorFlowModulesTest extends TestCase
{
    private const URL = '/api/tutor/flows/modules';

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        Schema::create('app_settings', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->longText('value');
            $table->timestamps();
        });
    }

    private function actor(bool $admin = true): User
    {
        $user = \Mockery::mock(User::class)->makePartial();
        $user->forceFill(['id' => 101, 'name' => 'Module administrator', 'email' => 'modules@example.test']);
        $user->shouldReceive('isFrontendAdmin')->andReturn($admin);

        return $user;
    }

    private function node(string $id, string $type, array $data): array
    {
        return ['id' => $id, 'type' => $type, 'position' => ['x' => 0, 'y' => 0], 'data' => $data === [] ? (object) [] : $data];
    }

    private function edge(string $from, string $to, string $source = 'out', string $target = 'in'): array
    {
        return ['id' => $from.'_'.$to, 'source' => $from, 'target' => $to, 'sourceHandle' => $source, 'targetHandle' => $target];
    }

    private function definition(): array
    {
        return ['id' => 'custom', 'name' => 'Мой модуль', 'version' => 1,
            'inputs' => [['id' => 'in1', 'label' => 'Вход']], 'outputs' => [['id' => 'out1', 'label' => 'Выход']],
            'nodes' => [$this->node('input', 'module_input', ['port' => 'in1']), $this->node('prompt', 'prompt', ['text' => ' Keep original spaces ']), $this->node('output', 'module_output', ['port' => 'out1'])],
            'edges' => [$this->edge('input', 'prompt'), $this->edge('prompt', 'output')]];
    }

    private function wrap(array $definition): array
    {
        $outer = $this->definition();
        $outer['nodes'][1] = $this->node('nested', 'module', ['definition' => $definition]);
        $outer['edges'] = [$this->edge('input', 'nested', 'out', 'in1'), $this->edge('nested', 'output', 'out1')];

        return $outer;
    }

    public function test_php_and_browser_share_module_and_port_id_fixtures(): void
    {
        $ids = json_decode(file_get_contents(base_path('tests/Fixtures/tutor-flow-module-ids.json')), true, 512, JSON_THROW_ON_ERROR);
        $ids['valid'][] = str_repeat('a', 80);
        $ids['invalid'][] = str_repeat('a', 81);
        foreach ($ids as $kind => $values) {
            foreach ($values as $id) {
                $d = $this->definition();
                $d['id'] = $id;
                $d['inputs'][0]['id'] = $id;
                $d['nodes'][0]['data']['port'] = $id;
                $d['outputs'][0]['id'] = $id;
                $d['nodes'][2]['data']['port'] = $id;
                try {
                    app(TutorFlowModules::class)->validateDefinition($d);
                    $this->assertSame('valid', $kind);
                } catch (ValidationException $error) {
                    $this->assertSame('invalid', $kind);
                }
            }
        }
    }

    public function test_endpoints_require_admin_and_return_private_catalogue_without_writes(): void
    {
        foreach (['get', 'post'] as $method) {
            $this->{$method.'Json'}(self::URL)->assertUnauthorized();
        }
        $this->actingAs($this->actor(false));
        foreach (['get', 'post'] as $method) {
            $this->{$method.'Json'}(self::URL, ['is_admin' => true])->assertForbidden();
        }
        $this->assertDatabaseCount('app_settings', 0);
        $response = $this->actingAs($this->actor())->getJson(self::URL)->assertOk()->assertJsonPath('data.modules', []);
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $this->assertDatabaseCount('app_settings', 0);
    }

    public function test_locked_cas_preserves_every_previous_version_and_raw_prompt_text(): void
    {
        $this->actingAs($this->actor());
        $first = $this->definition();
        $response = $this->postJson(self::URL, ['definition' => $first, 'expected_version' => null])->assertCreated()->assertJsonPath('data.definition', $first);
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $second = $first;
        $second['version'] = 2;
        $second['nodes'][1]['data']['text'] = 'New instruction';
        $this->postJson(self::URL, ['definition' => $second, 'expected_version' => null])->assertConflict();
        $this->postJson(self::URL, ['definition' => $second, 'expected_version' => 1])->assertCreated()->assertJsonCount(2, 'data.modules');
        $this->postJson(self::URL, ['definition' => $second, 'expected_version' => 1])->assertConflict();
        $this->getJson(self::URL)->assertOk()->assertJsonPath('data.modules.0', $second)->assertJsonPath('data.modules.1', $first);
        $third = $second;
        $third['version'] = 4;
        $this->postJson(self::URL, ['definition' => $third, 'expected_version' => 2])->assertUnprocessable();
        $other = $first;
        $other['id'] = 'another';
        $this->postJson(self::URL, ['definition' => $other, 'expected_version' => null])->assertCreated()->assertJsonCount(3, 'data.modules');
        $this->assertDatabaseCount('app_settings', 5);
    }

    public function test_endpoint_rejects_bad_envelopes_and_executable_settings_without_writing(): void
    {
        $this->actingAs($this->actor());
        foreach ([[], ['definition' => $this->definition()], ['definition' => $this->definition(), 'expected_version' => '1'], ['definition' => $this->definition(), 'expected_version' => null, 'path' => 'script.mjs']] as $input) {
            $this->postJson(self::URL, $input)->assertUnprocessable();
        }
        $bad = $this->definition();
        $bad['nodes'][1]['data']['path'] = 'script.mjs';
        $this->postJson(self::URL, ['definition' => $bad, 'expected_version' => null])->assertUnprocessable();
        $this->assertDatabaseCount('app_settings', 0);
    }

    public function test_definition_validation_depth_boundaries_ports_and_unsafe_nodes(): void
    {
        $modules = app(TutorFlowModules::class);
        $this->assertSame($this->definition(), $modules->validateDefinition($this->definition()));
        $three = $this->wrap($this->wrap($this->definition()));
        $this->assertSame($three, $modules->validateDefinition($three));
        $invalid = [];
        $invalid[] = $this->wrap($three);
        foreach (['event', 'tools', 'reply', 'speech', 'compact'] as $type) {
            $d = $this->definition();
            $d['nodes'][1]['type'] = $type;
            $invalid[] = $d;
        }
        foreach (['constructor', '__proto__', 'current_request', 'bad id'] as $id) {
            $d = $this->definition();
            $d['outputs'][0]['id'] = $id;
            $invalid[] = $d;
        }
        $d = $this->definition();
        $d['inputs'] = [];
        $invalid[] = $d;
        $d = $this->definition();
        $d['inputs'] = array_fill(0, 17, $d['inputs'][0]);
        $invalid[] = $d;
        $d = $this->definition();
        $d['nodes'][0]['data']['port'] = 'missing';
        $invalid[] = $d;
        $d = $this->definition();
        $d['edges'][0]['sourceHandle'] = 'missing';
        $invalid[] = $d;
        $d = $this->definition();
        $d['nodes'][] = $d['nodes'][0];
        $invalid[] = $d;
        $d = $this->definition();
        $d['edges'][] = $this->edge('output', 'input');
        $invalid[] = $d;
        $d = $this->definition();
        $d['nodes'][] = $this->node('orphan', 'prompt', ['text' => '']);
        $invalid[] = $d;
        $d = $this->definition();
        $d['nodes'][1]['id'] = 'nested__id';
        $invalid[] = $d;
        $d = $this->definition();
        $d['version'] = 0;
        $invalid[] = $d;
        foreach ($invalid as $index => $d) {
            try {
                $modules->validateDefinition($d);
                $this->fail('Accepted invalid definition '.$index);
            } catch (ValidationException $error) {
                $this->assertNotEmpty($error->errors());
            }
        }
    }

    public function test_root_graph_snapshot_handles_context_order_and_model_fragment_are_validated(): void
    {
        $flows = app(TutorFlows::class);
        $d = $this->definition();
        $d['nodes'] = [$d['nodes'][0], $this->node('context', 'context', []), $this->node('model', 'model', ['model' => 'preset', 'reasoning' => 'preset', 'maxOutputTokens' => 700]), $d['nodes'][2]];
        $d['edges'] = [$this->edge('input', 'context'), $this->edge('context', 'model'), $this->edge('model', 'output')];
        $graph = $flows->defaultGraph();
        $graph['nodes'][] = $this->node('instance', 'module', ['definition' => $d]);
        $graph['edges'][] = $this->edge('event_0', 'instance', 'out', 'in1');
        $graph['edges'][] = $this->edge('instance', 'context', 'out1', 'in7');
        $validated = $flows->validateGraph($graph);
        $this->assertSame('module', end($validated['nodes'])['type']);
        $this->assertSame(1, end($validated['nodes'])['data']['definition']['version']);
        $this->actingAs($this->actor());
        $this->postJson(self::URL, ['definition' => $d, 'expected_version' => null])->assertCreated();
        $objects = json_decode($this->getJson(self::URL)->assertOk()->getContent());
        $this->assertInstanceOf(\stdClass::class, $objects->data->modules[0]->nodes[1]->data);
        (require database_path('migrations/2026_10_28_000001_create_tutor_flows.php'))->up();
        $saved = $flows->save($graph, null, 101);
        $flows->activate($saved['version']['id'], null);
        $this->assertSame('module', end($flows->active()['graph']['nodes'])['type']);
        $graph['edges'][count($graph['edges']) - 1]['sourceHandle'] = 'missing';
        $this->expectException(ValidationException::class);
        $flows->validateGraph($graph);
    }

    public function test_embedded_snapshot_never_upgrades_after_catalogue_save(): void
    {
        $modules = app(TutorFlowModules::class);
        $first = $this->definition();
        $modules->save($first, null);
        $graph = app(TutorFlows::class)->defaultGraph();
        $graph['nodes'][] = $this->node('instance', 'module', ['definition' => $first]);
        $graph['edges'][] = $this->edge('event_0', 'instance', 'out', 'in1');
        $graph['edges'][] = $this->edge('instance', 'context', 'out1', 'in7');
        $snapshot = app(TutorFlows::class)->validateGraph($graph);
        $second = $first;
        $second['version'] = 2;
        $second['name'] = 'New version';
        $modules->save($second, 1);
        $this->assertEquals($snapshot, app(TutorFlows::class)->validateGraph($graph));
        $this->assertSame($first, end($snapshot['nodes'])['data']['definition']);
    }

    public function test_optional_loop_is_strict_bounded_and_old_default_shape_is_preserved(): void
    {
        $flows = app(TutorFlows::class);
        $graph = $flows->defaultGraph();
        $this->assertSame(json_encode($graph), json_encode($flows->validateGraph($graph)));
        $index = array_search('tools', array_column($graph['nodes'], 'type'), true);
        $loop = ['timeoutMs' => 120000, 'maxRepeatedCommand' => 3, 'maxCostUsd' => 10];
        $graph['nodes'][$index]['data']['loop'] = $loop;
        $this->assertSame($loop, $flows->validateGraph($graph)['nodes'][$index]['data']['loop']);
        foreach ([['timeoutMs' => 999, 'maxRepeatedCommand' => 2], ['timeoutMs' => 1000, 'maxRepeatedCommand' => 4], ['timeoutMs' => 1000, 'maxRepeatedCommand' => 2, 'maxCostUsd' => 0], ['timeoutMs' => 1000, 'maxRepeatedCommand' => 2, 'path' => 'bad']] as $bad) {
            $graph['nodes'][$index]['data']['loop'] = $bad;
            try {
                $flows->validateGraph($graph);
                $this->fail('Accepted invalid loop');
            } catch (ValidationException $error) {
                $this->assertNotEmpty($error->errors());
            }
        }
    }
}
