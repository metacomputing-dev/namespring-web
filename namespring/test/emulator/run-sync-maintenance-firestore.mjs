// Backward-compatible wrapper. New CI and release instructions use the
// aggregate maintenance command so auth CAS/fencing cannot silently lose its
// real Firestore gate while sync retention remains green.
await import("./run-maintenance-firestore.mjs");
