// Five-element normalization and relation tables shared by the combined
// report view model. String-key based so it accepts engine values in
// English (Wood), Korean (목), or hanja (木) form.

export const ELEMENT_KEYS = ['wood', 'fire', 'earth', 'metal', 'water'];

const ELEMENT_ALIASES = {
  wood: 'wood', 목: 'wood', 木: 'wood',
  fire: 'fire', 화: 'fire', 火: 'fire',
  earth: 'earth', 토: 'earth', 土: 'earth',
  metal: 'metal', 금: 'metal', 金: 'metal',
  water: 'water', 수: 'water', 水: 'water',
};

export const ELEMENT_KO = {
  wood: '목', fire: '화', earth: '토', metal: '금', water: '수',
};

export const ELEMENT_HANJA = {
  wood: '木', fire: '火', earth: '土', metal: '金', water: '水',
};

const GENERATES = {
  wood: 'fire', fire: 'earth', earth: 'metal', metal: 'water', water: 'wood',
};

const OVERCOMES = {
  wood: 'earth', earth: 'water', water: 'fire', fire: 'metal', metal: 'wood',
};

export function normalizeElement(value) {
  const key = String(value ?? '').trim().toLowerCase();
  if (!key) return null;
  return ELEMENT_ALIASES[key] || ELEMENT_ALIASES[String(value).trim()] || null;
}

/** Relation of element `a` toward element `b`, in reading order. */
export function relationBetween(a, b) {
  const from = normalizeElement(a);
  const to = normalizeElement(b);
  if (!from || !to) return null;
  if (from === to) {
    return { type: 'same', label: `${ELEMENT_KO[from]}${ELEMENT_KO[to]} 동오행`, favorable: true };
  }
  if (GENERATES[from] === to) {
    return { type: 'generates', label: `${ELEMENT_KO[from]}생${ELEMENT_KO[to]}`, favorable: true };
  }
  if (GENERATES[to] === from) {
    return { type: 'generatedBy', label: `${ELEMENT_KO[to]}생${ELEMENT_KO[from]}`, favorable: true };
  }
  if (OVERCOMES[from] === to) {
    return { type: 'overcomes', label: `${ELEMENT_KO[from]}극${ELEMENT_KO[to]}`, favorable: false };
  }
  return { type: 'overcomeBy', label: `${ELEMENT_KO[to]}극${ELEMENT_KO[from]}`, favorable: false };
}

/** How a name character's element serves the yongshin target. */
export function relationToTarget(element, yongshin) {
  const from = normalizeElement(element);
  const to = normalizeElement(yongshin);
  if (!from || !to) return null;
  if (from === to) return { type: 'match', label: '용신 일치' };
  if (GENERATES[from] === to) return { type: 'generates', label: `${ELEMENT_KO[from]}생${ELEMENT_KO[to]}` };
  if (GENERATES[to] === from) return { type: 'drains', label: `${ELEMENT_KO[to]}생${ELEMENT_KO[from]}` };
  if (OVERCOMES[from] === to) return { type: 'controls', label: `${ELEMENT_KO[from]}극${ELEMENT_KO[to]}` };
  return { type: 'controlled', label: `${ELEMENT_KO[to]}극${ELEMENT_KO[from]}` };
}
