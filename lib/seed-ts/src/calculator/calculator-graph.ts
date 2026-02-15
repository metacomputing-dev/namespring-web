/** Signal emitted by a calculator node during backward propagation */
export interface CalculatorSignal {
  key: string;
  frame: string;
  score: number;
  isPassed: boolean;
  weight: number;
}

/** Packet containing signals from a calculator node */
export interface CalculatorPacket {
  nodeId: string;
  signals: CalculatorSignal[];
}

/** Calculator node in the evaluation DAG */
export interface CalculatorNode<TContext> {
  id: string;
  preVisit?(context: TContext): void;
  visit?(context: TContext): void;
  postVisit?(context: TContext, packet: CalculatorPacket): void;
  createChildren?(context: TContext): CalculatorNode<TContext>[];
  backward?(context: TContext, childPackets: readonly CalculatorPacket[]): CalculatorPacket;
}

/** Execute a calculator node and its children recursively */
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

/** Flatten signals from multiple packets */
export function flattenSignals(packets: readonly CalculatorPacket[]): CalculatorSignal[] {
  const out: CalculatorSignal[] = [];
  for (const packet of packets) {
    out.push(...packet.signals);
  }
  return out;
}
