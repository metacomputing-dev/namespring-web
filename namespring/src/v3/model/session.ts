/**
 * 계정 상태 조회.
 *
 * 서버의 안전 발견 계약을 그대로 따른다:
 * - GET /api/auth/policy  — 켜져 있는 로그인 제공자 목록(비어 있으면 미구성)
 * - GET /api/auth/current — 쿠키가 없으면 익명(로컬) 상태를 돌려준다
 * 네트워크가 없거나 배포가 준비 전이면 'unavailable'로 정직하게 표시한다.
 */

export type AuthStatus =
  | { state: 'loading' }
  | { state: 'signed_in'; providers: string[] }
  | { state: 'signed_out'; enabledProviders: string[] }
  | { state: 'unavailable' };

async function fetchJson(path: string): Promise<unknown | null> {
  try {
    const response = await fetch(path, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function fetchAuthStatus(): Promise<AuthStatus> {
  const [policy, current] = await Promise.all([
    fetchJson('/api/auth/policy'),
    fetchJson('/api/auth/current'),
  ]);

  const enabledProviders: string[] = Array.isArray((policy as { providers?: unknown })?.providers)
    ? ((policy as { providers: unknown[] }).providers.filter(
        (value): value is string => typeof value === 'string',
      ))
    : Array.isArray((policy as { enabledProviders?: unknown })?.enabledProviders)
      ? ((policy as { enabledProviders: unknown[] }).enabledProviders.filter(
          (value): value is string => typeof value === 'string',
        ))
      : [];

  if (current && typeof current === 'object') {
    const record = current as Record<string, unknown>;
    const accountState = typeof record.accountState === 'string' ? record.accountState : null;
    const linked = Array.isArray(record.linkedProviders)
      ? (record.linkedProviders as unknown[]).filter(
          (value): value is string => typeof value === 'string',
        )
      : [];
    if (accountState && accountState !== 'anonymous' && accountState !== 'none') {
      return { state: 'signed_in', providers: linked };
    }
    return { state: 'signed_out', enabledProviders };
  }

  if (policy) return { state: 'signed_out', enabledProviders };
  return { state: 'unavailable' };
}

export const PROVIDER_LABELS: Record<string, string> = {
  kakao_oidc: '카카오로 계속하기',
  google: '구글로 계속하기',
  email_link: '이메일 링크로 계속하기',
};
