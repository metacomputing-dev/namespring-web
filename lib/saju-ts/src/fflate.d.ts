// Minimal ambient declarations for the optional runtime dependency `fflate`.
//
// This project ships refactor zips without `node_modules`.
// Consumers should install dependencies via npm/yarn/pnpm.
//
// Types are intentionally loose to avoid coupling to a specific fflate version.

declare module 'fflate' {
  export function strFromU8(data: Uint8Array, opts?: any): string;
  export function strToU8(str: string, opts?: any): Uint8Array;
  export function zipSync(files: Record<string, Uint8Array>, opts?: any): Uint8Array;
  export function unzipSync(data: Uint8Array, opts?: any): Record<string, Uint8Array>;
}
