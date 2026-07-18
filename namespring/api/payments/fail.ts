import {
  ApiHttpError,
  assertPostMethod,
  handleApiError,
  type NodeStyleResponseLike,
} from "../_lib/http.js";

/**
 * This browser-controlled callback previously allowed arbitrary order-state
 * mutation. It remains present only as an explicit tombstone so stale clients
 * cannot silently write financial records.
 */
export default async function handler(
  req: Request | { method?: string; [key: string]: unknown },
  res?: NodeStyleResponseLike,
) {
  try {
    assertPostMethod(req, res);
    throw new ApiHttpError(
      410,
      "LEGACY_PAYMENT_FLOW_RETIRED",
      "This payment flow is retired. Payment state is now determined by the authenticated premium API.",
    );
  } catch (error) {
    return handleApiError(res, error);
  }
}
