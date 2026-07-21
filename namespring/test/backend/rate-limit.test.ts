import assert from "node:assert/strict";
import test from "node:test";

import { evaluateRateLimitWindowV1 } from "../../api/_lib/rate-limit.js";

const policy = { scope: "auth.session", limit: 2, windowSeconds: 60 } as const;

test("rate limit consumes exactly the configured number of requests", () => {
  const first = evaluateRateLimitWindowV1(null, policy, 1_000);
  assert.equal(first.allowed, true);
  assert.equal(first.remaining, 1);

  const second = evaluateRateLimitWindowV1(first.nextState, policy, 2_000);
  assert.equal(second.allowed, true);
  assert.equal(second.remaining, 0);

  const denied = evaluateRateLimitWindowV1(second.nextState, policy, 3_000);
  assert.equal(denied.allowed, false);
  assert.equal(denied.remaining, 0);
  assert.deepEqual(denied.nextState, second.nextState);
});

test("rate limit resets after the fixed window and rejects clock rollback", () => {
  const prior = evaluateRateLimitWindowV1(null, policy, 1_000).nextState;
  const reset = evaluateRateLimitWindowV1(prior, policy, 61_000);
  assert.equal(reset.allowed, true);
  assert.equal(reset.remaining, 1);
  assert.equal(reset.nextState.windowStartedAtMs, 61_000);

  const rolledBack = evaluateRateLimitWindowV1(prior, policy, 999);
  assert.equal(rolledBack.nextState.windowStartedAtMs, 999);
  assert.equal(rolledBack.nextState.count, 1);
});
