/**
 * Tiny JSON-DSL for scoring/constraints.
 *
 * Goals:
 * - No string parsing
 * - Deterministic evaluation
 * - Traceable rule matches
 *
 * This is intentionally minimal; extend operators as needed.
 */

export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | JsonValue[] | { [k: string]: JsonValue };

export type ExprVar = { var: string };
export type ExprOp = { op: string; args?: Expr[] };

/**
 * Expression / template node.
 *
 * Important: we allow Expr nodes to appear anywhere inside a JSON-like tree
 * (e.g. rule.emit templates that embed {var:"..."} at leaf positions).
 */
export type Expr = JsonPrimitive | ExprVar | ExprOp | Expr[] | { [k: string]: Expr };

export interface Rule {
  id: string;
  when?: Expr; // defaults to true
  score?: Record<string, Expr>; // additive contributions
  emit?: Expr; // arbitrary json payload template (Expr nodes are evaluated)
  assert?: Expr; // if present and false -> warning
  explain?: string;
  tags?: string[];
}

export interface RuleSet {
  id: string;
  version: string;
  description?: string;
  rules: Rule[];
}

export interface RuleMatch {
  ruleId: string;
  explain?: string;
  scores?: Record<string, number>;
  emit?: JsonValue;
  tags?: string[];
}

export interface RuleEvalResult {
  scores: Record<string, number>;
  emits: JsonValue[];
  assertionsFailed: Array<{ ruleId: string; explain?: string }>;
  matches: RuleMatch[];
}

function isExprObject(x: any): x is ExprVar | ExprOp {
  return x && typeof x === 'object' && !Array.isArray(x) && (typeof x.var === 'string' || typeof x.op === 'string');
}

function getPath(obj: any, path: string): any {
  const parts = path.split('.');
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function asNumber(x: any): number {
  if (typeof x === 'number') return x;
  if (typeof x === 'boolean') return x ? 1 : 0;
  if (typeof x === 'string' && x.trim() !== '' && Number.isFinite(Number(x))) return Number(x);
  return NaN;
}

function truthy(x: any): boolean {
  if (typeof x === 'boolean') return x;
  if (x == null) return false;
  if (typeof x === 'number') return x !== 0 && !Number.isNaN(x);
  if (typeof x === 'string') return x.length > 0;
  if (Array.isArray(x)) return x.length > 0;
  return true;
}

function deepEvalTemplate(x: Expr, facts: any): JsonValue {
  if (x == null) return x;
  if (typeof x === 'boolean' || typeof x === 'number' || typeof x === 'string') return x;
  if (Array.isArray(x)) return x.map((v) => deepEvalTemplate(v, facts));
  if (isExprObject(x)) {
    // Expression object embedded as JSON
    return evalExpr(x as any, facts) as any;
  }
  const out: Record<string, JsonValue> = {};
  for (const [k, v] of Object.entries(x)) out[k] = deepEvalTemplate(v as Expr, facts);
  return out;
}

export function evalExpr(expr: Expr, facts: any): any {
  if (expr == null) return null;
  if (typeof expr === 'boolean' || typeof expr === 'number' || typeof expr === 'string') return expr;
  if (Array.isArray(expr)) return expr.map((x) => evalExpr(x, facts));

  if (!isExprObject(expr)) return expr as any;

  if ('var' in expr && typeof expr.var === 'string') {
    return getPath(facts, expr.var);
  }

  const op = (expr as any).op;
  const args = ((expr as any).args ?? []) as Expr[];
  const ev = (i: number) => evalExpr(args[i]!, facts);

  switch (op) {
    // --- logic
    case 'and':
      return args.every((_, i) => truthy(ev(i)));
    case 'or':
      return args.some((_, i) => truthy(ev(i)));
    case 'not':
      return !truthy(ev(0));

    // --- compare
    case 'eq':
      return ev(0) === ev(1);
    case 'ne':
      return ev(0) !== ev(1);
    case 'lt':
      return asNumber(ev(0)) < asNumber(ev(1));
    case 'lte':
      return asNumber(ev(0)) <= asNumber(ev(1));
    case 'gt':
      return asNumber(ev(0)) > asNumber(ev(1));
    case 'gte':
      return asNumber(ev(0)) >= asNumber(ev(1));

    // --- collections
    case 'in': {
      const v = ev(0);
      const c = ev(1);
      if (Array.isArray(c)) return c.includes(v);
      if (typeof c === 'string') return typeof v === 'string' ? c.includes(v) : false;
      if (c && typeof c === 'object') return Object.prototype.hasOwnProperty.call(c, String(v));
      return false;
    }
    case 'overlap': {
      const a = ev(0);
      const b = ev(1);
      if (!Array.isArray(a) || !Array.isArray(b)) return false;
      if (a.length === 0 || b.length === 0) return false;
      const setB = new Set(b);
      for (const x of a) if (setB.has(x)) return true;
      return false;
    }
    case 'intersect': {
      const a = ev(0);
      const b = ev(1);
      if (!Array.isArray(a) || !Array.isArray(b)) return [];
      const setB = new Set(b);
      const out: any[] = [];
      const seen = new Set<any>();
      for (const x of a) {
        if (setB.has(x) && !seen.has(x)) {
          seen.add(x);
          out.push(x);
        }
      }
      return out;
    }
    case 'len': {
      const v = ev(0);
      if (typeof v === 'string' || Array.isArray(v)) return v.length;
      if (v && typeof v === 'object') return Object.keys(v).length;
      return 0;
    }

    // --- arithmetic
    case 'add': {
      let acc = 0;
      for (let i = 0; i < args.length; i++) acc += asNumber(ev(i));
      return acc;
    }
    case 'sub':
      return asNumber(ev(0)) - asNumber(ev(1));
    case 'mul': {
      let acc = 1;
      for (let i = 0; i < args.length; i++) acc *= asNumber(ev(i));
      return acc;
    }
    case 'div':
      return asNumber(ev(0)) / asNumber(ev(1));
    case 'neg':
      return -asNumber(ev(0));
    case 'abs':
      return Math.abs(asNumber(ev(0)));
    case 'min':
      return Math.min(...args.map((_, i) => asNumber(ev(i))));
    case 'max':
      return Math.max(...args.map((_, i) => asNumber(ev(i))));
    case 'sum': {
      const v = ev(0);
      if (!Array.isArray(v)) return 0;
      return v.reduce((acc, x) => acc + asNumber(x), 0);
    }
    case 'clamp': {
      const x = asNumber(ev(0));
      const lo = asNumber(ev(1));
      const hi = asNumber(ev(2));
      return Math.min(hi, Math.max(lo, x));
    }

    // --- ternary
    case 'if':
      return truthy(ev(0)) ? ev(1) : ev(2);

    // --- default
    default:
      throw new Error(`Unknown DSL op: ${op}`);
  }
}

export function evalRuleSet(ruleSet: RuleSet, facts: any, initScores: Record<string, number> = {}): RuleEvalResult {
  const scores: Record<string, number> = { ...initScores };
  const emits: JsonValue[] = [];
  const assertionsFailed: Array<{ ruleId: string; explain?: string }> = [];
  const matches: RuleMatch[] = [];

  for (const r of ruleSet.rules) {
    const ok = r.when ? truthy(evalExpr(r.when, facts)) : true;
    if (!ok) continue;

    let match: RuleMatch | null = null;

    if (r.assert) {
      const passed = truthy(evalExpr(r.assert, facts));
      if (!passed) {
        assertionsFailed.push({ ruleId: r.id, explain: r.explain });
      }
    }

    if (r.score) {
      match = match ?? { ruleId: r.id, explain: r.explain, tags: r.tags };
      const contrib: Record<string, number> = {};
      for (const [k, vExpr] of Object.entries(r.score)) {
        const v = asNumber(evalExpr(vExpr, facts));
        if (!Number.isFinite(v)) continue;
        scores[k] = (scores[k] ?? 0) + v;
        contrib[k] = v;
      }
      match.scores = contrib;
    }

    if (r.emit != null) {
      match = match ?? { ruleId: r.id, explain: r.explain, tags: r.tags };
      const payload = deepEvalTemplate(r.emit as Expr, facts);
      emits.push(payload);
      match.emit = payload;
    }

    if (match) matches.push(match);
  }

  return { scores, emits, assertionsFailed, matches };
}
