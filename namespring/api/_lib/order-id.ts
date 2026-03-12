import { randomBytes } from "node:crypto";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function getKstDateParts(now: Date) {
  const kstEpochMs = now.getTime() + 9 * 60 * 60 * 1000;
  const kstDate = new Date(kstEpochMs);

  const year = kstDate.getUTCFullYear();
  const month = pad2(kstDate.getUTCMonth() + 1);
  const day = pad2(kstDate.getUTCDate());
  const hours = pad2(kstDate.getUTCHours());
  const minutes = pad2(kstDate.getUTCMinutes());
  const seconds = pad2(kstDate.getUTCSeconds());

  return {
    yyyymmdd: `${year}${month}${day}`,
    hhmmss: `${hours}${minutes}${seconds}`,
  };
}

function createReadableRandomId() {
  return randomBytes(4).toString("hex");
}

export function generateOrderId(now = new Date()): string {
  const { yyyymmdd, hhmmss } = getKstDateParts(now);
  const randomId = createReadableRandomId();
  return `ns_${yyyymmdd}_${hhmmss}_${randomId}`;
}
