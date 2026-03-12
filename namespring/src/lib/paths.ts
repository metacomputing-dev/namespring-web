function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
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

export function toAbsoluteAppUrl(path: string) {
  return new URL(withBasePath(path), window.location.origin).toString();
}
