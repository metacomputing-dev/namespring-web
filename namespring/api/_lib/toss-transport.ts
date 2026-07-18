import { ApiHttpError } from "./http.js";
import { getOptionalEnv } from "./env.js";

export const TOSS_API_ORIGIN_V1 = "https://api.tosspayments.com" as const;
export const TOSS_PROVIDER_RESPONSE_MAX_BYTES_V1 = 128 * 1024;

/**
 * Toss test and live credentials use the same official API origin. Keeping the
 * optional setting exact prevents a typo or hostile environment override from
 * forwarding the merchant Basic credential to another host.
 */
export function tossApiBaseUrlV1(): typeof TOSS_API_ORIGIN_V1 {
  const configured = getOptionalEnv("TOSS_API_BASE_URL");
  if (
    configured !== undefined
    && configured !== TOSS_API_ORIGIN_V1
    && configured !== `${TOSS_API_ORIGIN_V1}/`
  ) {
    throw new ApiHttpError(
      503,
      "TOSS_API_ORIGIN_INVALID",
      "Toss API origin must be the pinned official payments origin.",
    );
  }
  return TOSS_API_ORIGIN_V1;
}

function tossInvalidResponse(message: string): never {
  throw new ApiHttpError(502, "TOSS_INVALID_RESPONSE", message);
}

/** Read a decompressed provider body under a hard memory bound. */
export async function readBoundedTossJsonV1(response: Response): Promise<unknown> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && /^[0-9]+$/u.test(contentLength)) {
    const declaredBytes = Number(contentLength);
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes > TOSS_PROVIDER_RESPONSE_MAX_BYTES_V1) {
      await response.body?.cancel().catch(() => undefined);
      tossInvalidResponse("Toss response exceeded the provider body limit.");
    }
  }
  if (!response.body) return null;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > TOSS_PROVIDER_RESPONSE_MAX_BYTES_V1) {
        await reader.cancel().catch(() => undefined);
        tossInvalidResponse("Toss response exceeded the provider body limit.");
      }
      chunks.push(result.value);
    }
  } catch (error) {
    if (error instanceof ApiHttpError) throw error;
    throw new ApiHttpError(503, "TOSS_UNAVAILABLE", "Toss response stream did not complete.");
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    tossInvalidResponse("Toss returned a non-UTF-8 response.");
  }
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    tossInvalidResponse("Toss returned a non-JSON response.");
  }
}
