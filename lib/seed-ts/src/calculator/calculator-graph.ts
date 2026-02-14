import type { Frame } from "../core/types.js";

export interface CalculatorSignal {
  key: string;
  frame: Frame;
  score: number;
  isPassed: boolean;
  weight: number;
}

export interface CalculatorPacket {
  nodeId: string;
  signals: CalculatorSignal[];
}

export interface CalculatorNode<TContext> {
  id: string;
  preVisit?(context: TContext): void;
  visit?(context: TContext): void;
  postVisit?(context: TContext, packet: CalculatorPacket): void;
  createChildren?(context: TContext): CalculatorNode<TContext>[];
  backward?(context: TContext, childPackets: readonly CalculatorPacket[]): CalculatorPacket;
}

export function executeCalculatorNode<TContext>(
  node: CalculatorNode<TContext>,
  context: TContext,
): CalculatorPacket {
  node.preVisit?.(context);
  node.visit?.(context);

  const children = node.createChildren?.(context) ?? [];
  const childPackets = children.map((child) => executeCalculatorNode(child, context));

  const packet =
    node.backward?.(context, childPackets) ?? {
      nodeId: node.id,
      signals: [],
    };
  node.postVisit?.(context, packet);
  return packet;
}

export function flattenSignals(packets: readonly CalculatorPacket[]): CalculatorSignal[] {
  const out: CalculatorSignal[] = [];
  for (const packet of packets) {
    out.push(...packet.signals);
  }
  return out;
}
