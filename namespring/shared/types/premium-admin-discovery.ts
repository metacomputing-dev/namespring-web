import type { ReportEntitlementStatusV1 } from "../../../lib/spring-ts/src/report/premium/index.js";
import type {
  PremiumOrderStatusV1,
  PremiumPaymentRailV1,
  PremiumPaymentRecoveryStateV1,
} from "./premium-service.js";

export const PREMIUM_ADMIN_DISCOVERY_PAGE_SCHEMA_V1 =
  "namespring.premium-admin-discovery-page.v1" as const;
export const PREMIUM_ADMIN_DISCOVERY_ITEM_SCHEMA_V1 =
  "namespring.premium-admin-discovery-item.v1" as const;

export type PremiumAdminDiscoveryResourceV1 =
  | "orders"
  | "entitlements"
  | "payment_recovery";

export interface PremiumAdminOrderDiscoveryItemV1 {
  readonly schemaVersion: typeof PREMIUM_ADMIN_DISCOVERY_ITEM_SCHEMA_V1;
  readonly resource: "orders";
  readonly orderId: string;
  readonly source: "live_order" | "retained_payment";
  readonly status: PremiumOrderStatusV1;
  readonly reportId?: string;
  readonly productId?: string;
  readonly contentVersion?: string;
  readonly amount: number;
  readonly currency: "KRW";
  readonly provider: PremiumPaymentRailV1;
  readonly entitlementId?: string;
  readonly recovery: PremiumPaymentRecoveryStateV1;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly paidAt: string | null;
  readonly refundedAt: string | null;
}

export interface PremiumAdminEntitlementDiscoveryItemV1 {
  readonly schemaVersion: typeof PREMIUM_ADMIN_DISCOVERY_ITEM_SCHEMA_V1;
  readonly resource: "entitlements";
  readonly entitlementId: string;
  readonly status: ReportEntitlementStatusV1;
  readonly reportId: string;
  readonly productId: string;
  readonly contentVersion: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly activatedAt: string | null;
  readonly expiresAt: string | null;
}

export interface PremiumAdminPaymentRecoveryDiscoveryItemV1 {
  readonly schemaVersion: typeof PREMIUM_ADMIN_DISCOVERY_ITEM_SCHEMA_V1;
  readonly resource: "payment_recovery";
  readonly orderId: string;
  readonly source: "live_order" | "retained_payment";
  readonly paymentStatus: PremiumOrderStatusV1;
  readonly reportId?: string;
  readonly productId?: string;
  readonly contentVersion?: string;
  readonly amount: number;
  readonly currency: "KRW";
  readonly provider: PremiumPaymentRailV1;
  readonly recoveryStatus: PremiumPaymentRecoveryStateV1["status"];
  readonly updatedAt: string;
  readonly dueAt: string | null;
}

export type PremiumAdminDiscoveryItemV1 =
  | PremiumAdminOrderDiscoveryItemV1
  | PremiumAdminEntitlementDiscoveryItemV1
  | PremiumAdminPaymentRecoveryDiscoveryItemV1;

export interface PremiumAdminDiscoveryPageV1 {
  readonly schemaVersion: typeof PREMIUM_ADMIN_DISCOVERY_PAGE_SCHEMA_V1;
  readonly resource: PremiumAdminDiscoveryResourceV1;
  readonly items: readonly PremiumAdminDiscoveryItemV1[];
  readonly nextCursor: string | null;
}

export interface ListPremiumAdminDiscoveryRequestV1 {
  readonly resource: PremiumAdminDiscoveryResourceV1;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface GetPremiumAdminDiscoveryRequestV1 {
  readonly resource: PremiumAdminDiscoveryResourceV1;
  readonly id: string;
}
