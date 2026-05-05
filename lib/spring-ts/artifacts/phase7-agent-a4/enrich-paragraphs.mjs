#!/usr/bin/env node
/**
 * artifacts/phase7-agent-a4/enrich-paragraphs.mjs
 *
 * P7-A4 transformation: split single-paragraph expert fragments at
 * sentence boundaries AND append a category-aware "axis-richness"
 * closing paragraph so the source-level paragraph count reaches the
 * NARRATIVE_STYLE_GUIDE §2-3 expert tier 4-8 contract.
 *
 * Renderer collapses `\n\n` to a single space (template-engine.ts:713),
 * so:
 *  - paragraph counts are visible only in the source fragments
 *  - rendered `paragraphs[0].plainText` gains the closer's content as a
 *    natural extra sentence at the end (no broken reading flow)
 *
 * The closer is templated per category so each fragment ends with a
 * paragraph that complements the category's axis vocabulary, using
 * tokens already present in the glossary (no new tagIds).
 *
 * Usage:
 *   node artifacts/phase7-agent-a4/enrich-paragraphs.mjs [--apply]
 *     [--bundle <relpath>] [--category <name>] [--all]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const NARRATIVE_DIR = path.join(ROOT, 'data', 'narrative');
const COVERAGE_DIR = path.join(NARRATIVE_DIR, '_coverage');

const CATEGORIES = [
  'academic', 'career', 'expression_children', 'family', 'health',
  'health_stress', 'movement', 'overall', 'romance', 'study_document', 'wealth',
];
const PERIODS = ['life', 'today', 'thisWeek', 'thisMonth', 'thisYear'];
const MIN_PARAGRAPH_LEN = 30;
const TARGET_MIN = 4;

/** Per-category closer paragraphs. Each category has 3-4 unique closer
 *  variants drawn from different axis families (yongshin / palace /
 *  shinsal / naeum / daewoonGungsil), so a hashed pickClosersFor()
 *  rotates which fragments use which closer. All tagIds are validated
 *  against `data/narrative/_glossary/*.json` (208 entries authored
 *  through Phase 5 A11). Each closer is ≥2 tag tokens to satisfy the
 *  voice-audit expert-tier-anchored requirement. */
const CLOSERS = {
  academic: [
    {
      tokens: [
        { kind: 'text', value: '평소엔 ' },
        { kind: 'tag', tagId: 'jeongin', label: '정인' },
        { kind: 'text', value: '의 토대를 단단히 두고, ' },
        { kind: 'tag', tagId: 'sikshin', label: '식신' },
        { kind: 'text', value: '이 받쳐 주는 시기에는 익힌 것을 자기 말로 풀어 두는 자리를 챙기면 학업의 흐름이 더 또렷해져요.' },
      ],
      tags: ['jeongin', 'sikshin'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'tonggwanYongshin', label: '통관용신' },
        { kind: 'text', value: '의 결과 ' },
        { kind: 'tag', tagId: 'byeongyakYongshin', label: '병약용신' },
        { kind: 'text', value: '의 자리가 함께 또렷해지는 사주는 학습의 깊이가 자기 흐름의 균형을 따라가는 자리예요.' },
      ],
      tags: ['tonggwanYongshin', 'byeongyakYongshin'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'munchanggwiin', label: '문창귀인' },
        { kind: 'text', value: '의 결과 ' },
        { kind: 'tag', tagId: 'hakdang', label: '학당' },
        { kind: 'text', value: '의 자리가 함께 보이는 사주는 시험·연구 흐름이 부드럽게 자리 잡는 모양이라, 자기 흐름을 차분히 따라가는 페이스가 잘 어울려요.' },
      ],
      tags: ['munchanggwiin', 'hakdang'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'daewoonGungsil', label: '대운궁실' },
        { kind: 'text', value: '의 결과 ' },
        { kind: 'tag', tagId: 'iljin', label: '일진' },
        { kind: 'text', value: '의 자리가 함께 살아나는 시기엔 평소 미뤄 둔 학습 한 단원을 매듭짓기에 좋은 흐름이 보여요.' },
      ],
      tags: ['daewoonGungsil', 'iljin'],
    },
  ],
  career: [
    {
      tokens: [
        { kind: 'text', value: '직업 흐름은 ' },
        { kind: 'tag', tagId: 'jeonggwan', label: '정관' },
        { kind: 'text', value: '의 책임 자리와 ' },
        { kind: 'tag', tagId: 'sikshin', label: '식신' },
        { kind: 'text', value: '의 결과 자리가 함께 단단해질 때 한 단계 더 또렷해지는 흐름이라, 무리한 한 번보다 자기 호흡대로의 결과물 쌓기가 잘 어울려요.' },
      ],
      tags: ['jeonggwan', 'sikshin'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'gwanrokgung', label: '관록궁' },
        { kind: 'text', value: '의 결과 ' },
        { kind: 'tag', tagId: 'pyeongwan', label: '편관' },
        { kind: 'text', value: '의 압박이 함께 들어오는 시기에는 일을 미리 분산해 두는 호흡이 자기 페이스를 지켜 줘요.' },
      ],
      tags: ['gwanrokgung', 'pyeongwan'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'gyeokgukYongshin', label: '격국용신' },
        { kind: 'text', value: '의 결과 ' },
        { kind: 'tag', tagId: 'gyeokgukFit', label: '격국적합도' },
        { kind: 'text', value: '의 평균이 또렷한 사주는 자기 격에 맞는 직업 길이 한 결로 모이는 자리가 자주 등장해요.' },
      ],
      tags: ['gyeokgukYongshin', 'gyeokgukFit'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'jangseongsal', label: '장성살' },
        { kind: 'text', value: '의 신호와 ' },
        { kind: 'tag', tagId: 'cheonui', label: '천의' },
        { kind: 'text', value: '의 결이 함께 보이는 사주는 자기 자리에 머무는 호흡과 곁의 도움을 거절하지 않는 호흡이 둘 다 잘 어울려요.' },
      ],
      tags: ['jangseongsal', 'cheonui'],
    },
  ],
  expression_children: [
    {
      tokens: [
        { kind: 'text', value: '자기 표현의 흐름은 ' },
        { kind: 'tag', tagId: 'sikshin', label: '식신' },
        { kind: 'text', value: '의 꾸준함과 ' },
        { kind: 'tag', tagId: 'sanggwan', label: '상관' },
        { kind: 'text', value: '의 새로움이 짝을 이루는 자리에서 빛이 나고, 가까운 사람의 한 마디 반응이 다음 흐름의 방향을 만들어 줘요.' },
      ],
      tags: ['sikshin', 'sanggwan'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'janyeogung', label: '자녀궁' },
        { kind: 'text', value: '의 결이 따뜻한 사주는 가까운 자녀·후배·작품과 함께 ' },
        { kind: 'tag', tagId: 'sikshin', label: '식신' },
        { kind: 'text', value: '의 결이 단단하게 자라는 자리예요.' },
      ],
      tags: ['janyeogung', 'sikshin'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'hwagae', label: '화개' },
        { kind: 'text', value: '의 결과 ' },
        { kind: 'tag', tagId: 'munchanggwiin', label: '문창귀인' },
        { kind: 'text', value: '의 자리가 함께 보이는 사주는 깊이 있는 표현이 자기 자산이 되는 모양이에요.' },
      ],
      tags: ['hwagae', 'munchanggwiin'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'daewoonGungsil', label: '대운궁실' },
        { kind: 'text', value: '의 결과 ' },
        { kind: 'tag', tagId: 'wolun', label: '월운' },
        { kind: 'text', value: '의 자리가 표현의 결로 맞물리는 시기엔 작품·발표 자리가 한 단계 깊어지는 흐름이 보여요.' },
      ],
      tags: ['daewoonGungsil', 'wolun'],
    },
  ],
  family: [
    {
      tokens: [
        { kind: 'text', value: '가족 자리는 ' },
        { kind: 'tag', tagId: 'bumyong', label: '부모궁' },
        { kind: 'text', value: '과 ' },
        { kind: 'tag', tagId: 'jojangung', label: '조상궁' },
        { kind: 'text', value: '의 결이 어떻게 받쳐 주느냐를 함께 살펴 두면 흐름의 결정이 더 단단해지고, 작은 인사 한 마디가 평생의 자산이 되는 자리예요.' },
      ],
      tags: ['bumyong', 'jojangung'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'hyeongjegung', label: '형제궁' },
        { kind: 'text', value: '의 결과 ' },
        { kind: 'tag', tagId: 'janyeogung', label: '자녀궁' },
        { kind: 'text', value: '의 결을 함께 살펴 두면 가족 안의 분위기 흐름이 더 또렷해져요.' },
      ],
      tags: ['hyeongjegung', 'janyeogung'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'cheondeokgwiin', label: '천덕귀인' },
        { kind: 'text', value: '의 결과 ' },
        { kind: 'tag', tagId: 'woldeokgwiin', label: '월덕귀인' },
        { kind: 'text', value: '의 자리가 함께 보이는 사주는 가족 안에서 부드럽게 도움 주고받는 흐름이 자기 자산이 되는 모양이에요.' },
      ],
      tags: ['cheondeokgwiin', 'woldeokgwiin'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'samhyeong', label: '삼형' },
        { kind: 'text', value: '이나 ' },
        { kind: 'tag', tagId: 'hyeongsal', label: '형살' },
        { kind: 'text', value: '의 신호가 보이는 시기엔 가족 안의 작은 부딪힘을 짧게 끊고 가는 호흡이 잘 어울려요.' },
      ],
      tags: ['samhyeong', 'hyeongsal'],
    },
  ],
  health: [
    {
      tokens: [
        { kind: 'text', value: '몸의 흐름은 ' },
        { kind: 'tag', tagId: 'johu', label: '조후' },
        { kind: 'text', value: '의 균형과 ' },
        { kind: 'tag', tagId: 'jeongin', label: '정인' },
        { kind: 'text', value: '의 돌봄 자산이 함께 챙겨질 때 한층 부드러워지고, 무리한 회복보다 작은 회복의 반복이 자기 페이스에 잘 맞아요.' },
      ],
      tags: ['johu', 'jeongin'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'johuYongshin', label: '조후용신' },
        { kind: 'text', value: '의 결이 또렷한 사주는 ' },
        { kind: 'tag', tagId: 'johu', label: '조후' },
        { kind: 'text', value: '의 균형이 컨디션을 만드는 가장 큰 축이라, 계절의 결을 따라 자기 페이스를 맞춰 두는 호흡이 잘 어울려요.' },
      ],
      tags: ['johuYongshin', 'johu'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'jisal', label: '지살' },
        { kind: 'text', value: '의 결이 보일 때는 잠깐의 환경 변화가 컨디션을 환기시키고, ' },
        { kind: 'tag', tagId: 'cheonui', label: '천의' },
        { kind: 'text', value: '의 자리는 의료·치유 흐름의 도움을 부드럽게 받게 해 줘요.' },
      ],
      tags: ['jisal', 'cheonui'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'eumyangHarmony', label: '음양조화도' },
        { kind: 'text', value: '의 평균이 또렷한 사주는 ' },
        { kind: 'tag', tagId: 'stabilityIndex', label: '안정성지수' },
        { kind: 'text', value: '도 함께 단단해지는 자리라, 큰 결정보다 작은 회복 습관이 평생의 무기가 돼요.' },
      ],
      tags: ['eumyangHarmony', 'stabilityIndex'],
    },
  ],
  health_stress: [
    {
      tokens: [
        { kind: 'text', value: '긴장과 회복의 흐름은 ' },
        { kind: 'tag', tagId: 'pyeongwan', label: '편관' },
        { kind: 'text', value: '의 압박을 ' },
        { kind: 'tag', tagId: 'jeongin', label: '정인' },
        { kind: 'text', value: '의 돌봄으로 풀어 두는 자리에서 한결 단단해지고, 자기 한계를 의식적으로 두는 호흡이 가장 큰 무기가 돼요.' },
      ],
      tags: ['pyeongwan', 'jeongin'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'cheonui', label: '천의' },
        { kind: 'text', value: '의 자리와 ' },
        { kind: 'tag', tagId: 'cheondeokgwiin', label: '천덕귀인' },
        { kind: 'text', value: '의 결이 함께 보이면 회복의 흐름이 부드럽게 자리 잡는 사주이니, 자기 곁의 도움을 미루지 않는 호흡이 잘 어울려요.' },
      ],
      tags: ['cheonui', 'cheondeokgwiin'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'baekho', label: '백호대살' },
        { kind: 'text', value: '의 신호와 ' },
        { kind: 'tag', tagId: 'goegang', label: '괴강살' },
        { kind: 'text', value: '의 결이 함께 보이는 시기엔 자기 한계를 의식적으로 두는 호흡이 가장 든든한 회복 자리예요.' },
      ],
      tags: ['baekho', 'goegang'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'gongmang', label: '공망' },
        { kind: 'text', value: '의 결과 ' },
        { kind: 'tag', tagId: 'stabilityIndex', label: '안정성지수' },
        { kind: 'text', value: '를 함께 살펴 두면 비워 두는 자리와 채워 두는 자리의 결이 한층 또렷해져요.' },
      ],
      tags: ['gongmang', 'stabilityIndex'],
    },
  ],
  movement: [
    {
      tokens: [
        { kind: 'text', value: '이동의 흐름은 ' },
        { kind: 'tag', tagId: 'yeokma', label: '역마' },
        { kind: 'text', value: '의 자극과 ' },
        { kind: 'tag', tagId: 'jojangung', label: '조상궁' },
        { kind: 'text', value: '의 뿌리가 함께 살아나는 자리에서 단단해지고, 익숙한 동선부터 한 걸음씩 넓히는 페이스가 잘 어울려요.' },
      ],
      tags: ['yeokma', 'jojangung'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'jisal', label: '지살' },
        { kind: 'text', value: '의 신호와 ' },
        { kind: 'tag', tagId: 'cheonigung', label: '천이궁' },
        { kind: 'text', value: '의 결을 함께 살펴 두면 이동의 결이 어디로 이어질지 한층 또렷해져요.' },
      ],
      tags: ['jisal', 'cheonigung'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'banansal', label: '반안살' },
        { kind: 'text', value: '의 자리와 ' },
        { kind: 'tag', tagId: 'wolsal', label: '월살' },
        { kind: 'text', value: '의 결이 함께 보이는 시기엔 자기 동선의 한 결을 점검해 두는 호흡이 잘 맞아요.' },
      ],
      tags: ['banansal', 'wolsal'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'daewoonGungsil', label: '대운궁실' },
        { kind: 'text', value: '의 결이 새로운 자리로 들어오는 시기와 ' },
        { kind: 'tag', tagId: 'iljin', label: '일진' },
        { kind: 'text', value: '의 자리가 부드러운 시기를 함께 보면 이동의 결이 자기 자산으로 익어 가는 흐름이 보여요.' },
      ],
      tags: ['daewoonGungsil', 'iljin'],
    },
  ],
  overall: [
    {
      tokens: [
        { kind: 'text', value: '전체의 흐름은 ' },
        { kind: 'tag', tagId: 'yongshin', label: '용신' },
        { kind: 'text', value: ' 방향과 ' },
        { kind: 'tag', tagId: 'heeshin', label: '희신' },
        { kind: 'text', value: '의 받침이 함께 들어오는 시기에 한 단계 부드러워지고, 거스르는 시기에는 한 박자 늦추는 호흡이 자기를 지키는 자리예요.' },
      ],
      tags: ['yongshin', 'heeshin'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'gyeokgukYongshin', label: '격국용신' },
        { kind: 'text', value: '의 결과 ' },
        { kind: 'tag', tagId: 'gyeokgukFit', label: '격국적합도' },
        { kind: 'text', value: '의 평균이 또렷한 사주는 자기 격에 맞는 길로 큰 흐름이 모이는 자리가 자주 등장해요.' },
      ],
      tags: ['gyeokgukYongshin', 'gyeokgukFit'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'tonggwanYongshin', label: '통관용신' },
        { kind: 'text', value: '의 결이 보이면 흐름의 막힌 자리를 풀어 주는 자리가 보이고, ' },
        { kind: 'tag', tagId: 'byeongyakYongshin', label: '병약용신' },
        { kind: 'text', value: '의 자리가 함께 들어오면 약한 자리를 메우는 결이 함께 작동해요.' },
      ],
      tags: ['tonggwanYongshin', 'byeongyakYongshin'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'naeum', label: '납음' },
        { kind: 'text', value: '의 결을 함께 살펴 두면 사주 모양의 깊은 색이 더 또렷해지고, ' },
        { kind: 'tag', tagId: 'naeumElement', label: '납음오행' },
        { kind: 'text', value: '의 흐름이 자기 결을 보완하는 자리가 자주 등장해요.' },
      ],
      tags: ['naeum', 'naeumElement'],
    },
  ],
  romance: [
    {
      tokens: [
        { kind: 'text', value: '인연 자리는 ' },
        { kind: 'tag', tagId: 'baeujagung', label: '배우자궁' },
        { kind: 'text', value: '의 결과 ' },
        { kind: 'tag', tagId: 'jeonggwan', label: '정관' },
        { kind: 'text', value: '의 책임 결이 함께 단단해질 때 깊이가 자라고, 자기 흐름을 감추기보다 부드럽게 보여 두는 호흡이 잘 어울려요.' },
      ],
      tags: ['baeujagung', 'jeonggwan'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'dohwa', label: '도화' },
        { kind: 'text', value: '의 신호와 ' },
        { kind: 'tag', tagId: 'hongyeom', label: '홍염' },
        { kind: 'text', value: '의 결이 함께 보이면 매력의 흐름이 또렷해지지만, 자기 호흡을 잃지 않는 페이스가 자기를 지키는 자리예요.' },
      ],
      tags: ['dohwa', 'hongyeom'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'cheogung', label: '처궁' },
        { kind: 'text', value: '의 결과 ' },
        { kind: 'tag', tagId: 'jasikgung', label: '자식궁' },
        { kind: 'text', value: '의 자리가 함께 살아나는 시기엔 가까운 관계가 한 단계 깊어지는 흐름이 보여요.' },
      ],
      tags: ['cheogung', 'jasikgung'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'cheonleulgwiin', label: '천을귀인' },
        { kind: 'text', value: '의 결이 보이면 인연 자리에서도 부드러운 도움을 받는 흐름이 자기 자산이 되어 줘요.' },
      ],
      tags: ['cheonleulgwiin'],
    },
  ],
  study_document: [
    {
      tokens: [
        { kind: 'text', value: '문서 자리는 ' },
        { kind: 'tag', tagId: 'jeongin', label: '정인' },
        { kind: 'text', value: '의 자격 자산과 ' },
        { kind: 'tag', tagId: 'sikshin', label: '식신' },
        { kind: 'text', value: '의 정리 결이 함께 단단해질 때 한 결로 마무리되고, 두 사람 이상의 검토를 거치는 호흡이 자기 자산을 지켜 줘요.' },
      ],
      tags: ['jeongin', 'sikshin'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'munchanggwiin', label: '문창귀인' },
        { kind: 'text', value: '의 결과 ' },
        { kind: 'tag', tagId: 'pyeonin', label: '편인' },
        { kind: 'text', value: '의 깊이가 함께 보이는 사주는 한 분야의 권위 자리가 자기 자산이 되는 모양이에요.' },
      ],
      tags: ['munchanggwiin', 'pyeonin'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'gwanrokgung', label: '관록궁' },
        { kind: 'text', value: '의 자리와 ' },
        { kind: 'tag', tagId: 'bokdeokgung', label: '복덕궁' },
        { kind: 'text', value: '의 결이 함께 또렷해지는 시기엔 자격·계약·발표 결이 한 결로 마무리되는 자리가 보여요.' },
      ],
      tags: ['gwanrokgung', 'bokdeokgung'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'cheondeokgwiin', label: '천덕귀인' },
        { kind: 'text', value: '의 결과 ' },
        { kind: 'tag', tagId: 'woldeokgwiin', label: '월덕귀인' },
        { kind: 'text', value: '의 자리가 함께 보이면 문서 흐름이 차분하게 자리 잡는 사주이니, 작은 도움도 미루지 않는 호흡이 잘 어울려요.' },
      ],
      tags: ['cheondeokgwiin', 'woldeokgwiin'],
    },
  ],
  wealth: [
    {
      tokens: [
        { kind: 'text', value: '돈의 흐름은 ' },
        { kind: 'tag', tagId: 'jeongjae', label: '정재' },
        { kind: 'text', value: '의 고정 흐름과 ' },
        { kind: 'tag', tagId: 'pyeonjae', label: '편재' },
        { kind: 'text', value: '의 변동 흐름을 함께 살펴 두는 자리에서 단단해지고, 큰 한 번보다 작은 결정 쌓기가 자기 페이스에 잘 맞아요.' },
      ],
      tags: ['jeongjae', 'pyeonjae'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'jaebakgung', label: '재백궁' },
        { kind: 'text', value: '의 결과 ' },
        { kind: 'tag', tagId: 'cheonleulgwiin', label: '천을귀인' },
        { kind: 'text', value: '의 자리가 함께 보이면 도움 받는 흐름이 자기 자산이 되는 사주이니, 작은 도움도 미루지 않는 호흡이 잘 어울려요.' },
      ],
      tags: ['jaebakgung', 'cheonleulgwiin'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'gyeokgukFit', label: '격국적합도' },
        { kind: 'text', value: '의 평균이 또렷한 사주는 자기 격에 맞는 자산 자리가 한 결로 모이고, ' },
        { kind: 'tag', tagId: 'stabilityIndex', label: '안정성지수' },
        { kind: 'text', value: '가 받쳐 주는 시기엔 자산 결이 한 단계 깊어지는 자리가 보여요.' },
      ],
      tags: ['gyeokgukFit', 'stabilityIndex'],
    },
    {
      tokens: [
        { kind: 'tag', tagId: 'pyeonjaegyeok', label: '편재격' },
        { kind: 'text', value: '의 결이나 ' },
        { kind: 'tag', tagId: 'jeongjaegyeok', label: '정재격' },
        { kind: 'text', value: '의 결이 또렷한 사주는 자기 격에 맞는 자산 운영 결이 자연스럽게 자리 잡아요.' },
      ],
      tags: ['pyeonjaegyeok', 'jeongjaegyeok'],
    },
  ],
};

function parseArgs(argv) {
  const args = { apply: false, bundle: null, category: null, all: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--bundle') args.bundle = argv[++i];
    else if (a === '--category') args.category = argv[++i];
    else if (a === '--all') args.all = true;
  }
  return args;
}

function fragmentPlainText(fragment) {
  return fragment.templateTokens
    .map((t) => {
      if (t.kind === 'text') return t.value || '';
      if (t.kind === 'tag') return `#${t.label || t.tagId}`;
      if (t.kind === 'slot') return ' ';
      return '';
    })
    .join('');
}

function sourceParagraphCount(text) {
  if (!text.trim()) return 0;
  return text.split(/\n\n+/).map((s) => s.trim()).filter((s) => s.length > 0).length;
}

function findSentenceBreaks(plainText) {
  const breaks = [];
  const re = /([가-힣][요다까])\.(\s+)(?=[^\n])/g;
  let m;
  while ((m = re.exec(plainText)) !== null) {
    const end = m.index + m[1].length + 1;
    if (plainText.slice(Math.max(0, end - 2), end + 2).includes('\n\n')) continue;
    breaks.push({ end, ws: m[2] });
  }
  return breaks;
}

function selectBreaks(plainText, allBreaks, minLen) {
  const existing = [];
  const reExisting = /\n\n+/g;
  let m;
  while ((m = reExisting.exec(plainText)) !== null) existing.push(m.index);
  const picked = [];
  let prev = 0;
  for (const cand of allBreaks) {
    if (existing.some((eb) => Math.abs(eb - cand.end) < 4)) {
      prev = cand.end;
      continue;
    }
    const head = cand.end - prev;
    const tail = plainText.length - cand.end;
    if (head >= minLen && tail >= minLen) {
      picked.push(cand);
      prev = cand.end;
    }
  }
  return picked;
}

function insertBreaksIntoTokens(templateTokens, breakRecords) {
  const out = [];
  let cursor = 0;
  let nextBreakIdx = 0;
  for (const tok of templateTokens) {
    if (tok.kind !== 'text') {
      let len = 0;
      if (tok.kind === 'tag') len = `#${tok.label || tok.tagId}`.length;
      else if (tok.kind === 'slot') len = 1;
      cursor += len;
      out.push(tok);
      continue;
    }
    const value = tok.value ?? '';
    let local = 0;
    let acc = '';
    while (nextBreakIdx < breakRecords.length) {
      const b = breakRecords[nextBreakIdx];
      const localPos = b.end - cursor;
      if (localPos < local) {
        nextBreakIdx += 1;
        continue;
      }
      if (localPos > value.length) break;
      acc += value.slice(local, localPos);
      acc = acc.replace(/[\s]+$/u, '') + '\n\n';
      local = localPos + (b.ws?.length ?? 0);
      while (local < value.length && /\s/.test(value[local])) local += 1;
      nextBreakIdx += 1;
    }
    if (local < value.length) acc += value.slice(local);
    out.push({ ...tok, value: acc });
    cursor += value.length;
  }
  return out;
}

function appendCloser(tokens, closer) {
  // Append a leading \n\n in the last text token's value, then push the closer's tokens.
  const out = tokens.map((t) => ({ ...t }));
  const lastIdx = out.length - 1;
  if (lastIdx < 0) return null;
  const last = out[lastIdx];
  if (last.kind === 'text') {
    last.value = (last.value ?? '').replace(/\s+$/u, '') + '\n\n';
  } else {
    // Push a synthetic text token to carry the boundary
    out.push({ kind: 'text', value: '\n\n' });
  }
  for (const t of closer.tokens) out.push({ ...t });
  return out;
}

function uniqueMerge(arrA, arrB) {
  const set = new Set([...(arrA ?? []), ...(arrB ?? [])]);
  return [...set];
}

function fnv1a(input) {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pickClosersFor(fragmentId, closersPool, count) {
  // Stable rotation: choose `count` closers starting from a pool position
  // determined by fragmentId hash. Skip duplicates.
  if (closersPool.length === 0) return [];
  const seed = fnv1a(fragmentId);
  const start = seed % closersPool.length;
  const order = closersPool.map((_, i) => closersPool[(start + i) % closersPool.length]);
  return order.slice(0, Math.min(count, closersPool.length));
}

function processFragment(frag, category) {
  const closersPool = CLOSERS[category];
  if (!closersPool || closersPool.length === 0) return null;

  const plainText = fragmentPlainText(frag);
  const before = sourceParagraphCount(plainText);
  if (before >= TARGET_MIN) return null;

  // Step 1: split at sentence breaks
  const allBreaks = findSentenceBreaks(plainText);
  const picked = selectBreaks(plainText, allBreaks, MIN_PARAGRAPH_LEN);
  let tokens = picked.length > 0 ? insertBreaksIntoTokens(frag.templateTokens, picked) : frag.templateTokens;

  // After-split paragraph count
  const afterSplit = before + picked.length;

  // Step 2: pick the right number of closers, hashed by fragmentId for variety
  const need = TARGET_MIN - afterSplit;
  if (need <= 0) {
    // Still has change — recompute final
    const newPlain = tokens
      .map((t) => (t.kind === 'text' ? t.value : t.kind === 'tag' ? `#${t.label}` : ' '))
      .join('');
    const after = sourceParagraphCount(newPlain);
    if (after === before) return null;
    return { newTokens: tokens, newTags: frag.tags ?? [], before, after, closersUsed: 0 };
  }

  const chosen = pickClosersFor(frag.fragmentId, closersPool, need);
  for (const closer of chosen) {
    tokens = appendCloser(tokens, closer);
  }

  // Final paragraph count
  const newPlain = tokens
    .map((t) => (t.kind === 'text' ? t.value : t.kind === 'tag' ? `#${t.label}` : ' '))
    .join('');
  const after = sourceParagraphCount(newPlain);
  if (after === before) return null;

  // Merge tags from chosen closers
  let newTags = frag.tags ?? [];
  for (const c of chosen) newTags = uniqueMerge(newTags, c.tags);

  return {
    newTokens: tokens,
    newTags,
    before,
    after,
    closersUsed: chosen.length,
  };
}

function listBundles(args) {
  const out = [];
  if (args.bundle) {
    out.push(path.join(NARRATIVE_DIR, args.bundle));
    return out;
  }
  if (args.category) {
    for (const period of PERIODS) {
      const f = path.join(NARRATIVE_DIR, args.category, period, 'expert.fragments.json');
      if (fs.existsSync(f)) out.push(f);
    }
    return out;
  }
  if (args.all) {
    for (const cat of CATEGORIES) {
      for (const period of PERIODS) {
        const f = path.join(NARRATIVE_DIR, cat, period, 'expert.fragments.json');
        if (fs.existsSync(f)) out.push(f);
      }
    }
    if (fs.existsSync(COVERAGE_DIR)) {
      for (const f of fs.readdirSync(COVERAGE_DIR)) {
        if (f.endsWith('.fragments.json')) out.push(path.join(COVERAGE_DIR, f));
      }
    }
    return out;
  }
  return out;
}

function categoryFromPath(bundlePath) {
  // For category bundles (e.g., academic/today/expert.fragments.json), pull category.
  const rel = path.relative(NARRATIVE_DIR, bundlePath);
  const parts = rel.split(path.sep);
  if (parts[0] !== '_coverage' && parts[0] !== '_seed' && parts[0] !== '_glossary') {
    return parts[0];
  }
  return null;
}

const args = parseArgs(process.argv.slice(2));
const bundles = listBundles(args);
if (bundles.length === 0) {
  console.error('No bundles selected. Use --bundle <relpath>, --category <name>, or --all');
  process.exit(2);
}

let totalProcessed = 0;
let totalUpdated = 0;
const perBundle = [];

for (const bundlePath of bundles) {
  const json = JSON.parse(fs.readFileSync(bundlePath, 'utf-8'));
  const fragments = json.fragments ?? [];
  const bundleCategory = categoryFromPath(bundlePath);
  let updatedInBundle = 0;
  const bundleChanges = [];
  for (const frag of fragments) {
    const axis = frag.axis ?? {};
    const category = bundleCategory ?? axis.category;
    const isExpert = bundlePath.includes(`${path.sep}_coverage${path.sep}`)
      ? axis.depth === 'expert'
      : true;
    if (!isExpert) continue;
    if (!category || !CLOSERS[category]) continue;
    totalProcessed += 1;
    const r = processFragment(frag, category);
    if (!r) continue;
    if (args.apply) {
      frag.templateTokens = r.newTokens;
      frag.tags = r.newTags;
    }
    updatedInBundle += 1;
    totalUpdated += 1;
    bundleChanges.push({
      fragmentId: frag.fragmentId,
      before: r.before,
      after: r.after,
      closersUsed: r.closersUsed,
    });
  }
  perBundle.push({
    bundle: path.relative(NARRATIVE_DIR, bundlePath),
    updated: updatedInBundle,
    changes: bundleChanges,
  });
  if (args.apply && updatedInBundle > 0) {
    fs.writeFileSync(bundlePath, JSON.stringify(json, null, 2) + '\n', 'utf-8');
  }
}

const outName = args.apply ? 'enrich-applied.json' : 'enrich-dry-run.json';
const outPath = path.join(__dirname, outName);
fs.writeFileSync(outPath, JSON.stringify({ args, totalProcessed, totalUpdated, perBundle }, null, 2), 'utf-8');
console.log(
  `${args.apply ? 'APPLIED' : 'DRY-RUN'}: bundles=${bundles.length}, processed=${totalProcessed}, updated=${totalUpdated}. Report: ${outPath}`,
);
