import {
  ApiHttpError,
  assertPostMethod,
  handleApiError,
  type NodeStyleResponseLike,
} from "../_lib/http.js";

/**
 * Fail closed: accepting an unauthenticated legacy confirmation would bypass
 * the owner-bound premium payment saga. Historic orders are reconciled only by
 * the authenticated administrative refund endpoint.
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
      "This payment flow is retired. Start a new purchase through the authenticated premium API.",
    );
  } catch (error) {
    return handleApiError(res, error);
  }
}
