import inmyeongyongFullData from '../data/inmyeongyong_9389_full.json';

// This module is the single static boundary around the 1.09 MB metadata asset.
// It must only be reached through the literal dynamic import in
// full-hanja-pool-loader.ts so the default browser bundle can split it out.
export const fullHanjaPoolData: unknown = inmyeongyongFullData;
