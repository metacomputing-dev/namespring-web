import type { Element, HanjaEntry, HanjaRepository } from "./types.js";
import { DEFAULT_HANJA_STROKE_COUNT } from "./constants.js";
import {
  openSqliteDatabase,
  type SqliteDatabase,
  type SqliteDatabaseOpener,
  type SqliteStatement,
} from "./sqlite-runtime.js";

interface HanjaRow {
  hangul: unknown;
  hanja: unknown;
  meaning: unknown;
  hoeksu: unknown;
  hoeksu_ohaeng: unknown;
  jawon_ohaeng: unknown;
  pronunciation_ohaeng: unknown;
  pronunciation_eumyang: unknown;
  hoeksu_eumyang: unknown;
  boosoo: unknown;
  is_surname: unknown;
}
const EARTH: Element = "土";
const ELEMENT_SET = new Set<Element>(["木", "火", "土", "金", "水"]);

function toInt(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function toBit(value: unknown): 0 | 1 {
  return toInt(value, 0) === 0 ? 0 : 1;
}

function toElement(value: unknown, fallback: Element): Element {
  const text = String(value ?? "").trim() as Element;
  return ELEMENT_SET.has(text) ? text : fallback;
}

function toText(value: unknown): string {
  return String(value ?? "").trim();
}

function toFallback(korean: string, hanja: string, isSurname: boolean): HanjaEntry {
  const hangul = (korean ?? "").trim().slice(0, 1) || "_";
  const h = (hanja ?? "").trim().slice(0, 1) || "_";
  return {
    hangul,
    hanja: h,
    meaning: "",
    strokeCount: DEFAULT_HANJA_STROKE_COUNT,
    strokeElement: EARTH,
    rootElement: EARTH,
    pronunciationElement: EARTH,
    pronunciationPolarityBit: 0,
    strokePolarityBit: 0,
    radical: "",
    isSurname,
  };
}

export class SqliteHanjaRepository implements HanjaRepository {
  private readonly db: SqliteDatabase;
  private readonly selectExact: SqliteStatement;
  private readonly selectByHanja: SqliteStatement;
  private readonly selectNameByHangul: SqliteStatement;
  private readonly selectSurnameByHangul: SqliteStatement;
  private readonly selectNameByHanja: SqliteStatement;
  private readonly selectNameByChosung: SqliteStatement;
  private readonly selectNameByJungsung: SqliteStatement;
  private readonly selectSurnamePair: SqliteStatement;

  static create(dbPath: string, opener?: SqliteDatabaseOpener): SqliteHanjaRepository {
    return new SqliteHanjaRepository(openSqliteDatabase(dbPath, opener ?? null));
  }

  static fromDatabase(db: SqliteDatabase): SqliteHanjaRepository {
    return new SqliteHanjaRepository(db);
  }

  constructor(db: SqliteDatabase) {
    this.db = db;
    this.selectExact = this.db.prepare(
      [
        "SELECT hangul, hanja, meaning, hoeksu, hoeksu_ohaeng, jawon_ohaeng,",
        "       pronunciation_ohaeng, pronunciation_eumyang, hoeksu_eumyang, boosoo, is_surname",
        "  FROM hanja_entries",
        " WHERE hangul = ? AND hanja = ? AND is_surname = ?",
        " LIMIT 1",
      ].join("\n"),
    );
    this.selectByHanja = this.db.prepare(
      [
        "SELECT hangul, hanja, meaning, hoeksu, hoeksu_ohaeng, jawon_ohaeng,",
        "       pronunciation_ohaeng, pronunciation_eumyang, hoeksu_eumyang, boosoo, is_surname",
        "  FROM hanja_entries",
        " WHERE hanja = ? AND is_surname = ?",
        " LIMIT 1",
      ].join("\n"),
    );
    this.selectNameByHangul = this.db.prepare(
      [
        "SELECT hangul, hanja, meaning, hoeksu, hoeksu_ohaeng, jawon_ohaeng,",
        "       pronunciation_ohaeng, pronunciation_eumyang, hoeksu_eumyang, boosoo, is_surname",
        "  FROM hanja_entries",
        " WHERE hangul = ? AND is_surname = 0",
      ].join("\n"),
    );
    this.selectSurnameByHangul = this.db.prepare(
      [
        "SELECT hangul, hanja, meaning, hoeksu, hoeksu_ohaeng, jawon_ohaeng,",
        "       pronunciation_ohaeng, pronunciation_eumyang, hoeksu_eumyang, boosoo, is_surname",
        "  FROM hanja_entries",
        " WHERE hangul = ? AND is_surname = 1",
      ].join("\n"),
    );
    this.selectNameByHanja = this.db.prepare(
      [
        "SELECT hangul, hanja, meaning, hoeksu, hoeksu_ohaeng, jawon_ohaeng,",
        "       pronunciation_ohaeng, pronunciation_eumyang, hoeksu_eumyang, boosoo, is_surname",
        "  FROM hanja_entries",
        " WHERE hanja = ? AND is_surname = 0",
      ].join("\n"),
    );
    this.selectNameByChosung = this.db.prepare(
      [
        "SELECT hangul, hanja, meaning, hoeksu, hoeksu_ohaeng, jawon_ohaeng,",
        "       pronunciation_ohaeng, pronunciation_eumyang, hoeksu_eumyang, boosoo, is_surname",
        "  FROM hanja_entries",
        " WHERE hangul_chosung = ? AND is_surname = 0",
      ].join("\n"),
    );
    this.selectNameByJungsung = this.db.prepare(
      [
        "SELECT hangul, hanja, meaning, hoeksu, hoeksu_ohaeng, jawon_ohaeng,",
        "       pronunciation_ohaeng, pronunciation_eumyang, hoeksu_eumyang, boosoo, is_surname",
        "  FROM hanja_entries",
        " WHERE hangul_jungsung = ? AND is_surname = 0",
      ].join("\n"),
    );
    this.selectSurnamePair = this.db.prepare("SELECT 1 FROM surname_pairs WHERE korean = ? AND hanja = ? LIMIT 1");
  }

  getHanjaInfo(korean: string, hanja: string, isSurname: boolean): HanjaEntry {
    const k = toText(korean);
    const h = toText(hanja);

    if (k && h) {
      const exact = this.selectExact.get(k, h, isSurname ? 1 : 0) as HanjaRow | undefined;
      if (exact) {
        return this.toEntry(exact, isSurname);
      }
    }

    if (h) {
      const byHanja = this.selectByHanja.get(h, isSurname ? 1 : 0) as HanjaRow | undefined;
      if (byHanja) {
        return this.toEntry(byHanja, isSurname);
      }
    }

    return toFallback(k || "_", h || "_", isSurname);
  }

  getHanjaStrokeCount(korean: string, hanja: string, isSurname: boolean): number {
    return this.getHanjaInfo(korean, hanja, isSurname).strokeCount;
  }

  getSurnamePairs(surname: string, surnameHanja: string): Array<{ korean: string; hanja: string }> {
    const k = Array.from((surname ?? "").trim());
    const h = Array.from((surnameHanja ?? "").trim());
    if (k.length <= 1) {
      return [{ korean: k[0] ?? "", hanja: h[0] ?? "" }];
    }
    const out: Array<{ korean: string; hanja: string }> = [];
    for (let i = 0; i < k.length; i += 1) {
      out.push({
        korean: k[i] ?? "",
        hanja: h[i] ?? "",
      });
    }
    return out;
  }

  isSurname(korean: string, hanja: string): boolean {
    const k = toText(korean);
    const h = toText(hanja);
    if (!k || !h) {
      return false;
    }
    const pair = this.selectSurnamePair.get(k, h);
    if (pair) {
      return true;
    }
    return Boolean(this.selectExact.get(k, h, 1));
  }

  findNameByHangul(hangul: string): readonly HanjaEntry[] {
    const h = toText(hangul);
    if (!h) {
      return [];
    }
    const rows = this.selectNameByHangul.all(h) as HanjaRow[];
    return rows.map((row) => this.toEntry(row, false));
  }

  findSurnameByHangul(hangul: string): readonly HanjaEntry[] {
    const h = toText(hangul);
    if (!h) {
      return [];
    }
    const rows = this.selectSurnameByHangul.all(h) as HanjaRow[];
    return rows.map((row) => this.toEntry(row, true));
  }

  findNameByHanja(hanja: string): readonly HanjaEntry[] {
    const h = toText(hanja);
    if (!h) {
      return [];
    }
    const rows = this.selectNameByHanja.all(h) as HanjaRow[];
    return rows.map((row) => this.toEntry(row, false));
  }

  findNameByChosung(chosung: string): readonly HanjaEntry[] {
    const c = toText(chosung);
    if (!c) {
      return [];
    }
    const rows = this.selectNameByChosung.all(c) as HanjaRow[];
    return rows.map((row) => this.toEntry(row, false));
  }

  findNameByJungsung(jungsung: string): readonly HanjaEntry[] {
    const j = toText(jungsung);
    if (!j) {
      return [];
    }
    const rows = this.selectNameByJungsung.all(j) as HanjaRow[];
    return rows.map((row) => this.toEntry(row, false));
  }

  private toEntry(row: HanjaRow, isSurnameFallback: boolean): HanjaEntry {
    return {
      hangul: toText(row.hangul),
      hanja: toText(row.hanja),
      meaning: toText(row.meaning),
      strokeCount: toInt(row.hoeksu, DEFAULT_HANJA_STROKE_COUNT),
      strokeElement: toElement(row.hoeksu_ohaeng, EARTH),
      rootElement: toElement(row.jawon_ohaeng, EARTH),
      pronunciationElement: toElement(row.pronunciation_ohaeng, EARTH),
      pronunciationPolarityBit: toBit(row.pronunciation_eumyang),
      strokePolarityBit: toBit(row.hoeksu_eumyang),
      radical: toText(row.boosoo),
      isSurname: toInt(row.is_surname, isSurnameFallback ? 1 : 0) === 1,
    };
  }
}
