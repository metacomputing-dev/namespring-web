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

function hasWebRequestBodyParser(value: unknown): value is { text: () => Promise<string> } {
  return typeof (value as { text?: unknown })?.text === "function";
}

function toWebJsonResponse(statusCode: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
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

export async function readJsonBody<T>(req: RequestWithBody): Promise<T> {
  if (hasWebRequestBodyParser(req)) {
    const raw = (await req.text()).trim();
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
      try {
        return JSON.parse(req.body) as T;
      } catch (error) {
        throw new ApiHttpError(400, "INVALID_JSON", "Request body must be valid JSON.", error);
      }
    }
    if (typeof req.body === "object") {
      return req.body as T;
    }
  }

  const requestAsAsyncIterable = req as unknown as AsyncIterable<Buffer | string>;
  if (typeof (requestAsAsyncIterable as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] !== "function") {
    return {} as T;
  }

  const chunks: Buffer[] = [];
  for await (const chunk of requestAsAsyncIterable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
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

  const message = error instanceof Error ? error.message : fallbackMessage;
  return sendJson(res, 500, {
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message,
    },
  });
}
