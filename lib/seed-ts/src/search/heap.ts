/** Generic min-heap for TopK selection */
export class MinHeap<T> {
  private readonly data: T[] = [];
  private readonly compare: (a: T, b: T) => number;

  constructor(compare: (a: T, b: T) => number) {
    this.compare = compare;
  }

  size(): number {
    return this.data.length;
  }

  peek(): T | undefined {
    return this.data[0];
  }

  push(item: T): void {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const top = this.data[0];
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  replaceTop(item: T): void {
    if (this.data.length === 0) {
      this.data.push(item);
      return;
    }
    this.data[0] = item;
    this.sinkDown(0);
  }

  toArray(): T[] {
    return [...this.data];
  }

  private bubbleUp(idx: number): void {
    while (idx > 0) {
      const parent = Math.floor((idx - 1) / 2);
      if (this.compare(this.data[idx], this.data[parent]) >= 0) break;
      [this.data[idx], this.data[parent]] = [this.data[parent], this.data[idx]];
      idx = parent;
    }
  }

  private sinkDown(idx: number): void {
    const length = this.data.length;
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;
      if (left < length && this.compare(this.data[left], this.data[smallest]) < 0) {
        smallest = left;
      }
      if (right < length && this.compare(this.data[right], this.data[smallest]) < 0) {
        smallest = right;
      }
      if (smallest === idx) break;
      [this.data[idx], this.data[smallest]] = [this.data[smallest], this.data[idx]];
      idx = smallest;
    }
  }
}

/** Push item into heap if it should be in top-K */
export function pushTopK<T>(heap: MinHeap<T>, item: T, capacity: number, scoreAccessor: (item: T) => number): void {
  if (capacity <= 0) return;
  if (heap.size() < capacity) {
    heap.push(item);
    return;
  }
  const min = heap.peek();
  if (min && scoreAccessor(item) > scoreAccessor(min)) {
    heap.replaceTop(item);
  }
}
