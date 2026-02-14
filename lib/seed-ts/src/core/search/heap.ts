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

  toArray(): T[] {
    return [...this.data];
  }

  push(value: T): void {
    this.data.push(value);
    this.heapifyUp(this.data.length - 1);
  }

  replaceTop(value: T): void {
    if (this.data.length === 0) {
      this.data.push(value);
      return;
    }
    this.data[0] = value;
    this.heapifyDown(0);
  }

  private heapifyUp(index: number): void {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      if (this.compare(this.data[current] as T, this.data[parent] as T) >= 0) {
        break;
      }
      const temp = this.data[current] as T;
      this.data[current] = this.data[parent] as T;
      this.data[parent] = temp;
      current = parent;
    }
  }

  private heapifyDown(index: number): void {
    let current = index;
    const length = this.data.length;
    while (true) {
      const leftChild = current * 2 + 1;
      const rightChild = current * 2 + 2;
      let smallest = current;
      if (leftChild < length && this.compare(this.data[leftChild] as T, this.data[smallest] as T) < 0) {
        smallest = leftChild;
      }
      if (rightChild < length && this.compare(this.data[rightChild] as T, this.data[smallest] as T) < 0) {
        smallest = rightChild;
      }
      if (smallest === current) {
        break;
      }
      const temp = this.data[current] as T;
      this.data[current] = this.data[smallest] as T;
      this.data[smallest] = temp;
      current = smallest;
    }
  }
}
