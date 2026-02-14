import type { Element, HanjaEntry, HanjaRepository } from "./types.js";
import { DEFAULT_HANJA_STROKE_COUNT } from "./constants.js";
import { toText, toInt, toBit } from "./type-converters.js";
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

const HANJA_SELECT_FIELDS = [
  "SELECT hangul, hanja, meaning, hoeksu, hoeksu_ohaeng, jawon_ohaeng,",
  "       pronunciation_ohaeng, pronunciation_eumyang, hoeksu_eumyang, boosoo, is_surname",
  "  FROM hanja_entries",
].join("\n");

function hanjaQuery(whereClause: string): string {
  return `${HANJA_SELECT_FIELDS}\n ${whereClause}`;
}

function toElement(value: unknown, fallback: Element): Element {
  const text = toText(value) as Element;
  return ELEMENT_SET.has(text) ? text : fallback;
}

function toFallback(korean: string, hanja: string, isSurname: boolean): HanjaEntry {
  const hangul = (korean ?? "").trim().slice(0, 1) || "_";
  const hanjaChar = (hanja ?? "").trim().slice(0, 1) || "_";
  return {
    hangul,
    hanja: hanjaChar,
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
    this.selectExact = db.prepare(hanjaQuery("WHERE hangul = ? AND hanja = ? AND is_surname = ?\n LIMIT 1"));
    this.selectByHanja = db.prepare(hanjaQuery("WHERE hanja = ? AND is_surname = ?\n LIMIT 1"));
    this.selectNameByHangul = db.prepare(hanjaQuery("WHERE hangul = ? AND is_surname = 0"));
    this.selectSurnameByHangul = db.prepare(hanjaQuery("WHERE hangul = ? AND is_surname = 1"));
    this.selectNameByHanja = db.prepare(hanjaQuery("WHERE hanja = ? AND is_surname = 0"));
    this.selectNameByChosung = db.prepare(hanjaQuery("WHERE hangul_chosung = ? AND is_surname = 0"));
    this.selectNameByJungsung = db.prepare(hanjaQuery("WHERE hangul_jungsung = ? AND is_surname = 0"));
    this.selectSurnamePair = db.prepare("SELECT 1 FROM surname_pairs WHERE korean = ? AND hanja = ? LIMIT 1");
  }

  getHanjaInfo(korean: string, hanja: string, isSurname: boolean): HanjaEntry {
    const koreanText = toText(korean);
    const hanjaText = toText(hanja);

    if (koreanText && hanjaText) {
      const exact = this.selectExact.get(koreanText, hanjaText, isSurname ? 1 : 0) as HanjaRow | undefined;
      if (exact) {
        return this.toEntry(exact, isSurname);
      }
    }

    if (hanjaText) {
      const byHanja = this.selectByHanja.get(hanjaText, isSurname ? 1 : 0) as HanjaRow | undefined;
      if (byHanja) {
        return this.toEntry(byHanja, isSurname);
      }
    }

    return toFallback(koreanText || "_", hanjaText || "_", isSurname);
  }

  getHanjaStrokeCount(korean: string, hanja: string, isSurname: boolean): number {
    return this.getHanjaInfo(korean, hanja, isSurname).strokeCount;
  }

  getSurnamePairs(surname: string, surnameHanja: string): Array<{ korean: string; hanja: string }> {
    const koreanChars = Array.from((surname ?? "").trim());
    const hanjaChars = Array.from((surnameHanja ?? "").trim());
    if (koreanChars.length <= 1) {
      return [{ korean: koreanChars[0] ?? "", hanja: hanjaChars[0] ?? "" }];
    }
    return koreanChars.map((char, idx) => ({
      korean: char,
      hanja: hanjaChars[idx] ?? "",
    }));
  }

  isSurname(korean: string, hanja: string): boolean {
    const koreanText = toText(korean);
    const hanjaText = toText(hanja);
    if (!koreanText || !hanjaText) {
      return false;
    }
    return Boolean(this.selectSurnamePair.get(koreanText, hanjaText) || this.selectExact.get(koreanText, hanjaText, 1));
  }

  findNameByHangul(hangul: string): readonly HanjaEntry[] {
    const text = toText(hangul);
    if (!text) {
      return [];
    }
    return (this.selectNameByHangul.all(text) as HanjaRow[]).map((row) => this.toEntry(row, false));
  }

  findSurnameByHangul(hangul: string): readonly HanjaEntry[] {
    const text = toText(hangul);
    if (!text) {
      return [];
    }
    return (this.selectSurnameByHangul.all(text) as HanjaRow[]).map((row) => this.toEntry(row, true));
  }

  findNameByHanja(hanja: string): readonly HanjaEntry[] {
    const text = toText(hanja);
    if (!text) {
      return [];
    }
    return (this.selectNameByHanja.all(text) as HanjaRow[]).map((row) => this.toEntry(row, false));
  }

  findNameByChosung(chosung: string): readonly HanjaEntry[] {
    const text = toText(chosung);
    if (!text) {
      return [];
    }
    return (this.selectNameByChosung.all(text) as HanjaRow[]).map((row) => this.toEntry(row, false));
  }

  findNameByJungsung(jungsung: string): readonly HanjaEntry[] {
    const text = toText(jungsung);
    if (!text) {
      return [];
    }
    return (this.selectNameByJungsung.all(text) as HanjaRow[]).map((row) => this.toEntry(row, false));
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
