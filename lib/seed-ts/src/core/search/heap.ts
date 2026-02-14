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
    let i = index;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (this.compare(this.data[i] as T, this.data[p] as T) >= 0) {
        break;
      }
      const t = this.data[i] as T;
      this.data[i] = this.data[p] as T;
      this.data[p] = t;
      i = p;
    }
  }

  private heapifyDown(index: number): void {
    let i = index;
    const n = this.data.length;
    while (true) {
      const l = i * 2 + 1;
      const r = i * 2 + 2;
      let s = i;
      if (l < n && this.compare(this.data[l] as T, this.data[s] as T) < 0) {
        s = l;
      }
      if (r < n && this.compare(this.data[r] as T, this.data[s] as T) < 0) {
        s = r;
      }
      if (s === i) {
        break;
      }
      const t = this.data[i] as T;
      this.data[i] = this.data[s] as T;
      this.data[s] = t;
      i = s;
    }
  }
}
