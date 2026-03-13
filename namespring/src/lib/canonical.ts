import { getBasePath } from "./paths";
import { getFrontRuntimeConfig } from "./runtime";

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/+$/g, "");
}

function isLocalhostHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function stripBasePath(pathname: string, basePath: string): string {
  if (!pathname) {
    return "/";
  }

  if (basePath === "/") {
    return pathname;
  }

  const normalizedBase = `/${basePath.replace(/^\/+|\/+$/g, "")}/`;
  const baseWithoutTrailingSlash = normalizedBase.slice(0, -1);

  if (pathname === baseWithoutTrailingSlash) {
    return "/";
  }

  if (pathname.startsWith(normalizedBase)) {
    const stripped = pathname.slice(normalizedBase.length - 1);
    return stripped.startsWith("/") ? stripped : `/${stripped}`;
  }

  return pathname;
}

export function getCanonicalRedirectUrl(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (import.meta.env.DEV) {
    return null;
  }

  if (isLocalhostHost(window.location.hostname)) {
    return null;
  }

  const { canonicalOrigin } = getFrontRuntimeConfig();
  if (!canonicalOrigin) {
    return null;
  }

  const targetOrigin = normalizeOrigin(canonicalOrigin);
  if (window.location.origin === targetOrigin) {
    return null;
  }

  const pathWithoutBase = stripBasePath(window.location.pathname, getBasePath());
  return `${targetOrigin}${pathWithoutBase}${window.location.search}${window.location.hash}`;
}
