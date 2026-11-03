<?php

namespace App\Services\Tutor;

use Illuminate\Support\Facades\Schema;

/** Application modules delegate to their existing executors and version stores.
 * Embedded helper modules remain immutable TutorFlowModules definitions inside them. */
class TutorProjectModules
{
    public function all(bool $includeGraph = false): array
    {
        $contract = app(TutorProjectSchemes::class)->contract();
        $workflows = app(ServiceWorkflows::class)->all();
        $result = [];
        foreach ($contract['modules'] as $module) {
            $binding = $module['binding'];
            if ($binding === ['engine' => 'tutor_flow', 'key' => 'tutor']) {
                $flow = Schema::hasTable('tutor_flow_state') ? app(TutorFlows::class)->active() : null;
                $active = $flow['version_id'] ?? null;
                $graph = $flow['graph'] ?? app(TutorFlows::class)->defaultGraph();
            } else {
                // No arbitrary executable endpoints in project layouts.
                abort_unless($binding['engine'] === 'service_workflow' && isset($workflows[$binding['key']]), 500, 'Неизвестный исполнитель модуля.');
                $workflow = $workflows[$binding['key']];
                $active = $workflow['active'];
                $graph = collect($workflow['versions'])->firstWhere('id', $active)['graph'] ?? $workflow['default_graph'];
            }
            $result[$module['id']] = [...$module, 'active' => $active, 'nodes' => count($graph['nodes']), 'edges' => count($graph['edges']),
                'models' => array_values(array_unique(array_map(fn ($node) => $node['data']['model'], array_filter($graph['nodes'], fn ($node) => $node['type'] === 'model')))),
                ...($includeGraph ? ['graph' => $graph] : [])];
        }

        return $result;
    }
}
