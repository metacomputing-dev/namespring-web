import type { TraceNode } from '../api/types.js';
import type { Context, Graph } from './types.js';

export function evaluate(
  graph: Graph,
  ctx: Context,
  wanted: string[],
): {
  results: Map<string, unknown>;
  trace: { nodes: TraceNode[]; edges: Array<{ from: string; to: string }> };
} {
  const cache = new Map<string, unknown>();
  const visiting = new Set<string>();
  const traceNodes: TraceNode[] = [];
  const edges: Array<{ from: string; to: string }> = [];

  const uniqEdge = (from: string, to: string) => `${from}→${to}`;
  const seenEdges = new Set<string>();

  const get = <U>(id: string): U => {
    if (cache.has(id)) return cache.get(id) as U;
    if (visiting.has(id)) throw new Error(`Cycle detected at node: ${id}`);

    const node = graph.get(id);
    if (!node) throw new Error(`Unknown node id: ${id}`);

    visiting.add(id);

    const input: Record<string, unknown> = {};
    for (const dep of node.deps) {
      const v = get(dep);
      input[dep] = v;

      const k = uniqEdge(dep, id);
      if (!seenEdges.has(k)) {
        seenEdges.add(k);
        edges.push({ from: dep, to: id });
      }
    }

    const output = node.compute(ctx, get);
    cache.set(id, output);

    traceNodes.push({
      id: node.id,
      deps: [...node.deps],
      formula: node.formula,
      explain: node.explain,
      input,
      output,
    });

    visiting.delete(id);
    return output as U;
  };

  for (const id of wanted) get(id);

  return {
    results: cache,
    trace: {
      nodes: traceNodes,
      edges,
    },
  };
}
