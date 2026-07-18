import type {
  ListPremiumAdminDiscoveryRequestV1,
  PremiumAdminDiscoveryResourceV1,
} from "../../../../../shared/types/premium-admin-discovery.js";
import {
  assertPremiumAdminDiscoveryResponseBudgetV1,
  FirestorePremiumAdminDiscoveryV1,
  PREMIUM_ADMIN_DISCOVERY_LIMIT_MAX_V1,
} from "../../../../_lib/premium-admin-discovery.js";
import { ApiHttpError, sendJson, type NodeStyleResponseLike } from "../../../../_lib/http.js";
import {
  assertPlainBody,
  handlePremiumApiErrorV1,
  preparePremiumAdminMutationV1,
  readPremiumJsonBodyV1,
  type PremiumRequestLike,
} from "../../../../_lib/premium-http.js";

const RESOURCES = new Set<PremiumAdminDiscoveryResourceV1>([
  "orders", "entitlements", "payment_recovery",
]);

function parseRequest(body: ListPremiumAdminDiscoveryRequestV1) {
  assertPlainBody(body, ["resource", "limit", "cursor"]);
  if (!RESOURCES.has(body.resource)) {
    throw new ApiHttpError(400, "PREMIUM_ADMIN_RESOURCE_INVALID", "Premium admin resource is invalid.");
  }
  const limit = body.limit ?? 10;
  if (typeof limit !== "number" || !Number.isInteger(limit)
    || limit < 1 || limit > PREMIUM_ADMIN_DISCOVERY_LIMIT_MAX_V1) {
    throw new ApiHttpError(400, "PREMIUM_ADMIN_LIMIT_INVALID", "limit must be an integer from 1 to 20.");
  }
  if (body.cursor !== undefined
    && (typeof body.cursor !== "string" || !body.cursor || body.cursor !== body.cursor.trim()
      || body.cursor.length > 1_024)) {
    throw new ApiHttpError(400, "PREMIUM_ADMIN_CURSOR_INVALID", "Premium admin cursor is invalid.");
  }
  return { resource: body.resource, limit, ...(body.cursor ? { cursor: body.cursor } : {}) };
}

export function createPremiumAdminDiscoveryListHandler(
  discovery?: FirestorePremiumAdminDiscoveryV1,
) {
  let runtime = discovery;
  return async function handler(req: PremiumRequestLike, res?: NodeStyleResponseLike) {
    try {
      await preparePremiumAdminMutationV1(
        req,
        ["premium_admin"],
        { scope: "premium.admin.discovery.read", limit: 60, windowSeconds: 300 },
      );
      const body = await readPremiumJsonBodyV1<ListPremiumAdminDiscoveryRequestV1>(req, 4 * 1024);
      runtime ??= new FirestorePremiumAdminDiscoveryV1();
      const payload = { page: await runtime.list(parseRequest(body)) };
      assertPremiumAdminDiscoveryResponseBudgetV1(payload);
      return sendJson(res, 200, payload);
    } catch (error) {
      return handlePremiumApiErrorV1(res, error);
    }
  };
}

export default createPremiumAdminDiscoveryListHandler();
