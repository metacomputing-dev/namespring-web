import {
  ApiHttpError,
  assertPostMethod,
  handleApiError,
  type NodeStyleResponseLike,
} from "../_lib/http.js";

/**
 * The original support-payment flow predates authenticated account binding and
 * cannot safely mint new orders. Existing paid orders remain refundable through
 * the authenticated administrative reconciliation endpoint.
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
