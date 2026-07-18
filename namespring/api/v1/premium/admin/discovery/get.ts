import type {
  GetPremiumAdminDiscoveryRequestV1,
  PremiumAdminDiscoveryResourceV1,
} from "../../../../../shared/types/premium-admin-discovery.js";
import {
  assertPremiumAdminDiscoveryResponseBudgetV1,
  FirestorePremiumAdminDiscoveryV1,
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

function parseRequest(body: GetPremiumAdminDiscoveryRequestV1) {
  assertPlainBody(body, ["resource", "id"]);
  if (!RESOURCES.has(body.resource)) {
    throw new ApiHttpError(400, "PREMIUM_ADMIN_RESOURCE_INVALID", "Premium admin resource is invalid.");
  }
  if (typeof body.id !== "string" || !/^[A-Za-z0-9_-]{1,256}$/u.test(body.id)) {
    throw new ApiHttpError(400, "PREMIUM_ADMIN_ID_INVALID", "Premium admin resource ID is invalid.");
  }
  return { resource: body.resource, id: body.id };
}

export function createPremiumAdminDiscoveryGetHandler(
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
      const body = await readPremiumJsonBodyV1<GetPremiumAdminDiscoveryRequestV1>(req, 4 * 1024);
      runtime ??= new FirestorePremiumAdminDiscoveryV1();
      const payload = { item: await runtime.get(parseRequest(body)) };
      assertPremiumAdminDiscoveryResponseBudgetV1(payload);
      return sendJson(res, 200, payload);
    } catch (error) {
      return handlePremiumApiErrorV1(res, error);
    }
  };
}

export default createPremiumAdminDiscoveryGetHandler();
