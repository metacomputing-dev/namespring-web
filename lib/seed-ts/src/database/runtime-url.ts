export interface PublicAssetUrlContext {
  readonly applicationBaseUrl?: string;
  readonly origin?: string;
  readonly documentBaseUri?: string;
}

type ViteImportMeta = ImportMeta & {
  readonly env?: { readonly BASE_URL?: unknown };
};

function runtimeApplicationBaseUrl(): string | undefined {
  const value = (import.meta as ViteImportMeta).env?.BASE_URL;
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function runtimeDocumentBaseUri(): string | undefined {
  return typeof document !== 'undefined'
    && typeof document.baseURI === 'string'
    && document.baseURI.length > 0
    ? document.baseURI
    : undefined;
}

function runtimeOrigin(): string | undefined {
  return typeof window !== 'undefined'
    && typeof window.location?.origin === 'string'
    && window.location.origin.length > 0
    ? window.location.origin
    : undefined;
}

/**
 * Resolve a public asset path for both root-hosted and subpath-hosted apps.
 *
 * Vite's BASE_URL is authoritative when present. document.baseURI is only a
 * fallback because a BrowserRouter direct route such as /repo/payment/success
 * would otherwise resolve data/hanja.db below /repo/payment/.
 */
export function resolvePublicAssetUrl(
  relativePath: string,
  context: PublicAssetUrlContext = {},
): string {
  if (/^https?:\/\//i.test(relativePath)) return relativePath;

  const trimmed = String(relativePath ?? '').replace(/^\/+/, '');
  const documentBaseUri = context.documentBaseUri ?? runtimeDocumentBaseUri();
  const origin = context.origin ?? runtimeOrigin();
  const applicationBaseUrl =
    context.applicationBaseUrl ?? runtimeApplicationBaseUrl();

  if (applicationBaseUrl) {
    const referenceUrl = origin
      ? `${origin.replace(/\/+$/u, '')}/`
      : documentBaseUri;
    if (referenceUrl) {
      const absoluteBaseUrl = new URL(applicationBaseUrl, referenceUrl).toString();
      const directoryBaseUrl = absoluteBaseUrl.endsWith('/')
        ? absoluteBaseUrl
        : `${absoluteBaseUrl}/`;
      return new URL(trimmed, directoryBaseUrl).toString();
    }
  }

  if (documentBaseUri) return new URL(trimmed, documentBaseUri).toString();
  return `/${trimmed}`;
}
