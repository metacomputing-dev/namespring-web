import {
  assertMaintenanceCronRequest,
  handleMaintenanceError,
  sendMaintenanceJson,
  type MaintenanceRequestLike,
  type MaintenanceResponseLike,
} from "../../_lib/maintenance-http.js";
import { runSyncRetentionMaintenanceV1 } from "../../_lib/sync-maintenance.js";

export function createSyncMaintenanceHandler(
  run: () => ReturnType<typeof runSyncRetentionMaintenanceV1> = runSyncRetentionMaintenanceV1,
) {
  return async function handler(req: MaintenanceRequestLike, res?: MaintenanceResponseLike) {
    try {
      assertMaintenanceCronRequest(req, res);
      try {
        return sendMaintenanceJson(res, 200, await run());
      } catch {
        // Account, session, and document diagnostics remain server-side; the
        // unattended endpoint exposes only bounded aggregate state.
        return handleMaintenanceError(res, new Error("Sync maintenance failed."));
      }
    } catch (error) {
      return handleMaintenanceError(res, error);
    }
  };
}

export default createSyncMaintenanceHandler();
