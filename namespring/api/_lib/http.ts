export class ApiHttpError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

const DEFAULT_MAX_JSON_BODY_BYTES = 64 * 1024;
const MAX_CONFIGURABLE_JSON_BODY_BYTES = 2 * 1024 * 1024;

export interface ReadJsonBodyOptions {
  readonly maxBytes?: number;
}

export interface NodeStyleResponseLike {
  setHeader?: (name: string, value: string) => void;
  status: (code: number) => {
    json: (payload: unknown) => void;
  };
}

type RequestWithBody =
  | Request
  | {
    method?: string;
    body?: unknown;
    [key: string]: unknown;
  };

type WebReadableRequestLike = {
  readonly body: ReadableStream<Uint8Array> | null;
  readonly headers?: Headers;
};

function hasWebReadableBody(value: unknown): value is WebReadableRequestLike {
  if (value instanceof Request) return true;
  const body = (value as { body?: unknown })?.body;
  return typeof (body as { getReader?: unknown })?.getReader === "function";
}

function assertBodySize(raw: string | Buffer, maxBytes = DEFAULT_MAX_JSON_BODY_BYTES): void {
  const byteLength = typeof raw === "string" ? Buffer.byteLength(raw, "utf8") : raw.byteLength;
  if (byteLength > maxBytes) {
    throw new ApiHttpError(413, "REQUEST_BODY_TOO_LARGE", `Request body must not exceed ${maxBytes} bytes.`);
  }
}

function assertContentLength(headers: Headers | undefined, maxBytes = DEFAULT_MAX_JSON_BODY_BYTES): void {
  const rawLength = headers?.get("content-length");
  if (!rawLength) {
    return;
  }
  const parsed = Number(rawLength);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ApiHttpError(400, "INVALID_CONTENT_LENGTH", "Content-Length must be a non-negative number.");
  }
  if (parsed > maxBytes) {
    throw new ApiHttpError(413, "REQUEST_BODY_TOO_LARGE", `Request body must not exceed ${maxBytes} bytes.`);
  }
}

function resolveMaxBytes(options: ReadJsonBodyOptions | undefined): number {
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_JSON_BODY_BYTES;
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_CONFIGURABLE_JSON_BODY_BYTES) {
    throw new ApiHttpError(
      500,
      "INVALID_BODY_LIMIT",
      `JSON body limit must be an integer between 1 and ${MAX_CONFIGURABLE_JSON_BODY_BYTES} bytes.`,
    );
  }
  return maxBytes;
}

function decodeUtf8(buffer: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch (error) {
    throw new ApiHttpError(400, "INVALID_UTF8", "Request body must be valid UTF-8.", error);
  }
}

async function readFetchBodyBounded(req: WebReadableRequestLike, maxBytes: number): Promise<string> {
  const headers = req.headers && typeof req.headers.get === "function" ? req.headers : undefined;
  assertContentLength(headers, maxBytes);
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Buffer[] = [];
  let receivedBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      receivedBytes += chunk.byteLength;
      if (receivedBytes > maxBytes) {
        await reader.cancel("request body exceeded configured limit").catch(() => undefined);
        throw new ApiHttpError(413, "REQUEST_BODY_TOO_LARGE", `Request body must not exceed ${maxBytes} bytes.`);
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
  return decodeUtf8(Buffer.concat(chunks, receivedBytes));
}

function toWebJsonResponse(statusCode: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export function assertPostMethod(req: { method?: string }, res?: { setHeader?: (name: string, value: string) => void }) {
  if (req.method === "POST") {
    return;
  }

  if (typeof res?.setHeader === "function") {
    res.setHeader("Allow", "POST");
  }
  throw new ApiHttpError(405, "METHOD_NOT_ALLOWED", "Only POST is supported.");
}

export async function readJsonBody<T>(req: RequestWithBody, options?: ReadJsonBodyOptions): Promise<T> {
  const maxBytes = resolveMaxBytes(options);
  if (hasWebReadableBody(req)) {
    const rawBody = await readFetchBodyBounded(req, maxBytes);
    assertBodySize(rawBody, maxBytes);
    const raw = rawBody.trim();
    if (!raw) {
      return {} as T;
    }

    try {
      return JSON.parse(raw) as T;
    } catch (error) {
      throw new ApiHttpError(400, "INVALID_JSON", "Request body must be valid JSON.", error);
    }
  }

  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") {
      assertBodySize(req.body, maxBytes);
      try {
        return JSON.parse(req.body) as T;
      } catch (error) {
        throw new ApiHttpError(400, "INVALID_JSON", "Request body must be valid JSON.", error);
      }
    }
    if (typeof req.body === "object") {
      let encoded: string;
      try {
        encoded = JSON.stringify(req.body);
      } catch (error) {
        throw new ApiHttpError(400, "INVALID_JSON", "Request body must be JSON serializable.", error);
      }
      assertBodySize(encoded, maxBytes);
      return req.body as T;
    }
  }

  const requestAsAsyncIterable = req as unknown as AsyncIterable<Buffer | string>;
  if (typeof (requestAsAsyncIterable as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] !== "function") {
    return {} as T;
  }

  const chunks: Buffer[] = [];
  let receivedBytes = 0;
  for await (const chunk of requestAsAsyncIterable) {
    const encoded = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    receivedBytes += encoded.byteLength;
    if (receivedBytes > maxBytes) {
      throw new ApiHttpError(
        413,
        "REQUEST_BODY_TOO_LARGE",
        `Request body must not exceed ${maxBytes} bytes.`,
      );
    }
    chunks.push(encoded);
  }

  const raw = decodeUtf8(Buffer.concat(chunks, receivedBytes)).trim();
  if (!raw) {
    return {} as T;
  }

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new ApiHttpError(400, "INVALID_JSON", "Request body must be valid JSON.", error);
  }
}

export function requireNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new ApiHttpError(400, "INVALID_REQUEST", `${fieldName} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new ApiHttpError(400, "INVALID_REQUEST", `${fieldName} is required.`);
  }
  return trimmed;
}

export function requirePositiveInteger(value: unknown, fieldName: string): number {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    throw new ApiHttpError(400, "INVALID_REQUEST", `${fieldName} must be a positive integer.`);
  }
  return numeric;
}

export function sendJson(res: NodeStyleResponseLike | undefined, statusCode: number, payload: unknown): Response | void {
  if (res && typeof res.status === "function") {
    res.setHeader?.("Cache-Control", "no-store");
    res.setHeader?.("X-Content-Type-Options", "nosniff");
    res.setHeader?.("Referrer-Policy", "no-referrer");
    res.status(statusCode).json(payload);
    return;
  }
  return toWebJsonResponse(statusCode, payload);
}

export function handleApiError(
  res: NodeStyleResponseLike | undefined,
  error: unknown,
  fallbackMessage = "Unexpected server error.",
) {
  if (error instanceof ApiHttpError) {
    return sendJson(res, error.statusCode, {
      error: {
        code: error.code,
        message: error.message,
      },
    });
  }

  return sendJson(res, 500, {
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: fallbackMessage,
    },
  });
}
