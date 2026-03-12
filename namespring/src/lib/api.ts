import { getFrontRuntimeConfig } from "./runtime";

function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const { apiBaseUrl } = getFrontRuntimeConfig();

  if (!apiBaseUrl) {
    return normalizedPath;
  }

  const trimmedBase = apiBaseUrl.replace(/\/+$/g, "");
  return `${trimmedBase}${normalizedPath}`;
}

interface ApiErrorPayload {
  error?: {
    code?: string;
    message?: string;
  };
}

export async function postJson<TResponse>(path: string, payload: unknown): Promise<TResponse> {
  const response = await fetch(buildApiUrl(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  let parsedPayload: (TResponse & ApiErrorPayload) | null = null;

  if (responseText) {
    try {
      parsedPayload = JSON.parse(responseText) as TResponse & ApiErrorPayload;
    } catch {
      parsedPayload = null;
    }
  }

  if (!response.ok) {
    const message = parsedPayload?.error?.message || responseText || `Request failed with status ${response.status}.`;
    throw new Error(message);
  }

  if (!parsedPayload) {
    throw new Error("Invalid JSON response from API.");
  }

  return parsedPayload as TResponse;
}
