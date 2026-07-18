import {
  SERVICE_CATALOG_SCHEMA_V1,
  STORY_COMPLETION_PRODUCT_ID_V1,
  assertServiceCatalogV1,
  type ServiceCatalogProductV1,
  type ServiceCatalogV1,
} from "../../../lib/spring-ts/src/report/premium/index.js";
import { getOptionalEnv } from "./env.js";
import { ApiHttpError } from "./http.js";

const DEFAULT_CATALOG: ServiceCatalogV1 = {
  schemaVersion: SERVICE_CATALOG_SCHEMA_V1,
  catalogVersion: "premium-catalog.2026-07.v1",
  generatedAt: "2026-07-18T00:00:00.000Z",
  products: [{
    productId: STORY_COMPLETION_PRODUCT_ID_V1,
    contentVersion: "story-completion.2026-07.v1",
    displayName: "이야기 완성하기",
    // Checked-in builds never sell by default. Production must provide both a
    // reviewed catalog override and the explicit deployment-readiness fence.
    availability: "unavailable",
    price: {
      amount: 1_000,
      currency: "KRW",
      authority: "server_catalog",
      taxIncluded: true,
    },
  }],
};

export const PREMIUM_CATALOG_ACTIVATION_STATE_VERIFIED_V1 =
  "provider_staging_and_content_verified_v1" as const;

let cachedSource: string | undefined;
let cachedActivationState: string | undefined;
let cachedCatalog: ServiceCatalogV1 | undefined;

/**
 * Production may replace the checked-in launch catalog atomically through one
 * JSON environment value. Browser amount/contentVersion assertions are never
 * consulted.
 */
export function getPremiumServiceCatalogV1(): ServiceCatalogV1 {
  const source = getOptionalEnv("PREMIUM_SERVICE_CATALOG_JSON");
  const activationState = getOptionalEnv("PREMIUM_CATALOG_ACTIVATION_STATE");
  if (cachedCatalog && cachedSource === source && cachedActivationState === activationState) {
    return cachedCatalog;
  }
  let catalog: unknown = DEFAULT_CATALOG;
  if (source) {
    try {
      catalog = JSON.parse(source) as unknown;
    } catch (error) {
      throw new ApiHttpError(500, "PREMIUM_CATALOG_INVALID", "Premium catalog JSON is invalid.", error);
    }
  }
  try {
    assertServiceCatalogV1(catalog);
  } catch (error) {
    throw new ApiHttpError(500, "PREMIUM_CATALOG_INVALID", "Premium catalog contract is invalid.", error);
  }
  const validated = catalog as ServiceCatalogV1;
  if (validated.products.some((product) => product.availability === "active")
    && (!source || activationState !== PREMIUM_CATALOG_ACTIVATION_STATE_VERIFIED_V1)) {
    throw new ApiHttpError(
      503,
      "PREMIUM_CATALOG_ACTIVATION_UNVERIFIED",
      "Active premium catalog requires verified content and provider staging.",
    );
  }
  cachedSource = source;
  cachedActivationState = activationState;
  cachedCatalog = validated;
  return validated;
}

export function requireActivePremiumProductV1(productId: string): ServiceCatalogProductV1 {
  const product = getPremiumServiceCatalogV1().products.find((entry) => entry.productId === productId);
  if (!product || product.availability !== "active") {
    throw new ApiHttpError(409, "PREMIUM_PRODUCT_UNAVAILABLE", "Premium product is not available.");
  }
  return product;
}
