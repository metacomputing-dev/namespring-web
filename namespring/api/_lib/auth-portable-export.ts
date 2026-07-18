import type {
  AccountExportResponse,
  AccountPortableExportManifestV1,
} from "../../shared/types/auth.js";

export const ACCOUNT_PORTABLE_EXPORT_ENDPOINTS_V1 = {
  sync: {
    delivery: "authenticated_endpoint",
    method: "GET",
    href: "/api/v1/sync/export",
    expectedSchemaVersion: "namespring.account-sync-export.v1",
    snapshot: "at_section_fetch",
    bounds: {
      maxItems: 100,
      maxResponseBytes: 768 * 1024,
      overflow: "fail_closed",
    },
  },
  premium: {
    delivery: "authenticated_endpoint",
    method: "GET",
    href: "/api/v1/premium/account/export",
    expectedSchemaVersion: "namespring.premium-account-export.v1",
    snapshot: "at_section_fetch",
    bounds: {
      maxItems: 1_000,
      maxResponseBytes: 3 * 1024 * 1024,
      overflow: "fail_closed",
    },
  },
} as const;

export function createAccountPortableExportManifestV1(
  auth: AccountExportResponse,
  generatedAt: string = new Date().toISOString(),
): AccountPortableExportManifestV1 {
  return {
    schemaVersion: "namespring.account-portable-export-manifest.v1",
    generatedAt,
    userId: auth.account.userId,
    consistency: "independent_section_snapshots",
    sections: {
      auth: {
        delivery: "inline",
        expectedSchemaVersion: "auth-account-export.v1",
        snapshot: "at_manifest_generation",
        data: auth,
      },
      sync: ACCOUNT_PORTABLE_EXPORT_ENDPOINTS_V1.sync,
      premium: ACCOUNT_PORTABLE_EXPORT_ENDPOINTS_V1.premium,
    },
    includedScopes: ["auth", "sync", "premium"],
  };
}
