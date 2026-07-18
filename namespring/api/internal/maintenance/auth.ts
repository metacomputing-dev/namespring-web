import {
  assertMaintenanceCronRequest,
  handleMaintenanceError,
  sendMaintenanceJson,
  type MaintenanceRequestLike,
  type MaintenanceResponseLike,
} from "../../_lib/maintenance-http.js";
import { runAuthLifecycleMaintenanceV1 } from "../../_lib/auth-maintenance.js";

export function createAuthMaintenanceHandler(
  run: () => ReturnType<typeof runAuthLifecycleMaintenanceV1> = runAuthLifecycleMaintenanceV1,
) {
  return async function handler(req: MaintenanceRequestLike, res?: MaintenanceResponseLike) {
    try {
      assertMaintenanceCronRequest(req, res);
      try {
        return sendMaintenanceJson(res, 200, await run());
      } catch {
        // Auth/Firebase/job identifiers and storage diagnostics must not cross
        // the aggregate-only scheduled-maintenance boundary.
        return handleMaintenanceError(res, new Error("Auth maintenance failed."));
      }
    } catch (error) {
      return handleMaintenanceError(res, error);
    }
  };
}

export default createAuthMaintenanceHandler();
