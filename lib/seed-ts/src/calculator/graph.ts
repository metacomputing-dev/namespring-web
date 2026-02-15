export interface CalculatorSignal {
  key: string;
  frame: string;
  score: number;
  isPassed: boolean;
  weight: number;
}

export interface CalculatorPacket {
  nodeId: string;
  signals: CalculatorSignal[];
}

export interface CalculatorNode<T> {
  id: string;
  visit?(context: T): void;
  createChildren?(context: T): CalculatorNode<T>[];
  backward?(context: T, childPackets: readonly CalculatorPacket[]): CalculatorPacket;
}

export function executeCalculatorNode<T>(
  node: CalculatorNode<T>,
  context: T,
): CalculatorPacket {
  node.visit?.(context);
  const children = node.createChildren?.(context) ?? [];
  const childPackets = children.map((c) => executeCalculatorNode(c, context));
  return node.backward?.(context, childPackets) ?? { nodeId: node.id, signals: [] };
}

export function flattenSignals(packets: readonly CalculatorPacket[]): CalculatorSignal[] {
  return packets.flatMap((p) => p.signals);
}
