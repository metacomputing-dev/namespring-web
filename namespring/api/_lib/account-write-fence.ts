import type {
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  Transaction,
} from "firebase-admin/firestore";
import { ApiHttpError } from "./http.js";

export const ACCOUNT_DELETION_FENCE_COLLECTION_V1 = "accountDeletionFencesV1" as const;
export const ACCOUNT_PAYMENT_LEASE_COLLECTION_V1 = "accountPaymentLeasesV1" as const;

export interface AccountDeletionFenceRecordV1 {
  readonly schemaVersion: "namespring.account-deletion-fence.v1";
  readonly createdAt: string;
  readonly deletionRequestId: string;
}

export function accountDeletionFenceRefV1(
  db: Firestore,
  internalUserId: string,
): DocumentReference {
  return db.collection(ACCOUNT_DELETION_FENCE_COLLECTION_V1).doc(internalUserId);
}

/**
 * A payment confirmation lease bridges the non-transactional provider call.
 * Account deletion must read this document in the same transaction that
 * creates the deletion fence. A surviving lease is deliberately fail-closed:
 * an operator reconciles the payment first, then retries deletion.
 */
export function accountPaymentLeaseRefV1(
  db: Firestore,
  internalUserId: string,
): DocumentReference {
  return db.collection(ACCOUNT_PAYMENT_LEASE_COLLECTION_V1).doc(internalUserId);
}

export function assertNoPaymentConfirmationLeaseV1(
  snapshot: Pick<DocumentSnapshot, "exists">,
): void {
  if (snapshot.exists) {
    throw new ApiHttpError(
      409,
      "PAYMENT_RECONCILIATION_REQUIRED",
      "A payment confirmation must be reconciled before this account can be deleted.",
    );
  }
}

export function assertAccountWriteFenceOpenV1(
  snapshot: Pick<DocumentSnapshot, "exists">,
): void {
  if (snapshot.exists) {
    throw new ApiHttpError(
      409,
      "ACCOUNT_DELETION_IN_PROGRESS",
      "Account data is being deleted and cannot accept new server-side writes.",
    );
  }
}

/**
 * Every personal-data mutation reads this document in its Firestore
 * transaction before the first write. Creating the fence during account
 * deletion therefore conflicts with an already-running transaction and makes
 * Firestore retry it against the closed fence.
 */
export async function assertAccountWriteAllowedV1(
  transaction: Transaction,
  db: Firestore,
  internalUserId: string,
): Promise<void> {
  const snapshot = await transaction.get(accountDeletionFenceRefV1(db, internalUserId));
  assertAccountWriteFenceOpenV1(snapshot);
}
