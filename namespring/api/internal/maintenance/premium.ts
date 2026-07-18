import {
  assertMaintenanceCronRequest,
  handleMaintenanceError,
  sendMaintenanceJson,
  type MaintenanceRequestLike,
  type MaintenanceResponseLike,
} from "../../_lib/maintenance-http.js";
import { runPremiumPaymentMaintenanceV1 } from "../../_lib/premium-maintenance.js";

export function createPremiumMaintenanceHandler(
  run: () => ReturnType<typeof runPremiumPaymentMaintenanceV1> = () => runPremiumPaymentMaintenanceV1(),
) {
  return async function handler(req: MaintenanceRequestLike, res?: MaintenanceResponseLike) {
    try {
      assertMaintenanceCronRequest(req, res);
      try {
        return sendMaintenanceJson(res, 200, await run());
      } catch {
        // Authentication errors remain actionable; provider, Firestore, and
        // lease details from the privileged run never cross this boundary.
        return handleMaintenanceError(res, new Error("Premium maintenance failed."));
      }
    } catch (error) {
      return handleMaintenanceError(res, error);
    }
  };
}

export default createPremiumMaintenanceHandler();
