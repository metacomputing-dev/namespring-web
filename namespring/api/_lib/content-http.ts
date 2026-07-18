import type { ContentActorV1 } from "./content-service.js";
import {
  assertAuthMethod,
  assertTrustedMutationRequest,
  type AuthRequestLike,
} from "./auth-http.js";
import { requireAuthenticatedRole } from "./auth-principal.js";
import { ApiHttpError } from "./http.js";
import { consumeRateLimitV1, type RateLimitPolicyV1 } from "./rate-limit.js";

export type ContentAdminOperationV1 =
  | "read"
  | "mutation"
  | "bulk"
  | "export_start"
  | "export_page"
  | "export_finalize";

export const CONTENT_ADMIN_RATE_LIMIT_POLICIES_V1: Readonly<Record<ContentAdminOperationV1, RateLimitPolicyV1>> = {
  read: { scope: "content.admin.read", limit: 120, windowSeconds: 300 },
  mutation: { scope: "content.admin.mutation", limit: 60, windowSeconds: 300 },
  bulk: { scope: "content.admin.bulk", limit: 20, windowSeconds: 300 },
  // Starting a 21k export is the costly full-catalog read/write operation.
  export_start: { scope: "content.admin.export_start", limit: 4, windowSeconds: 3_600 },
  // 100-item metadata chunks need 211 pages for 21,060 items; leave bounded retry headroom.
  export_page: { scope: "content.admin.export_page.session", limit: 600, windowSeconds: 3_600 },
  export_finalize: { scope: "content.admin.export_finalize.session", limit: 20, windowSeconds: 3_600 },
};

export const CONTENT_ADMIN_EXPORT_GLOBAL_RATE_LIMIT_POLICIES_V1 = {
  export_page: { scope: "content.admin.export_page.global", limit: 1_200, windowSeconds: 3_600 },
  export_finalize: { scope: "content.admin.export_finalize.global", limit: 40, windowSeconds: 3_600 },
} as const satisfies Readonly<Record<"export_page" | "export_finalize", RateLimitPolicyV1>>;

export function contentAdminRateLimitInputsV1(
  actor: ContentActorV1,
  operation: ContentAdminOperationV1,
  exportSessionId?: string,
): readonly { readonly policy: RateLimitPolicyV1; readonly trustedSubject: string }[] {
  if (operation === "export_page" || operation === "export_finalize") {
    if (!exportSessionId) {
      throw new ApiHttpError(500, "CONTENT_EXPORT_RATE_SUBJECT_MISSING", "Export session rate limit subject is missing.");
    }
    return [
      {
        policy: CONTENT_ADMIN_EXPORT_GLOBAL_RATE_LIMIT_POLICIES_V1[operation],
        trustedSubject: actor.userId,
      },
      {
        policy: CONTENT_ADMIN_RATE_LIMIT_POLICIES_V1[operation],
        trustedSubject: `${actor.userId}:${exportSessionId}`,
      },
    ];
  }
  return [{
    policy: CONTENT_ADMIN_RATE_LIMIT_POLICIES_V1[operation],
    trustedSubject: actor.userId,
  }];
}

export async function prepareContentAdminRequestV1(
  req: AuthRequestLike,
  operation: ContentAdminOperationV1,
  exportSessionId?: string,
): Promise<ContentActorV1> {
  assertAuthMethod(req, ["POST"]);
  assertTrustedMutationRequest(req);
  const actor = await requireAuthenticatedRole(req, "admin");
  if ((operation === "export_page" || operation === "export_finalize") && exportSessionId === undefined) {
    return actor;
  }
  await consumeContentAdminRateLimitV1(actor, operation, exportSessionId);
  return actor;
}

export async function consumeContentAdminRateLimitV1(
  actor: ContentActorV1,
  operation: ContentAdminOperationV1,
  exportSessionId?: string,
): Promise<void> {
  for (const input of contentAdminRateLimitInputsV1(actor, operation, exportSessionId)) {
    // Actor-global is deliberately consumed first so random export IDs cannot
    // create unbounded independent session buckets or Firestore cost.
    await consumeRateLimitV1(input);
  }
}
