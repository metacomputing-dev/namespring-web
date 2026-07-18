import type { RegisterPremiumReportCommandV1 } from "../../../../shared/types/premium-service.js";
import { sendJson, type NodeStyleResponseLike } from "../../../_lib/http.js";
import {
  assertPlainBody,
  handlePremiumApiErrorV1,
  prepareAuthenticatedPremiumMutation,
  readPremiumJsonBodyV1,
  type PremiumRequestLike,
} from "../../../_lib/premium-http.js";
import {
  PremiumServiceV1,
  installPremiumAnalysisEngineFactoryV1,
} from "../../../_lib/premium-service.js";

let installedDefaultEngine = false;

async function getDefaultRegistrationServiceV1(): Promise<PremiumServiceV1> {
  if (!installedDefaultEngine) {
    const { createServerSpringEngineV1 } = await import("../../../_lib/server-spring-engine.js");
    installPremiumAnalysisEngineFactoryV1(createServerSpringEngineV1);
    installedDefaultEngine = true;
  }
  return new PremiumServiceV1();
}

export function createPremiumReportRegistrationHandler(service?: PremiumServiceV1) {
  return async function handler(req: PremiumRequestLike, res?: NodeStyleResponseLike) {
    try {
      const actor = await prepareAuthenticatedPremiumMutation(req, {
        scope: "premium.report.register", limit: 12, windowSeconds: 600,
      });
      const body = await readPremiumJsonBodyV1<RegisterPremiumReportCommandV1>(req);
      assertPlainBody(body, ["request", "dataProcessingConsent"]);
      const activeService = service ?? await getDefaultRegistrationServiceV1();
      const result = await activeService.registerReport(actor, body.request, body.dataProcessingConsent);
      return sendJson(res, result.registrationMode === "initial" ? 201 : 200, result);
    } catch (error) {
      return handlePremiumApiErrorV1(res, error);
    }
  };
}

export default createPremiumReportRegistrationHandler();
