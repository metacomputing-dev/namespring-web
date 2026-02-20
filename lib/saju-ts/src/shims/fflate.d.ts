declare module 'fflate' {
  export type Zippable = Record<string, Uint8Array>;

  export function strToU8(str: string, latin1?: boolean): Uint8Array;
  export function strFromU8(dat: Uint8Array, latin1?: boolean): string;

  export function zipSync(data: Zippable, opts?: { level?: number }): Uint8Array;
  export function unzipSync(data: Uint8Array): Zippable;
}
