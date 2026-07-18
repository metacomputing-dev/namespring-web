import type {
  PremiumEntitlementOwnerV1,
  PremiumReportBindingV1,
} from "../../../lib/spring-ts/src/report/premium/index.js";
import type { PremiumContentActivationBindingV1 } from "../../shared/types/premium-service.js";

/** Authorization-critical equality lives in one persistence-neutral module. */
export function samePremiumOwnerV1(
  left: PremiumEntitlementOwnerV1,
  right: PremiumEntitlementOwnerV1,
): boolean {
  return left.kind === right.kind && left.subjectId === right.subjectId;
}

export function samePremiumReportBindingV1(
  left: PremiumReportBindingV1,
  right: PremiumReportBindingV1,
): boolean {
  return left.reportId === right.reportId
    && left.analysisId === right.analysisId
    && left.candidateId === right.candidateId
    && left.productId === right.productId
    && left.contentVersion === right.contentVersion;
}

export function samePremiumContentActivationV1(
  left: PremiumContentActivationBindingV1,
  right: PremiumContentActivationBindingV1,
): boolean {
  return left.sourceKind === right.sourceKind
    && left.resourceId === right.resourceId
    && left.activationId === right.activationId
    && left.immutableContentDigest === right.immutableContentDigest
    && left.selectorKey === right.selectorKey;
}
