import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test, { after } from "node:test";

import { deleteApp, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

import { getAuthAccountRepository } from "../../api/_lib/auth-accounts-repository.js";
import { issueCsrfToken, SESSION_COOKIE_NAME } from "../../api/_lib/auth-http.js";
import sessionHandler from "../../api/auth/session.js";

interface EmulatorTokenResponseV1 {
  readonly idToken: string;
  readonly localId: string;
}

const authEmulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const firestoreEmulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
const projectId = process.env.NAMESPRING_EMULATOR_PROJECT_ID;

if (!authEmulatorHost || !firestoreEmulatorHost || !projectId) {
  test("Firebase Auth token to session-cookie boundary", {
    skip: "run inside the project Auth + Firestore emulator harness",
  }, () => undefined);
} else {
  assert.match(authEmulatorHost, /^(?:127\.0\.0\.1|localhost):\d{2,5}$/u);
  assert.match(firestoreEmulatorHost, /^(?:127\.0\.0\.1|localhost):\d{2,5}$/u);
  assert.match(projectId, /^demo-[a-z0-9-]{5,40}$/u);
  assert.equal(process.env.GCLOUD_PROJECT, projectId);

  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    project_id: projectId,
    client_email: `auth-session-emulator@${projectId}.iam.gserviceaccount.com`,
    private_key: privateKey,
  });
  process.env.AUTH_ACCOUNT_STORAGE_CUTOVER_STATE = "prelaunch_empty_v1_verified";
  process.env.AUTH_IDENTITY_BINDING_CUTOVER_STATE = "prelaunch_empty_hmac_v2_verified";
  process.env.AUTH_IDENTITY_BINDING_HMAC_KEY = "auth-session-emulator-binding-key-v2-0123456789abcdef";
  process.env.AUTH_ALLOWED_ORIGINS = "http://localhost:5173";
  process.env.AUTH_AUDIT_HMAC_KEY = "auth-session-emulator-audit-key-v1-0123456789abcdef";
  process.env.AUTH_ENABLED_PROVIDERS = "anonymous,email_link";
  process.env.AUTH_RATE_LIMIT_MODE = "disabled";
  process.env.AUTH_TRUSTED_DEV_CLIENT_IP = "127.0.0.1";

  const authApi = `http://${authEmulatorHost}/identitytoolkit.googleapis.com/v1`;
  const email = `upgrade-${Date.now()}@example.test`;
  const password = "emulator-only-password-v1";

  async function authRequest(
    operation: "accounts:signUp" | "accounts:update" | "accounts:signInWithPassword",
    payload: Record<string, unknown>,
  ): Promise<EmulatorTokenResponseV1> {
    const response = await fetch(`${authApi}/${operation}?key=namespring-emulator-key`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json() as EmulatorTokenResponseV1 | { error?: unknown };
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(typeof (body as EmulatorTokenResponseV1).idToken, "string");
    assert.equal(typeof (body as EmulatorTokenResponseV1).localId, "string");
    return body as EmulatorTokenResponseV1;
  }

  async function createSession(
    idToken: string,
    intent: "sync" | "payment" | "sign_in" | "account_upgrade",
  ): Promise<Response> {
    const csrf = issueCsrfToken();
    const csrfCookie = csrf.cookie.split(";", 1)[0];
    const response = await sessionHandler(new Request("http://localhost:5173/api/auth/session", {
      method: "POST",
      headers: {
        Origin: "http://localhost:5173",
        Cookie: csrfCookie,
        "X-CSRF-Token": csrf.response.csrfToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idToken, intent }),
    }));
    assert.ok(response instanceof Response);
    return response;
  }

  function sessionCookieValue(response: Response): string {
    const sessionCookie = response.headers.getSetCookie()
      .find((value) => value.startsWith(`${SESSION_COOKIE_NAME}=`));
    assert.ok(sessionCookie);
    assert.match(sessionCookie, /; Path=\/; Max-Age=\d+; HttpOnly; Secure; SameSite=Lax$/u);
    const value = sessionCookie.slice(`${SESSION_COOKIE_NAME}=`.length).split(";", 1)[0];
    assert.ok(value && value.length > 20);
    return value;
  }

  after(async () => {
    const apps = (() => {
      try {
        return [getApp()];
      } catch {
        return [];
      }
    })();
    await Promise.all(apps.map((app) => deleteApp(app)));
  });

  test("real emulator token promotes one anonymous principal and creates a verifiable hardened session", async () => {
    const anonymous = await authRequest("accounts:signUp", { returnSecureToken: true });
    const implicitUpgrade = await createSession(anonymous.idToken, "account_upgrade");
    assert.equal(implicitUpgrade.status, 409);
    assert.match(await implicitUpgrade.text(), /ACCOUNT_UPGRADE_REQUIRED/u);
    assert.equal((await getFirestore(getApp()).collection("authAccountsV1").get()).empty, true);

    const anonymousSession = await createSession(anonymous.idToken, "sync");
    assert.equal(anonymousSession.status, 200, await anonymousSession.clone().text());
    const anonymousBody = await anonymousSession.clone().json() as Record<string, unknown>;
    assert.equal(JSON.stringify(anonymousBody).includes(anonymous.idToken), false);
    const anonymousCookie = sessionCookieValue(anonymousSession);

    const adminAuth = getAuth(getApp());
    const verifiedAnonymousCookie = await adminAuth.verifySessionCookie(anonymousCookie, true);
    assert.equal(verifiedAnonymousCookie.uid, anonymous.localId);
    assert.equal(verifiedAnonymousCookie.firebase?.sign_in_provider, "anonymous");

    const linked = await authRequest("accounts:update", {
      idToken: anonymous.idToken,
      email,
      password,
      returnSecureToken: true,
    });
    assert.equal(linked.localId, anonymous.localId);
    const signedIn = await authRequest("accounts:signInWithPassword", {
      email,
      password,
      returnSecureToken: true,
    });
    assert.equal(signedIn.localId, anonymous.localId);

    const upgradedSession = await createSession(signedIn.idToken, "sign_in");
    assert.equal(upgradedSession.status, 200, await upgradedSession.clone().text());
    const upgradedText = await upgradedSession.clone().text();
    assert.equal(upgradedText.includes(signedIn.idToken), false);
    assert.equal(upgradedText.includes(anonymous.localId), false);
    assert.equal(upgradedText.includes(email), false);
    const upgradedCookie = sessionCookieValue(upgradedSession);
    const verifiedUpgradedCookie = await adminAuth.verifySessionCookie(upgradedCookie, true);
    assert.equal(verifiedUpgradedCookie.uid, anonymous.localId);
    assert.equal(verifiedUpgradedCookie.firebase?.sign_in_provider, "password");

    const db = getFirestore(getApp());
    const [accounts, principals, bindings, audits] = await Promise.all([
      db.collection("authAccountsV1").get(),
      db.collection("authFirebasePrincipalsV1").get(),
      db.collection("authIdentityBindingsV1").get(),
      db.collection("authAuditEventsV1").get(),
    ]);
    assert.equal(accounts.size, 1);
    assert.equal(principals.size, 1);
    assert.equal(bindings.size, 2);
    assert.equal(audits.size, 2);
    const account = accounts.docs[0]?.data();
    assert.deepEqual(account?.roles, ["user"]);
    assert.deepEqual(account?.firebaseUids, [anonymous.localId]);
    assert.equal(account?.status, "active");
    assert.equal(account?.deleteAfter, null);
    assert.deepEqual(
      (account?.providers as Array<{ provider: string }>).map(({ provider }) => provider).sort(),
      ["anonymous", "email_link"],
    );
    assert.equal(JSON.stringify(bindings.docs.map((document) => document.data())).includes(email), false);

    await accounts.docs[0]!.ref.delete();
    await assert.rejects(
      () => getAuthAccountRepository().getActiveByFirebaseUid(anonymous.localId),
      (error: unknown) => (error as { code?: string }).code === "AUTH_REPOSITORY_INTEGRITY_ERROR",
    );
  });
}
