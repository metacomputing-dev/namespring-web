import { cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getOptionalEnv } from "./env.js";
import { ApiHttpError } from "./http.js";

let cachedFirestore: Firestore | null = null;

type RawServiceAccount = ServiceAccount & {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

function normalizePrivateKey(value: string): string {
  return value.replace(/\\n/g, "\n");
}

function parseServiceAccountFromJson(raw: string): ServiceAccount {
  let parsed: RawServiceAccount;

  try {
    parsed = JSON.parse(raw) as RawServiceAccount;
  } catch (error) {
    throw new ApiHttpError(500, "INVALID_FIREBASE_CONFIG", "FIREBASE_SERVICE_ACCOUNT_JSON must be valid JSON.", error);
  }

  const projectId = parsed.projectId ?? parsed.project_id;
  const clientEmail = parsed.clientEmail ?? parsed.client_email;
  const privateKeyRaw = parsed.privateKey ?? parsed.private_key;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new ApiHttpError(
      500,
      "INVALID_FIREBASE_CONFIG",
      "FIREBASE_SERVICE_ACCOUNT_JSON must include project_id/client_email/private_key.",
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey: normalizePrivateKey(privateKeyRaw),
  };
}

function parseServiceAccountFromSplitEnv(): ServiceAccount {
  const projectId = getOptionalEnv("FIREBASE_PROJECT_ID");
  const clientEmail = getOptionalEnv("FIREBASE_CLIENT_EMAIL");
  const privateKeyRaw = getOptionalEnv("FIREBASE_PRIVATE_KEY");

  if (!projectId || !clientEmail || !privateKeyRaw) {
    throw new ApiHttpError(
      500,
      "MISSING_FIREBASE_CONFIG",
      "Firebase credentials are missing. Set FIREBASE_SERVICE_ACCOUNT_JSON or split FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.",
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey: normalizePrivateKey(privateKeyRaw),
  };
}

function resolveServiceAccount(): ServiceAccount {
  const serviceAccountJson = getOptionalEnv("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (serviceAccountJson) {
    return parseServiceAccountFromJson(serviceAccountJson);
  }
  return parseServiceAccountFromSplitEnv();
}

export function getFirestoreDb(): Firestore {
  if (cachedFirestore) {
    return cachedFirestore;
  }

  if (!getApps().length) {
    const serviceAccount = resolveServiceAccount();
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId,
    });
  }

  cachedFirestore = getFirestore();
  return cachedFirestore;
}
