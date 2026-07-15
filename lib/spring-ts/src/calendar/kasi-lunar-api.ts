/**
 * kasi-lunar-api.ts — KASI 음양력 변환 API 옵션 (감사 B1 · 결정③).
 *
 * data.go.kr LrsrCldInfoService/getSpcifyLunCalInfo 로 음력→양력을 조회한다.
 * 기본 경로가 아니다 — 결정③에 따라 기본은 내장 테이블(korean-lunar-calendar.ts)이고,
 * 이 API는 제품 보장 범위 안의 교차 검증용 옵트인(precisionConfig.lunarConversionSource='kasi')이다.
 * 서비스키 부재·네트워크 실패·타임아웃·브라우저 런타임이면 null을 반환하고
 * 호출자(saju-adapter resolveLunarConversion)가 내장 테이블로 폴백한다.
 *
 * getSpcifyLunCalInfo를 쓰는 이유: 윤달 discriminator(leapMonth='평'|'윤')를
 * 요청 파라미터로 받는 유일한 오퍼레이션 (docs/LUNAR_SOLAR_CONVERSION_ORACLE_POLICY.md,
 * data/sources/kasi-lunar-solar.sources.json의 preferred operation).
 *
 * 서비스키 env (scripts/fetch-kasi-lunar-solar.ts 와 동일 트리오):
 *   KASI_LUNISOLAR_SERVICE_KEY > KASI_DATA_GO_KR_SERVICE_KEY > DATA_GO_KR_SERVICE_KEY
 * base URL 오버라이드(목서버 테스트용): KASI_LUNISOLAR_API_URL
 */
import type { LunarDate, SolarDate } from './korean-lunar-calendar.js';

const DEFAULT_BASE_URL = 'https://apis.data.go.kr/B090041/openapi/service/LrsrCldInfoService';
const DEFAULT_TIMEOUT_MS = 4000;

interface KasiCallOptions {
  readonly serviceKey?: string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
}

function envOf(): Record<string, string | undefined> | null {
  // 브라우저에서는 KASI 경로를 원천 비활성 (CORS 문제 자체가 발생하지 않도록).
  const proc = (globalThis as any)?.process;
  if (typeof proc === 'undefined' || !proc?.env) return null;
  return proc.env as Record<string, string | undefined>;
}

function resolveServiceKey(override?: string): string | null {
  if (override) return override;
  const env = envOf();
  if (!env) return null;
  return env.KASI_LUNISOLAR_SERVICE_KEY
    ?? env.KASI_DATA_GO_KR_SERVICE_KEY
    ?? env.DATA_GO_KR_SERVICE_KEY
    ?? null;
}

function resolveBaseUrl(override?: string): string {
  if (override) return override;
  return envOf()?.KASI_LUNISOLAR_API_URL ?? DEFAULT_BASE_URL;
}

function xmlField(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return match ? match[1]!.trim() : null;
}

function xmlItems(xml: string): string[] {
  return xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
}

function isValidSolarDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

/**
 * 음력 → 양력 (KASI API). 실패 시 null (throw하지 않음).
 */
export async function kasiLunarToSolar(lunar: LunarDate, opts?: KasiCallOptions): Promise<SolarDate | null> {
  const serviceKey = resolveServiceKey(opts?.serviceKey);
  if (!serviceKey) return null;

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const url = new URL(`${resolveBaseUrl(opts?.baseUrl).replace(/\/$/, '')}/getSpcifyLunCalInfo`);
  url.searchParams.set('ServiceKey', serviceKey);
  // 음력 y년 후반(11~12월)은 양력 y+1년에 떨어지므로 검색 연 범위는 2년.
  url.searchParams.set('fromSolYear', String(lunar.year));
  url.searchParams.set('toSolYear', String(lunar.year + 1));
  url.searchParams.set('lunMonth', pad2(lunar.month));
  url.searchParams.set('lunDay', pad2(lunar.day));
  url.searchParams.set('leapMonth', lunar.isLeapMonth ? '윤' : '평');

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return null;
    const xml = await response.text();
    if (xmlField(xml, 'resultCode') !== '00') return null;

    // 연 범위 검색은 오염 행을 포함할 수 있으므로 요청한 음력 tuple 전체를 대조한다.
    for (const item of xmlItems(xml)) {
      if (Number(xmlField(item, 'lunYear')) !== lunar.year) continue;
      if (Number(xmlField(item, 'lunMonth')) !== lunar.month) continue;
      if (Number(xmlField(item, 'lunDay')) !== lunar.day) continue;
      if (xmlField(item, 'lunLeapmonth') !== (lunar.isLeapMonth ? '윤' : '평')) continue;
      const year = Number(xmlField(item, 'solYear'));
      const month = Number(xmlField(item, 'solMonth'));
      const day = Number(xmlField(item, 'solDay'));
      if (isValidSolarDate(year, month, day)) {
        return { year, month, day };
      }
    }
    return null;
  } catch {
    return null;
  }
}
