/**
 * '전 생애를 나란히' 10년 창 서사 등록부.
 *
 * 여기에 구간 서사를 채운다 — cls × framing 매트릭스.
 * BODY 매트릭스의 값이 null이면 화면에 본문을 그리지 않는다(자리표시 문구 금지).
 * headline은 지금 채워 둔 짧은 한 줄이고, body는 나중에 채울 긴 글 자리다.
 *
 * 문장 규칙: 결정론(같은 입력이면 같은 문장), 존댓말, framing-aware —
 * couple/companion은 동행의 어휘, guardian/kids는 돌봄·성장의 어휘.
 * complementary는 누가 받쳐 주는지 leader로 명시한다.
 */
import type { CompatFramingV1 } from '@spring/report/compatibility/index';

export type DaeunWindowClassV1 = 'both_high' | 'both_low' | 'complementary' | 'steady';

export interface DaeunWindowReading {
  headline: string;
  body: string | null;
}

/**
 * 구간 본문 매트릭스 — 지금은 전부 null.
 * 채울 때는 문자열을 넣기만 하면 화면이 문단을 그린다.
 */
const BODY: Record<DaeunWindowClassV1, Record<CompatFramingV1, string | null>> = {
  both_high: { couple: null, companion: null, guardian: null, kids: null },
  both_low: { couple: null, companion: null, guardian: null, kids: null },
  complementary: { couple: null, companion: null, guardian: null, kids: null },
  steady: { couple: null, companion: null, guardian: null, kids: null },
};

export function daeunWindowReading(
  cls: DaeunWindowClassV1,
  framing: CompatFramingV1,
  params: { aName: string; bName: string; leader?: 'a' | 'b' },
): DaeunWindowReading {
  const nurture = framing === 'guardian' || framing === 'kids';
  const leaderName = params.leader === 'b' ? params.bName : params.aName;
  const otherName = params.leader === 'b' ? params.aName : params.bName;
  const body = BODY[cls][framing];

  switch (cls) {
    case 'both_high':
      return {
        headline: nurture
          ? '두 사람의 흐름이 나란히 자라나는 시기예요. 함께 도전할 힘이 실리는 때로 읽어요.'
          : '두 흐름이 함께 높아지는 시기예요. 같이 도모하는 일에 힘이 실려요.',
        body,
      };
    case 'both_low':
      return {
        headline: nurture
          ? '두 흐름이 함께 웅크리는 시기예요. 속도를 재촉하기보다 곁을 지켜 주는 때로 읽어요.'
          : '두 흐름이 함께 숨을 고르는 시기예요. 무리한 확장보다 서로를 지키는 데 마음을 써요.',
        body,
      };
    case 'complementary':
      return {
        headline: nurture
          ? `${leaderName}의 흐름이 받쳐 주는 동안 ${otherName}의 흐름이 자라나는 시기예요.`
          : `${leaderName}의 흐름이 ${otherName}의 흐름을 받쳐 주는 시기예요. 한쪽이 쉬어 갈 때 기대어도 좋아요.`,
        body,
      };
    case 'steady':
      return {
        headline: nurture
          ? '두 흐름이 무난히 함께 걷는 시기예요. 일상의 리듬을 지키기 좋은 때예요.'
          : '두 흐름이 큰 굴곡 없이 나란히 걷는 시기예요.',
        body,
      };
  }
}
