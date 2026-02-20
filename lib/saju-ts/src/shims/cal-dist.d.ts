// Optional dependency shim for the vendored ./cal package build output.
//
// The core engine does not require ./cal, but src/calendar/calTimeAdapter.ts
// can delegate to it when available.
//
// In the repository, cal/dist may not exist until the user runs:
//   npm -C cal ci && npm -C cal run build
//
// This declaration prevents TypeScript from erroring on the dynamic import.

declare module '../../cal/dist/src/index.js' {
  export function calculateSajuPillars(args: any): any;
}
