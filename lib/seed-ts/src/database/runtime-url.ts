/**
 * Resolve a public asset path for both root-hosted and subpath-hosted apps.
 *
 * Example:
 * - root page:    https://user.github.io/      + data/hanja.db -> /data/hanja.db
 * - project page: https://user.github.io/repo/ + data/hanja.db -> /repo/data/hanja.db
 */
export function resolvePublicAssetUrl(relativePath: string): string {
  if (/^https?:\/\//i.test(relativePath)) return relativePath;

  const trimmed = String(relativePath ?? '').replace(/^\/+/, '');

  if (typeof document !== 'undefined' && typeof document.baseURI === 'string' && document.baseURI.length > 0) {
    return new URL(trimmed, document.baseURI).toString();
  }

  return `/${trimmed}`;
}

