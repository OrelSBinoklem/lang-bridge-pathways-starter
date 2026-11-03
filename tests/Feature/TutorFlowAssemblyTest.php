<?php

namespace Tests\Feature;

use App\Services\Tutor\TutorFlows;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class TutorFlowAssemblyTest extends TestCase
{
    public function test_eight_ports_and_serializer_survive_canonical_validation(): void
    {
        $flows = app(TutorFlows::class);
        $graph = $flows->defaultGraph();
        $context = collect($graph['nodes'])->firstWhere('type', 'context');
        $this->assertCount(8, $context['data']['inputs']);
        $this->assertSame('object', $context['data']['mode']);
        $this->assertSame('messages', collect($graph['nodes'])->firstWhere('type', 'serialize')['data']['format']);
        $this->assertSame(json_encode($graph), json_encode($flows->validateGraph(json_decode(json_encode($graph)))));
    }

    public function test_nested_assemblies_and_mcp_data_are_accepted(): void
    {
        $flows = app(TutorFlows::class); $graph = $flows->defaultGraph();
        $context = collect($graph['nodes'])->firstWhere('type', 'context');
        $context['id'] = 'nested'; $context['data']['mode'] = 'json';
        $graph['nodes'][] = $context;
        $graph['nodes'][] = ['id' => 'table_mcp', 'type' => 'mcp', 'position' => ['x' => 0, 'y' => 0], 'data' => ['service' => 'grammar_search', 'query' => 'vajag', 'tableKey' => '', 'limit' => 3]];
        $graph['edges'][] = ['id' => 'mcp_in', 'source' => 'event_0', 'target' => 'table_mcp'];
        $graph['edges'][] = ['id' => 'mcp_nested', 'source' => 'table_mcp', 'target' => 'nested', 'targetHandle' => 'in6'];
        $graph['edges'][] = ['id' => 'nested_outer', 'source' => 'nested', 'target' => 'context', 'targetHandle' => 'in5'];
        $this->assertCount(count($flows->defaultGraph()['nodes']) + 2, $flows->validateGraph($graph)['nodes']);
    }

    public function test_untrusted_mcp_endpoints_and_bad_ports_never_pass_validation(): void
    {
        $flows = app(TutorFlows::class);
        $mutations = [
            function (&$g) { foreach ($g['nodes'] as &$n) if ($n['type'] === 'context') $n['data']['inputs'][0]['key'] = 'constructor'; },
            function (&$g) { foreach ($g['nodes'] as &$n) if ($n['type'] === 'context') $n['data']['inputs'][1]['id'] = 'in1'; },
            function (&$g) { foreach ($g['edges'] as &$e) if ($e['target'] === 'context') $e['targetHandle'] = 'in9'; },
            function (&$g) { $g['nodes'][] = ['id' => 'bad', 'type' => 'mcp', 'position' => ['x' => 0, 'y' => 0], 'data' => ['service' => 'web_search', 'query' => '', 'tableKey' => '', 'limit' => 3, 'url' => 'http://localhost']]; },
        ];
        foreach ($mutations as $mutate) {
            $graph = $flows->defaultGraph(); $mutate($graph);
            try { $flows->validateGraph($graph); $this->fail('Unsafe graph accepted.'); }
            catch (ValidationException $e) { $this->assertNotEmpty($e->errors()); }
        }
    }
}
