declare module 'crypto' {
  export interface Hash {
    update(data: string | ArrayBuffer | Uint8Array, inputEncoding?: string): Hash;
    digest(encoding: 'hex' | 'base64'): string;
  }

  export function createHash(algorithm: string): Hash;
}
