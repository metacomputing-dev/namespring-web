import type { Frame } from "./types.js";

export interface EvaluationSignal {
  key: string;
  frame: Frame;
  score: number;
  isPassed: boolean;
  weight: number;
}

export interface EvaluationNodePacket {
  nodeId: string;
  signals: EvaluationSignal[];
}

export interface EvaluationNode<TContext> {
  id: string;
  forward?(context: TContext): void;
  createChildren?(context: TContext): EvaluationNode<TContext>[];
  backward?(context: TContext, childPackets: readonly EvaluationNodePacket[]): EvaluationNodePacket;
}

export function executeEvaluationNode<TContext>(
  node: EvaluationNode<TContext>,
  context: TContext,
): EvaluationNodePacket {
  node.forward?.(context);

  const children = node.createChildren?.(context) ?? [];
  const childPackets = children.map((child) => executeEvaluationNode(child, context));

  return (
    node.backward?.(context, childPackets) ?? {
      nodeId: node.id,
      signals: [],
    }
  );
}

export function flattenSignals(packets: readonly EvaluationNodePacket[]): EvaluationSignal[] {
  const out: EvaluationSignal[] = [];
  for (const packet of packets) {
    out.push(...packet.signals);
  }
  return out;
}
