export function wrap360(x: number): number {
  return ((x % 360) + 360) % 360;
}

export function norm180(x: number): number {
  const y = wrap360(x);
  return y > 180 ? y - 360 : y;
}

export function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

