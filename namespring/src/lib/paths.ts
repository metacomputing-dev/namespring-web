function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

function normalizeOrigin(origin: string) {
  return origin.replace(/\/+$/g, "");
}

export function getBasePath() {
  const rawBase = String(import.meta.env.BASE_URL || "/").trim();
  if (!rawBase || rawBase === "/") {
    return "/";
  }
  return `/${trimSlashes(rawBase)}/`;
}

export function withBasePath(path: string) {
  const cleanPath = trimSlashes(path);
  const basePath = getBasePath();
  if (!cleanPath) {
    return basePath;
  }
  if (basePath === "/") {
    return `/${cleanPath}`;
  }
  return `${basePath}${cleanPath}`;
}

function toAbsoluteRootPath(path: string) {
  const cleanPath = trimSlashes(path);
  return cleanPath ? `/${cleanPath}` : "/";
}

export function toAbsoluteAppUrl(
  path: string,
  options?: { originOverride?: string | null; includeBasePath?: boolean },
) {
  const includeBasePath = options?.includeBasePath !== false;
  const finalPath = includeBasePath ? withBasePath(path) : toAbsoluteRootPath(path);
  const origin = options?.originOverride
    ? normalizeOrigin(options.originOverride)
    : window.location.origin;

  return new URL(finalPath, `${origin}/`).toString();
}
