import { createHash, createHmac } from "node:crypto";
import type { DecodedIdToken } from "firebase-admin/auth";
import { AUTH_PROVIDERS, type AuthProvider } from "../../shared/types/auth.js";
import { ApiHttpError } from "./http.js";
import {
  configuredGenericOidcFirebaseProviderIds,
  configuredKakaoFirebaseProviderId,
} from "./auth-policy.js";
import { assertServerSecretSeparationV1 } from "./server-secret-separation.js";

export interface VerifiedProviderIdentity {
  provider: AuthProvider;
  issuer: string;
  /** Transient verified subject. Repositories persist only its digest. */
  subject: string;
  firebaseProviderId: string;
}

export type AuthIdentityBindingDigestV2 = `hmac-sha256:v2:${string}`;
export type AuthIdentityBindingDigesterV2 = (
  identity: VerifiedProviderIdentity,
) => AuthIdentityBindingDigestV2;

export const AUTH_IDENTITY_BINDING_DIGEST_V2_PATTERN = /^hmac-sha256:v2:[a-f0-9]{64}$/u;
const AUTH_IDENTITY_BINDING_DOMAIN_V2 = "namespring/auth/provider-identity-binding/v2";

function identityBindingMaterialV2(identity: VerifiedProviderIdentity): string {
  const boundedText = (value: unknown): value is string => typeof value === "string"
    && value.length >= 1
    && value.length <= 512
    && !/[\u0000-\u001f\u007f]/u.test(value);
  if (!(AUTH_PROVIDERS as readonly string[]).includes(identity.provider)
    || !boundedText(identity.issuer)
    || !boundedText(identity.subject)
    || typeof identity.firebaseProviderId !== "string"
    || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(identity.firebaseProviderId)) {
    throw new ApiHttpError(500, "AUTH_IDENTITY_BINDING_INPUT_INVALID", "Verified provider identity is malformed.");
  }
  return `${AUTH_IDENTITY_BINDING_DOMAIN_V2}\u0000${JSON.stringify({
    provider: identity.provider,
    issuer: identity.issuer,
    firebaseProviderId: identity.firebaseProviderId,
    subject: identity.subject,
  })}`;
}

const FIXED_ISSUERS: Partial<Record<AuthProvider, string>> = {
  anonymous: "firebase:anonymous",
  google: "https://accounts.google.com",
  kakao_oidc: "https://kauth.kakao.com",
  email_link: "firebase:email-link",
  apple: "https://appleid.apple.com",
  phone: "firebase:phone",
  facebook: "https://www.facebook.com",
};

export function digestIdentityPart(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function assertAuthIdentityBindingHmacKeyV2(value: string): string {
  if (typeof value !== "string"
    || value.trim() !== value
    || /[\u0000-\u001f\u007f]/u.test(value)
    || Buffer.byteLength(value, "utf8") < 32
    || Buffer.byteLength(value, "utf8") > 256) {
    throw new ApiHttpError(
      503,
      "AUTH_IDENTITY_BINDING_KEY_INVALID",
      "Authentication identity binding requires a dedicated 32-256 byte server secret.",
    );
  }
  assertServerSecretSeparationV1(
    "auth_identity_binding",
    [value],
    "AUTH_IDENTITY_BINDING_KEY_REUSE",
  );
  return value;
}

export function getAuthIdentityBindingHmacKeyV2(): string {
  return assertAuthIdentityBindingHmacKeyV2(process.env.AUTH_IDENTITY_BINDING_HMAC_KEY ?? "");
}

/**
 * Stable provider-binding pseudonym. The explicit domain/version prefix and
 * field labels prevent this key from becoming a general-purpose hash oracle.
 * The raw provider subject remains transient and must never be persisted.
 */
export function identityBindingDigest(
  identity: VerifiedProviderIdentity,
  hmacKey: string,
): AuthIdentityBindingDigestV2 {
  const key = assertAuthIdentityBindingHmacKeyV2(hmacKey);
  const material = identityBindingMaterialV2(identity);
  return `hmac-sha256:v2:${createHmac("sha256", key).update(material, "utf8").digest("hex")}`;
}

export function createAuthIdentityBindingDigesterV2(
  hmacKey: string,
): AuthIdentityBindingDigesterV2 {
  const key = assertAuthIdentityBindingHmacKeyV2(hmacKey);
  return (identity) => {
    const material = identityBindingMaterialV2(identity);
    return `hmac-sha256:v2:${createHmac("sha256", key).update(material, "utf8").digest("hex")}`;
  };
}

export function getAuthIdentityBindingDigesterV2(): AuthIdentityBindingDigesterV2 {
  return createAuthIdentityBindingDigesterV2(getAuthIdentityBindingHmacKeyV2());
}

export function authProviderFromFirebaseId(providerId: string): AuthProvider {
  switch (providerId) {
    case "anonymous":
      return "anonymous";
    case "google.com":
      return "google";
    case "password":
    case "emailLink":
      // This product enables passwordless email-link auth, not password auth.
      return "email_link";
    case "apple.com":
      return "apple";
    case "phone":
      return "phone";
    case "facebook.com":
      return "facebook";
    default:
      if (providerId.startsWith("oidc.")) {
        const kakaoProviderId = configuredKakaoFirebaseProviderId();
        const genericProviderIds = configuredGenericOidcFirebaseProviderIds();
        if (providerId === kakaoProviderId) return "kakao_oidc";
        if (genericProviderIds.includes(providerId)) return "oidc";
      }
      throw new ApiHttpError(403, "AUTH_PROVIDER_NOT_ALLOWED", `Unsupported authentication provider: ${providerId}`);
  }
}

function providerIdsFor(decoded: DecodedIdToken): string[] {
  const identities = decoded.firebase?.identities ?? {};
  return Object.keys(identities).filter((key) => Array.isArray(identities[key]) && identities[key].length > 0);
}

function findFirebaseProviderId(decoded: DecodedIdToken, provider: AuthProvider): string | null {
  const candidates = providerIdsFor(decoded);
  const matched = candidates.filter((candidate) => {
    try {
      return authProviderFromFirebaseId(candidate) === provider;
    } catch {
      return false;
    }
  });
  if (matched.length > 1) {
    throw new ApiHttpError(
      409,
      "PROVIDER_IDENTITY_AMBIGUOUS",
      "More than one verified identity matches that provider family; choose an exact configured provider.",
    );
  }
  if (matched.length === 1) {
    return matched[0];
  }

  const signInProvider = decoded.firebase?.sign_in_provider;
  if (typeof signInProvider === "string") {
    try {
      if (authProviderFromFirebaseId(signInProvider) === provider) {
        return signInProvider;
      }
    } catch {
      // The explicit requested provider still fails below with a stable error.
    }
  }
  return null;
}

function subjectFor(decoded: DecodedIdToken, provider: AuthProvider, providerId: string): string {
  // Never use an email address or phone number as an account-merge key. Those
  // providers bind to the Firebase principal and require explicit client-side
  // account linking/reauthentication for consolidation.
  if (provider === "anonymous" || provider === "email_link" || provider === "phone") {
    return decoded.uid;
  }

  const values = decoded.firebase?.identities?.[providerId];
  const subjects = Array.isArray(values)
    ? [...new Set(values.filter((value): value is string => (
        typeof value === "string"
        && value.length > 0
        && value.length <= 512
        && !/[\u0000-\u001f\u007f]/u.test(value)
      )))]
    : [];
  if (subjects.length === 0) {
    // A Firebase UID proves only the Firebase principal. Treating it as a
    // Google/Kakao/Apple/OIDC subject would create a provider-labelled binding
    // that cannot be re-verified or recovered against providerData later.
    throw new ApiHttpError(
      403,
      "PROVIDER_SUBJECT_NOT_VERIFIED",
      "The verified token does not contain an exact provider subject.",
    );
  }
  if (subjects.length !== 1) {
    throw new ApiHttpError(
      409,
      "PROVIDER_IDENTITY_AMBIGUOUS",
      "The verified token contains more than one provider subject.",
    );
  }
  return subjects[0]!;
}

function issuerFor(decoded: DecodedIdToken, provider: AuthProvider, providerId: string): string {
  if (provider === "oidc") {
    return `firebase-oidc:${providerId}`;
  }
  return FIXED_ISSUERS[provider] ?? decoded.iss;
}

export function extractProviderIdentity(
  decoded: DecodedIdToken,
  requestedProvider?: AuthProvider,
): VerifiedProviderIdentity {
  const signInProvider = decoded.firebase?.sign_in_provider;
  let provider: AuthProvider;
  let firebaseProviderId: string;

  if (requestedProvider) {
    provider = requestedProvider;
    const found = findFirebaseProviderId(decoded, provider);
    if (!found) {
      throw new ApiHttpError(403, "PROVIDER_IDENTITY_NOT_VERIFIED", "The verified token does not contain that provider identity.");
    }
    firebaseProviderId = found;
  } else {
    if (typeof signInProvider !== "string" || !signInProvider) {
      throw new ApiHttpError(403, "AUTH_PROVIDER_MISSING", "The verified token has no sign-in provider.");
    }
    provider = authProviderFromFirebaseId(signInProvider);
    firebaseProviderId = signInProvider;
  }

  // `emailLink` is a sign-in *method*, while Firebase's provider identifier is
  // always `password` for both email/password and passwordless email-link
  // accounts. Admin `providersToUnlink` and UserRecord.providerData both use
  // the provider identifier, so never persist the method name into an unlink
  // reservation.
  const adminProviderId = provider === "email_link" ? "password" : firebaseProviderId;

  return {
    provider,
    firebaseProviderId: adminProviderId,
    issuer: issuerFor(decoded, provider, firebaseProviderId),
    subject: subjectFor(decoded, provider, firebaseProviderId),
  };
}

export function assertRecentAuthentication(decoded: DecodedIdToken, maxAgeSeconds: number): void {
  const authTime = Number(decoded.auth_time);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(authTime) || authTime <= 0 || nowSeconds - authTime > maxAgeSeconds || authTime > nowSeconds + 60) {
    throw new ApiHttpError(401, "RECENT_AUTH_REQUIRED", "Recent provider authentication is required.");
  }
}

export function tokenHasRole(decoded: DecodedIdToken, role: string): boolean {
  if (role === "admin" && decoded.admin === true) {
    return true;
  }
  const roles = decoded.roles;
  return Array.isArray(roles) && roles.includes(role);
}
