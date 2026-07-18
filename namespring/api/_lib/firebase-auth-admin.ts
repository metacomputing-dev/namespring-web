import { getApp } from "firebase-admin/app";
import { getAuth, type Auth, type DecodedIdToken } from "firebase-admin/auth";
import { getFirestoreDb } from "./firestore-admin.js";
import { ApiHttpError } from "./http.js";

let cachedAuth: Auth | null = null;

/** Uses the same Firebase Admin app/credentials as Firestore. */
export function getFirebaseAuth(): Auth {
  if (cachedAuth) {
    return cachedAuth;
  }

  // The existing Firestore accessor owns one-time Admin app initialization.
  getFirestoreDb();
  cachedAuth = getAuth(getApp());
  return cachedAuth;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedIdToken> {
  const auth = getFirebaseAuth();
  try {
    return await auth.verifyIdToken(idToken, true);
  } catch {
    throw new ApiHttpError(401, "ID_TOKEN_INVALID", "The Firebase ID token is invalid or revoked.");
  }
}

/** Test-only seam; production code should always use the initialized Admin app. */
export function setFirebaseAuthForTests(next: Auth | null): void {
  cachedAuth = next;
}
