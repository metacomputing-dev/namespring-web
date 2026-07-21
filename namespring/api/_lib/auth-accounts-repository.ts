/**
 * Stable compatibility barrel for the auth account repository.
 *
 * Implementations live behind dependency-directed modules so importing the
 * public contract does not create a cycle between the in-memory test double,
 * Firestore codecs, and the production repository.
 */
export * from "./auth-accounts-contract.js";
export {
  authJobBackoffMsForAttemptV1,
  toPublicProviderSummaries,
} from "./auth-accounts-lifecycle.js";
export { InMemoryAuthAccountRepository } from "./auth-accounts-in-memory.js";
export { FirestoreAuthAccountRepository } from "./auth-accounts-firestore.js";

import type { AuthAccountRepository } from "./auth-accounts-contract.js";
import { FirestoreAuthAccountRepository } from "./auth-accounts-firestore.js";
import { getAuthIdentityBindingHmacKeyV2 } from "./auth-identity.js";
import { getFirestoreDb } from "./firestore-admin.js";
import { ApiHttpError } from "./http.js";

export const AUTH_ACCOUNT_STORAGE_CUTOVER_STATES_V1 = [
  "prelaunch_empty_v1_verified",
  "legacy_v1_migration_verified",
] as const;

export const AUTH_IDENTITY_BINDING_CUTOVER_STATES_V2 = [
  "prelaunch_empty_hmac_v2_verified",
  "legacy_sha256_to_hmac_v2_migration_verified",
] as const;

/**
 * Source history cannot prove that a deployed Firestore project is empty.
 * Require an operator attestation before the strict v1 codec can read or write
 * the security-critical account collections.
 */
export function assertAuthAccountStorageCutoverReadyV1(): void {
  const state = process.env.AUTH_ACCOUNT_STORAGE_CUTOVER_STATE?.trim() ?? "";
  if (!(AUTH_ACCOUNT_STORAGE_CUTOVER_STATES_V1 as readonly string[]).includes(state)) {
    throw new ApiHttpError(
      503,
      "AUTH_ACCOUNT_STORAGE_CUTOVER_REQUIRED",
      "Authentication account storage requires a verified empty-store or completed-migration attestation.",
    );
  }
  const bindingState = process.env.AUTH_IDENTITY_BINDING_CUTOVER_STATE?.trim() ?? "";
  const expectedBindingState = state === "prelaunch_empty_v1_verified"
    ? "prelaunch_empty_hmac_v2_verified"
    : "legacy_sha256_to_hmac_v2_migration_verified";
  if (!(AUTH_IDENTITY_BINDING_CUTOVER_STATES_V2 as readonly string[]).includes(bindingState)
    || bindingState !== expectedBindingState) {
    throw new ApiHttpError(
      503,
      "AUTH_IDENTITY_BINDING_CUTOVER_REQUIRED",
      "Authentication identity bindings require a verified empty-store or completed SHA-to-HMAC migration attestation.",
    );
  }
  // Validate both entropy and cross-domain independence before any Firestore
  // account collection can be opened. There is no runtime SHA compatibility
  // fallback because it would restore the low-entropy offline oracle.
  getAuthIdentityBindingHmacKeyV2();
}

let repository: AuthAccountRepository | null = null;

export function getAuthAccountRepository(): AuthAccountRepository {
  if (!repository) {
    assertAuthAccountStorageCutoverReadyV1();
    repository = new FirestoreAuthAccountRepository(getFirestoreDb());
  }
  return repository;
}

export function setAuthAccountRepositoryForTests(next: AuthAccountRepository | null): void {
  repository = next;
}
