import { ApiHttpError, sendJson, type NodeStyleResponseLike } from "../../../_lib/http.js";
import {
  assertPlainBody,
  handlePremiumApiErrorV1,
  preparePremiumAdminMutationV1,
  readPremiumJsonBodyV1,
  type PremiumRequestLike,
} from "../../../_lib/premium-http.js";
import {
  PREMIUM_RECONCILIATION_BATCH_LIMIT,
  runPremiumPaymentMaintenanceV1,
  type PremiumMaintenanceRunInputV1,
} from "../../../_lib/premium-maintenance.js";

export function createPremiumLeaseReconciliationHandler(
  run: (input: PremiumMaintenanceRunInputV1) => ReturnType<typeof runPremiumPaymentMaintenanceV1>
    = (input) => runPremiumPaymentMaintenanceV1(input),
) {
  return async function handler(req: PremiumRequestLike, res?: NodeStyleResponseLike) {
    try {
      const actor = await preparePremiumAdminMutationV1(
        req,
        ["premium_admin"],
        { scope: "premium.admin.reconcile-leases", limit: 12, windowSeconds: 300 },
      );
      const body = await readPremiumJsonBodyV1<Record<string, unknown>>(req, 2 * 1024);
      assertPlainBody(body, ["limit"]);
      const limit = body.limit === undefined ? PREMIUM_RECONCILIATION_BATCH_LIMIT : body.limit;
      if (typeof limit !== "number" || !Number.isInteger(limit)
        || limit < 1 || limit > PREMIUM_RECONCILIATION_BATCH_LIMIT) {
        throw new ApiHttpError(400, "PREMIUM_RECONCILIATION_BATCH_INVALID", "limit must be an integer from 1 to 3.");
      }
      return sendJson(res, 200, await run({ actor, limit }));
    } catch (error) {
      return handlePremiumApiErrorV1(res, error);
    }
  };
}

export default createPremiumLeaseReconciliationHandler();
