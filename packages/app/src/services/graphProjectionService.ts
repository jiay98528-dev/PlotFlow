import type { PlotFlowData } from '@plotflow/core';
import type { Edge, Node } from '@xyflow/react';
import { plotFlowDataToFlow } from '../components/branch-graph/adapter';

export type GraphProjectionResult =
  | { readonly ok: true; readonly nodes: Node[]; readonly edges: Edge[] }
  | { readonly ok: false; readonly error: unknown };

/** Pure orchestration boundary for converting the story AST into flow data. */
export function projectGraphFromAST(data: PlotFlowData): GraphProjectionResult {
  try {
    const projection = plotFlowDataToFlow(data);
    return { ok: true, nodes: projection.nodes, edges: projection.edges };
  } catch (error) {
    return { ok: false, error };
  }
}
