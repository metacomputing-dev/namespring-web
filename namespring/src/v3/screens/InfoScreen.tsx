import { Link } from 'react-router-dom';
import { Section } from '../ui/primitives';

/** 접었다 펴는 매뉴얼 항목. */
function Topic({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="v3-topic">
      <summary>{title}</summary>
      <div className="v3-topic-body">{children}</div>
    </details>
  );
}

function Term({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <li>
      <strong>{name}</strong> — {children}
    </li>
  );
}

export default function InfoScreen() {
  return (
    <main className="v3-page">
      <div className="v3-page-head">
        <p className="v3-kicker">정보</p>
        <h1 className="v3-page-title">이름봄 사용 안내</h1>
        <p className="v3-page-lede">
          화면 하나하나가 무엇을 보여주는지, 어떤 기준으로 계산하는지 이곳에 모아
          두었어요. 처음 오셨다면 위에서부터 천천히 읽어 보세요.
        </p>
      </div>

      <Section title="이름봄은 이런 서비스예요">
        <div className="v3-card">
          <p style={{ margin: 0 }}>
            이름봄은 태어난 순간의 기운(사주)과 이름에 담긴 뜻·소리를 나란히 읽는
            서비스예요. 두 자료를 억지로 하나의 점수로 합치지 않고, 각각 무엇을
            확인했는지 있는 그대로 보여드려요. 모든 무료 분석은 서버 없이 이 기기
            안에서 계산돼요.
          </p>
        </div>
      </Section>

      <Section title="화면 안내" lede="아래 다섯 화면이 이름봄의 중심이에요.">
        <div className="v3-card">
          <Topic title="통합 — 이름과 사주가 만나는 곳">
            <p>
              첫 화면이자 요약이에요. 이름 글자가 사주가 반기는 기운과 어디에서
              만나는지 한 문장으로 시작해, 이름 요약과 사주 요약을 같은 크기로 나란히
              보여드려요. 오행 비교 막대에서 위 줄은 사주 여덟 글자, 아래 줄은 이름
              글자의 오행 구성이에요.
            </p>
          </Topic>
          <Topic title="사주 — 타고난 기운의 흐름">
            <p>
              태어난 순간의 네 기둥(사주팔자)에서 시작해요. 나를 나타내는 글자(일간),
              기운의 세기, 사주가 반기는 기운, 사주의 골격을 먼저 읽고, 원국에서 실제로
              감지된 신호들(신살·공망·글자 사이 관계)을 카드로 보여드려요. 아래에는
              10년 단위 대운 곡선과 오늘·이번 주·이번 달·올해의 흐름이 이어져요.
            </p>
            <p>
              곡선의 높낮이는 각 대운의 기운이 사주가 반기는 기운과 얼마나 맞는지를
              별점으로 계산한 값 그대로예요. 점을 누르면 그 구간을 열어 볼 수 있어요.
            </p>
          </Topic>
          <Topic title="이름 — 뜻과 울림">
            <p>
              글자마다 담긴 뜻과 획수, 이어 불렀을 때의 발음 흐름, 획수를 네 시기로 읽는
              전통 방식(사격수리), 그리고 공식 통계에서 찾은 실제 사용 기록(인기 순위,
              성별 비율, 연도별 출생아 수, 비슷한 이름)을 보여드려요.
            </p>
          </Topic>
          <Topic title="작명 — 새 이름 후보">
            <p>
              같은 출생 정보를 기준으로 뜻·소리·획수·사주 어울림을 함께 계산해 이름
              후보를 골라요. 추천 순서는 계산 결과 그대로이고, 성별을 입력했다면 그
              성별에 주로 쓰이는 이름과 두루 쓰이는 이름을 먼저 보여드려요. 별표를
              누르면 보관함에 담기고, 후보를 열면 원래 입력은 그대로 둔 채 그 이름으로
              보고서를 읽어 볼 수 있어요.
            </p>
          </Topic>
          <Topic title="보관 · 계정">
            <p>
              보관함에는 별표로 담은 이름이 이 기기에만 저장돼요. 계정은 완성 리포트를
              다시 열고 다른 기기에서 이어 보기 위한 것으로, 로그인 없이도 모든 무료
              분석을 쓸 수 있어요. 계정 화면에서는 이 기기에 저장된 기록을 한 번에
              지울 수도 있어요.
            </p>
          </Topic>
        </div>
      </Section>

      <Section title="용어 사전" lede="보고서에 나오는 말들을 쉬운 말로 풀었어요.">
        <div className="v3-card">
          <Topic title="사주의 기본">
            <ul className="v3-plain-list">
              <Term name="사주팔자">
                태어난 연·월·일·시를 네 기둥으로 적은 여덟 글자예요. 하늘 글자(천간)와
                땅의 글자(지지)가 한 쌍씩이에요.
              </Term>
              <Term name="일간">
                태어난 날의 하늘 글자로, 사주에서 나 자신을 나타내는 기준점이에요.
              </Term>
              <Term name="오행">
                나무(목)·불(화)·흙(토)·쇠(금)·물(수) 다섯 기운이에요. 글자마다 하나씩
                오행이 배어 있어요.
              </Term>
              <Term name="음양">
                머금는 기운(음)과 드러내는 기운(양)의 짝이에요. 여덟 글자가 어느 쪽에
                많이 기울었는지를 저울로 보여드려요.
              </Term>
              <Term name="신강 · 신약">
                일간이 주변 글자들에게 힘을 받는 편이면 신강, 힘을 내어 주는 편이면
                신약이라고 불러요. 좋고 나쁨이 아니라 기운의 방향이에요.
              </Term>
              <Term name="용신">
                사주의 균형을 맞춰 주어 특히 반가운 기운이에요. 이름봄은 한국에서 널리
                쓰는 판단 기준을 기본으로 계산해요.
              </Term>
              <Term name="격국">
                사주 전체의 짜임새, 즉 골격이에요. 격이 온전히 이루어졌는지(성격),
                흔들리는 요소가 있는지(파격)도 함께 판정해요.
              </Term>
            </ul>
          </Topic>
          <Topic title="사주의 심화">
            <ul className="v3-plain-list">
              <Term name="십성">
                일간을 기준으로 다른 글자들과의 관계를 열 가지로 부르는 이름이에요.
                비견·식신·정재처럼요.
              </Term>
              <Term name="지장간">
                땅의 글자 속에 숨어 함께 작용하는 하늘 글자들이에요.
              </Term>
              <Term name="십이운성">
                기운이 나고 자라고 저무는 열두 단계예요. 장생·제왕·묘처럼 계절 같은
                이름이 붙어 있어요.
              </Term>
              <Term name="대운">
                인생을 10년씩 끊어 읽는 긴 호흡의 흐름이에요. 시작 나이와 순서는
                태어난 절기에서 계산돼요.
              </Term>
              <Term name="신살">
                원국에서 특정 자리들이 만드는 신호예요. 천덕귀인·도화살처럼 이름이
                붙어 있고, 이름봄은 실제로 감지된 것만 보여드려요.
              </Term>
              <Term name="공망">
                일주를 기준으로 비어 있다고 보는 두 자리예요. 그 영역은 준비를 한 번 더
                하면 든든하다고 읽어요.
              </Term>
              <Term name="합 · 충 · 형 · 파 · 해">
                글자 사이의 관계예요. 끌어당기고(합), 부딪히고(충), 다듬고(형),
                어긋나는(파·해) 식으로 서로 영향을 줘요.
              </Term>
            </ul>
          </Topic>
          <Topic title="이름 읽기">
            <ul className="v3-plain-list">
              <Term name="자원오행">
                한자의 뿌리 뜻에서 나오는 오행이에요. 예를 들어 秀(빼어날 수)는 벼가
                자라는 모습에서 나무 기운으로 읽어요.
              </Term>
              <Term name="발음 흐름">
                성과 이름을 이어 불렀을 때 소리가 자연스럽게 이어지는지를 실제 발음
                규칙으로 계산한 거예요.
              </Term>
              <Term name="사격수리">
                이름 획수를 네 묶음(초년·청년·중년·말년)으로 나눠 읽는 전통 방식이에요.
                질병이나 특정 사건을 예언하는 값이 아니에요.
              </Term>
              <Term name="인명용 한자">
                이름에 쓸 수 있도록 법으로 정해진 한자 목록에 있다는 뜻이에요. 쓸 수
                있는 자격이 있다는 것이지, 뜻이 더 좋다는 의미는 아니에요.
              </Term>
            </ul>
          </Topic>
        </div>
      </Section>

      <Section title="계산 원칙" lede="이름봄이 스스로에게 거는 약속이에요.">
        <div className="v3-card">
          <ul className="v3-plain-list">
            <li>화면의 모든 숫자와 별점은 실제 계산된 값 하나를 가리켜요. 없는 값은 만들지 않아요.</li>
            <li>사주와 이름은 서로 다른 자료라서, 억지로 하나의 총점으로 합치지 않아요.</li>
            <li>판단 방법이 유파마다 다를 수 있는 항목은 한국에서 널리 쓰는 기준을 기본으로 하나만 보여드려요.</li>
            <li>성격이나 인생의 특정 사건을 확정하는 표현은 쓰지 않아요.</li>
          </ul>
        </div>
      </Section>

      <Section title="자료 출처">
        <div className="v3-card">
          <ul className="v3-plain-list">
            <li>이름 사용 통계 — 대법원 전산 자료를 바탕으로 한 공식 이름 통계예요.</li>
            <li>연도별 비율 보정 — 통계청 인구동향조사의 연간 출생아 수를 기준으로 삼았어요.</li>
            <li>한자 사전 — 인명용 한자 목록과 획수·뜻 자료를 함께 담고 있어요.</li>
            <li>만세력 계산 — 절기 경계와 시간 보정(진태양시·경도·야자시)을 포함한 자체 계산 엔진이에요.</li>
          </ul>
        </div>
      </Section>

      <Section title="개인정보">
        <div className="v3-card">
          <ul className="v3-plain-list">
            <li>무료 분석의 이름·출생 정보는 서버로 보내지 않고 이 기기 안에서만 계산해요.</li>
            <li>공유할 때는 이름과 생년월일이 어떤 형태로도 실리지 않아요.</li>
            <li>
              저장된 기록은 <Link to="/account">계정 화면</Link>에서 언제든 한 번에 지울 수
              있어요.
            </li>
          </ul>
        </div>
      </Section>

      <p className="v3-hint" style={{ marginTop: 'var(--space-lg)', textAlign: 'center' }}>
        이 안내를 읽고도 궁금한 점이 남는다면, 그건 저희가 더 쉽게 설명해야 할
        몫이에요. — 이름봄 드림.
      </p>
    </main>
  );
}
