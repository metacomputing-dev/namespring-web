import React, { useId, useMemo } from 'react';
import polarityNegative from './assets/images/polarity_negative.svg';
import polarityPositive from './assets/images/polarity_positive.svg';
import elementWood from './assets/images/element_wood.svg';
import elementFire from './assets/images/element_fire.svg';
import elementEarth from './assets/images/element_earth.svg';
import elementMetal from './assets/images/element_metal.svg';
import elementWater from './assets/images/element_water.svg';

// TEMP DEV FLAG: set to false (or remove) after scene tuning is done.
const DEV_FORCE_ALL_COUNTS_TO_FIVE = true;

function normalizeElementName(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'wood' || normalized === '목') return 'Wood';
  if (normalized === 'fire' || normalized === '화') return 'Fire';
  if (normalized === 'earth' || normalized === '토') return 'Earth';
  if (normalized === 'metal' || normalized === '금') return 'Metal';
  if (normalized === 'water' || normalized === '수') return 'Water';
  return '';
}

function resolveSummary(result) {
  const inputEntries = [...result.lastName, ...result.firstName];
  const elementCounts = { Wood: 0, Fire: 0, Earth: 0, Metal: 0, Water: 0 };
  for (const entry of inputEntries) {
    const key = normalizeElementName(entry.resource_element);
    if (key) {
      elementCounts[key] += 1;
    }
  }

  const hangulBlocks = typeof result.hangul?.getNameBlocks === 'function'
    ? result.hangul.getNameBlocks()
    : [];
  let positiveCount = 0;
  let negativeCount = 0;
  for (const block of hangulBlocks) {
    const polarity = block?.energy?.polarity?.english;
    if (polarity === 'Positive') positiveCount += 1;
    if (polarity === 'Negative') negativeCount += 1;
  }

  return {
    elementCounts,
    positiveCount,
    negativeCount,
    score: Number(result.totalScore ?? 0).toFixed(1),
    displayHangul: inputEntries.map((v) => v.hangul).join(''),
    displayHanja: inputEntries.map((v) => v.hanja).join(''),
  };
}

function SymbolIcon({ src, label }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <img src={src} alt={label} className="w-5 h-5 md:w-5 md:h-5" draggable="false" />
      <span className="text-[10px] font-black text-[var(--ns-muted)] whitespace-nowrap">{label}</span>
    </div>
  );
}

function clampCount(value) {
  return Math.max(0, Math.min(5, Number(value) || 0));
}

function TreeSprite() {
  return (
    <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="28" width="8" height="14" rx="2" fill="#7f5a38" stroke="#000000" strokeOpacity="0.5" strokeWidth="1" />
      <circle cx="24" cy="20" r="10" fill="#3ca95a" stroke="#000000" strokeOpacity="0.5" strokeWidth="1" />
      <circle cx="17" cy="22" r="7" fill="#4fbc68" stroke="#000000" strokeOpacity="0.5" strokeWidth="1" />
      <circle cx="31" cy="22" r="7" fill="#2f9d51" stroke="#000000" strokeOpacity="0.5" strokeWidth="1" />
    </svg>
  );
}

function GrassSprite() {
  return (
    <svg viewBox="0 0 48 48" className="w-8 h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 38C14 30 16 22 16 10" stroke="#000000" strokeOpacity="0.5" strokeWidth="5" strokeLinecap="round" />
      <path d="M8 38C14 30 16 22 16 10" stroke="#3a9d4e" strokeWidth="3" strokeLinecap="round" />
      <path d="M16 38C22 30 24 24 24 12" stroke="#000000" strokeOpacity="0.5" strokeWidth="5" strokeLinecap="round" />
      <path d="M16 38C22 30 24 24 24 12" stroke="#57b96b" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 38C30 30 34 22 38 11" stroke="#000000" strokeOpacity="0.5" strokeWidth="5" strokeLinecap="round" />
      <path d="M24 38C30 30 34 22 38 11" stroke="#3a9d4e" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function HouseSprite() {
  return (
    <svg viewBox="0 0 56 56" className="w-10 h-10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="14" y="24" width="28" height="22" rx="3" fill="#f5efe0" stroke="#000000" strokeOpacity="0.5" strokeWidth="1" />
      <path d="M10 26L28 12L46 26" fill="#c69a66" stroke="#000000" strokeOpacity="0.5" strokeWidth="1" strokeLinejoin="round" />
      <rect x="24" y="33" width="8" height="13" rx="1.5" fill="#8a7254" stroke="#000000" strokeOpacity="0.5" strokeWidth="1" />
    </svg>
  );
}

function CampfireBase() {
  return (
    <svg viewBox="0 0 64 64" className="w-24 h-24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 42L46 42" stroke="#000000" strokeOpacity="0.5" strokeWidth="5" strokeLinecap="round" />
      <path d="M22 46L40 30" stroke="#000000" strokeOpacity="0.5" strokeWidth="5" strokeLinecap="round" />
      <path d="M42 46L24 30" stroke="#000000" strokeOpacity="0.5" strokeWidth="5" strokeLinecap="round" />
      <path d="M18 42L46 42" stroke="#6f5138" strokeWidth="4" strokeLinecap="round" />
      <path d="M22 46L40 30" stroke="#7e5b3c" strokeWidth="4" strokeLinecap="round" />
      <path d="M42 46L24 30" stroke="#7e5b3c" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function FireSprite() {
  return (
    <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3C12 3 18 9 18 13.5C18 16.5 15.5 19 12 19C8.5 19 6 16.5 6 13.5C6 9 12 3 12 3Z" fill="#ff8f3c" stroke="#000000" strokeOpacity="0.5" strokeWidth="0.5" />
      <path d="M12 8C12 8 15 11 15 13C15 14.7 13.7 16 12 16C10.3 16 9 14.7 9 13C9 11 12 8 12 8Z" fill="#ffd05f" stroke="#000000" strokeOpacity="0.5" strokeWidth="0.5" />
    </svg>
  );
}

function NamingResultRenderer({ namingResult }) {
  const meadowGradientId = useId();
  const moonMaskId = useId();
  const cloudySunOutlineId = useId();
  const summary = useMemo(() => resolveSummary(namingResult), [namingResult]);
  const appliedSummary = DEV_FORCE_ALL_COUNTS_TO_FIVE
    ? {
        ...summary,
        elementCounts: { Wood: 5, Fire: 5, Earth: 5, Metal: 5, Water: 5 },
        positiveCount: 5,
        negativeCount: 5,
      }
    : summary;
  const isNightScene = appliedSummary.negativeCount > appliedSummary.positiveCount;
  const isEqualScene = appliedSummary.negativeCount === appliedSummary.positiveCount;
  const isPositiveDominantScene = appliedSummary.negativeCount < appliedSummary.positiveCount;
  const woodCount = clampCount(appliedSummary.elementCounts.Wood);
  const fireCount = clampCount(appliedSummary.elementCounts.Fire);
  const earthCount = clampCount(appliedSummary.elementCounts.Earth);
  const metalCount = clampCount(appliedSummary.elementCounts.Metal);
  const waterCount = clampCount(appliedSummary.elementCounts.Water);

  const symbolItems = [
    { label: `목 ${appliedSummary.elementCounts.Wood}`, src: elementWood },
    { label: `화 ${appliedSummary.elementCounts.Fire}`, src: elementFire },
    { label: `토 ${appliedSummary.elementCounts.Earth}`, src: elementEarth },
    { label: `금 ${appliedSummary.elementCounts.Metal}`, src: elementMetal },
    { label: `수 ${appliedSummary.elementCounts.Water}`, src: elementWater },
    { label: `음 ${appliedSummary.negativeCount}`, src: polarityNegative },
    { label: `양 ${appliedSummary.positiveCount}`, src: polarityPositive },
  ];
  const waterGrow = Math.max(0, waterCount - 1) * 0.825;
  const topShift = -waterGrow * 0.12;
  const bottomShift = waterGrow * 0.48;
  const f = (value) => Number(value).toFixed(1);
  const glowStyle = {
    textShadow: isNightScene
      ? '0 0 8px rgba(8, 14, 30, 0.85), 0 0 18px rgba(8, 14, 30, 0.45)'
      : isPositiveDominantScene
        ? '0 0 8px rgba(255, 236, 214, 0.9), 0 0 18px rgba(255, 220, 178, 0.6)'
        : '0 0 8px rgba(255, 255, 255, 0.85), 0 0 18px rgba(255, 255, 255, 0.55)',
  };
  const overlayExclude = { xMin: 72, yMin: 68 };
  const isExcluded = (left, top) => parseFloat(left) >= overlayExclude.xMin && parseFloat(top) >= overlayExclude.yMin;

  const treePositions = [
    { left: '9%', top: '67%' },
    { left: '4%', top: '77%' },
    { left: '1%', top: '65%' },
    { left: '14%', top: '75%' },
    { left: '21%', top: '80%' },
  ].filter((p) => !isExcluded(p.left, p.top));

  const grassPositions = [
    { left: '33%', top: '70%' },
    { left: '26%', top: '67%' },
    { left: '20%', top: '62%' },
    { left: '46%', top: '66%' },
    { left: '66%', top: '74%' },
  ];

  const housePositions = [
    { left: '37%', top: '73%' },
    { left: '32%', top: '81%' },
    { left: '42%', top: '83%' },
    { left: '27%', top: '76%' },
    { left: '49%', top: '79%' },
  ].filter((p) => !isExcluded(p.left, p.top));

  const fireFlamePositions = [
    { left: '50%', top: '50%' },
    { left: '67%', top: '55%' },
    { left: '35%', top: '55%' },
    { left: '42%', top: '42%' },
    { left: '60%', top: '42%' },
  ];

  return (
    <div className={`relative h-full w-full rounded-[1.6rem] border overflow-hidden ${isNightScene ? 'border-[#243258]' : isPositiveDominantScene ? 'border-[#f0b690]' : 'border-[#c8ddf1]'}`}>
      <div
        className={`absolute inset-0 ${
          isNightScene
            ? 'bg-gradient-to-b from-[#172445] via-[#111c37] to-[#0a1429]'
            : isPositiveDominantScene
              ? 'bg-gradient-to-b from-[#ffd4a1] via-[#ffb37e] to-[#ff9166]'
              : 'bg-gradient-to-b from-[#dff3ff] via-[#bfe7ff] to-[#9dd9ff]'
        }`}
      />

      <div className="absolute inset-x-0 bottom-0 h-[50%]">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 40" preserveAspectRatio="none">
          <defs>
            <linearGradient id={meadowGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7bca7f" />
              <stop offset="58%" stopColor="#56b868" />
              <stop offset="100%" stopColor="#3c9f50" />
            </linearGradient>
          </defs>
          <path d="M0 9C15 4 33 13 50 8C68 3 84 11 100 6V40H0V9Z" fill={`url(#${meadowGradientId})`} />
          <path d="M0 12C10 8 19 14 30 10C42 6 55 14 66 10C78 6 90 12 100 8V40H0V12Z" fill="#2e8747" opacity="0.25" />
        </svg>
      </div>

      <div className="absolute left-5 top-8 z-10">
        {isNightScene ? (
          <svg viewBox="0 0 64 64" className="h-10 w-10 md:h-12 md:w-12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <mask id={moonMaskId}>
                <rect width="64" height="64" fill="white" />
                <circle cx="36" cy="26" r="14" fill="black" />
              </mask>
            </defs>
            <circle
              cx="30"
              cy="30"
              r="14"
              fill="#f4f0cc"
              stroke="#000000"
              strokeOpacity="0.5"
              strokeWidth="1"
              mask={`url(#${moonMaskId})`}
            />
          </svg>
        ) : isEqualScene ? (
          <svg viewBox="0 0 96 64" className="h-10 w-14 md:h-12 md:w-16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id={cloudySunOutlineId} x="-30%" y="-40%" width="180%" height="200%" colorInterpolationFilters="sRGB">
                <feMorphology in="SourceAlpha" operator="dilate" radius="1" result="expanded" />
                <feComposite in="expanded" in2="SourceAlpha" operator="out" result="outlineOnly" />
                <feFlood floodColor="#000000" floodOpacity="0.5" result="outlineColor" />
                <feComposite in="outlineColor" in2="outlineOnly" operator="in" result="outlinePaint" />
                <feMerge>
                  <feMergeNode in="outlinePaint" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <g filter={`url(#${cloudySunOutlineId})`}>
              <circle cx="38" cy="29" r="15" fill="#ffd56a" />
              <circle cx="41" cy="40" r="14" fill="#ffffff" />
              <circle cx="58" cy="39.5" r="12" fill="#ffffff" />
              <circle cx="72" cy="41" r="8.5" fill="#ffffff" />
              <rect x="30" y="40" width="51" height="12.5" rx="6.25" fill="#ffffff" />
            </g>
          </svg>
        ) : (
          <svg viewBox="0 0 64 64" className="h-10 w-10 md:h-12 md:w-12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="30" cy="30" r="15" fill="#ffcf66" stroke="#000000" strokeOpacity="0.5" strokeWidth="1" />
            <path d="M30 8V14M30 46V52M8 30H14M46 30H52M14.8 14.8L19 19M41 41L45.2 45.2M14.8 45.2L19 41M41 19L45.2 14.8" stroke="#000000" strokeOpacity="0.5" strokeWidth="4.5" strokeLinecap="round" />
            <path d="M30 8V14M30 46V52M8 30H14M46 30H52M14.8 14.8L19 19M41 41L45.2 45.2M14.8 45.2L19 41M41 19L45.2 14.8" stroke="#f39a2e" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        )}
      </div>

      <svg className="absolute inset-0 w-full h-full z-[1]" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path
          d={`M-4 ${f(67.6 + topShift)}C8 ${f(65.4 + topShift)} 18 ${f(66.2 + topShift)} 30 ${f(68.0 + topShift)}C42 ${f(69.6 + topShift)} 54 ${f(71.6 + topShift)} 66 ${f(72.0 + topShift)}C77 ${f(72.3 + topShift)} 88 ${f(72.4 + topShift)} 96 ${f(73.0 + topShift)}C100 ${f(73.3 + topShift)} 102 ${f(73.7 + topShift)} 104 ${f(74.2 + topShift)}L104 ${f(84.8 + bottomShift)}C102 ${f(82.1 + bottomShift)} 100 ${f(80.6 + bottomShift)} 96 ${f(79.7 + bottomShift)}C88 ${f(77.7 + bottomShift)} 77 ${f(76.7 + bottomShift)} 66 ${f(75.8 + bottomShift)}C54 ${f(74.9 + bottomShift)} 42 ${f(73.5 + bottomShift)} 30 ${f(71.8 + bottomShift)}C18 ${f(70.3 + bottomShift)} 8 ${f(69.3 + bottomShift)} -4 ${f(67.9 + bottomShift)}Z`}
          fill="#2f87d6"
          fillOpacity={0.95}
        />
        <path
          d={`M-4 ${f(67.7 + topShift)}C8 ${f(66.2 + topShift)} 18 ${f(66.8 + topShift)} 30 ${f(68.2 + topShift)}C42 ${f(69.8 + topShift)} 54 ${f(71.6 + topShift)} 66 ${f(72.0 + topShift)}C77 ${f(72.2 + topShift)} 88 ${f(72.2 + topShift)} 96 ${f(72.8 + topShift)}C100 ${f(73.1 + topShift)} 102 ${f(73.4 + topShift)} 104 ${f(73.8 + topShift)}L104 ${f(77.2 + bottomShift * 0.45)}C101 ${f(76.5 + bottomShift * 0.45)} 99 ${f(76.1 + bottomShift * 0.45)} 96 ${f(75.6 + bottomShift * 0.45)}C88 ${f(74.7 + bottomShift * 0.45)} 77 ${f(74.2 + bottomShift * 0.45)} 66 ${f(73.7 + bottomShift * 0.45)}C54 ${f(73.2 + bottomShift * 0.45)} 42 ${f(72.3 + bottomShift * 0.45)} 30 ${f(71.2 + bottomShift * 0.45)}C18 ${f(70.3 + bottomShift * 0.45)} 8 ${f(69.6 + bottomShift * 0.45)} -4 ${f(68.3 + bottomShift * 0.45)}Z`}
          fill="#8dcbfb"
          fillOpacity={0.58}
        />
      </svg>

      {Array.from({ length: woodCount }).map((_, i) => (
        <div key={`wood-${i}`} className="absolute z-[2]" style={treePositions[i]}>
          <TreeSprite />
        </div>
      ))}

      {Array.from({ length: earthCount }).map((_, i) => (
        <div key={`earth-${i}`} className="absolute z-[2]" style={grassPositions[i]}>
          <GrassSprite />
        </div>
      ))}

      <div className="absolute z-[2] w-24 h-24" style={{ left: '58.7%', top: '77.5%', transform: 'translate(-50%, -50%)' }}>
        <div className="relative w-full h-full">
          <div className="absolute inset-0">
            <CampfireBase />
          </div>
          {Array.from({ length: fireCount }).map((_, i) => (
            <div
              key={`fire-${i}`}
              className="absolute z-[3]"
              style={{ left: fireFlamePositions[i].left, top: fireFlamePositions[i].top, transform: 'translate(-50%, -50%)' }}
            >
              <FireSprite />
            </div>
          ))}
        </div>
      </div>

      {Array.from({ length: metalCount }).map((_, i) => (
        <div key={`metal-${i}`} className="absolute z-[2]" style={housePositions[i]}>
          <HouseSprite />
        </div>
      ))}

      <div className="absolute inset-0 z-20 pointer-events-none px-4 py-5 md:px-6 md:py-6">
        <div className="absolute top-5 right-6 flex items-center flex-wrap justify-end gap-x-3 gap-y-2">
          {symbolItems.map((item) => (
            <div key={item.label} style={glowStyle}>
              <SymbolIcon src={item.src} label={item.label} />
            </div>
          ))}
        </div>

        <div className="absolute right-6 bottom-5 text-right shrink-0" style={glowStyle}>
          <p className={`text-xl md:text-2xl font-black ${isNightScene ? 'text-[#e8eefc]' : isPositiveDominantScene ? 'text-[#66361f]' : 'text-[#0f3857]'}`}>{appliedSummary.displayHangul} ({appliedSummary.displayHanja})</p>
          <p className={`text-sm font-bold mt-1 ${isNightScene ? 'text-[#9fb2d6]' : isPositiveDominantScene ? 'text-[#8a4d2a]' : 'text-[#365f83]'}`}>종합 점수 {appliedSummary.score}</p>
        </div>
      </div>
    </div>
  );
}

export default NamingResultRenderer;
