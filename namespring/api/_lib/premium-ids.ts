import { createHash, randomBytes } from "node:crypto";

function randomSuffix(): string {
  return randomBytes(18).toString("base64url");
}

export function newPremiumId(
  kind: "report" | "analysis" | "order" | "entitlement" | "delivery" | "audit" | "event",
): string {
  switch (kind) {
    case "report": return `report_v1_${randomSuffix()}`;
    case "analysis": return `server_analysis_v1_${randomSuffix()}`;
    case "order": return `premium_order_v1_${randomSuffix()}`;
    case "entitlement": return `entitlement_v1_${randomSuffix()}`;
    case "delivery": return `premium_delivery_v1_${randomSuffix()}`;
    case "audit": return `premium_audit_v1_${randomSuffix()}`;
    case "event": return `premium_event_v1_${randomSuffix()}`;
  }
}

export function premiumDocumentKey(...parts: readonly string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) {
    hash.update(Buffer.from(String(part.length), "utf8"));
    hash.update(":", "utf8");
    hash.update(part, "utf8");
  }
  return hash.digest("base64url");
}

export function premiumEvidenceId(analysisId: string, sourceId: string): string {
  return `evidence_v1_${premiumDocumentKey(analysisId, sourceId).slice(0, 43)}`;
}
