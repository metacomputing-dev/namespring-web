import {
  assertMaintenanceCronRequest,
  handleMaintenanceError,
  sendMaintenanceJson,
  type MaintenanceRequestLike,
  type MaintenanceResponseLike,
} from "../../_lib/maintenance-http.js";
import { runPremiumExpiryMaintenanceV1 } from "../../_lib/premium-expiry-maintenance.js";

export function createPremiumExpiryMaintenanceHandler(
  run: () => ReturnType<typeof runPremiumExpiryMaintenanceV1> = () => runPremiumExpiryMaintenanceV1(),
) {
  return async function handler(req: MaintenanceRequestLike, res?: MaintenanceResponseLike) {
    try {
      assertMaintenanceCronRequest(req, res);
      try {
        return sendMaintenanceJson(res, 200, await run());
      } catch {
        return handleMaintenanceError(res, new Error("Premium expiry maintenance failed."));
      }
    } catch (error) {
      return handleMaintenanceError(res, error);
    }
  };
}

export default createPremiumExpiryMaintenanceHandler();
