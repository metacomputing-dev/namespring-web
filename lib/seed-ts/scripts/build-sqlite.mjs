import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;
const CHOSUNG_DIVIDER = 21 * 28;
const JUNGSUNG_DIVIDER = 28;

const CHOSUNG_LIST = [
  "\u3131",
  "\u3132",
  "\u3134",
  "\u3137",
  "\u3138",
  "\u3139",
  "\u3141",
  "\u3142",
  "\u3143",
  "\u3145",
  "\u3146",
  "\u3147",
  "\u3148",
  "\u3149",
  "\u314a",
  "\u314b",
  "\u314c",
  "\u314d",
  "\u314e",
];

const YANG_VOWELS = new Set([
  "\u314f",
  "\u3151",
  "\u3150",
  "\u3152",
  "\u3157",
  "\u315b",
  "\u3158",
  "\u3159",
  "\u315a",
]);

const CHOSUNG_ELEMENT = {
  "\u3131": "\u6728",
  "\u314b": "\u6728",
  "\u3132": "\u6728",
  "\u3134": "\u706b",
  "\u3137": "\u706b",
  "\u314c": "\u706b",
  "\u3139": "\u706b",
  "\u3138": "\u706b",
  "\u3147": "\u571f",
  "\u314e": "\u571f",
  "\u3145": "\u91d1",
  "\u3148": "\u91d1",
  "\u314a": "\u91d1",
  "\u3146": "\u91d1",
  "\u3149": "\u91d1",
  "\u3141": "\u6c34",
  "\u3142": "\u6c34",
  "\u314d": "\u6c34",
  "\u3143": "\u6c34",
};

const DIGIT_TO_ELEMENT = {
  "1": "\u6728",
  "2": "\u706b",
  "3": "\u571f",
  "4": "\u91d1",
  "5": "\u6c34",
};

const CHOSUNG_TO_ENGLISH = {
  "\u3131": "g",
  "\u3132": "gg",
  "\u3134": "n",
  "\u3137": "d",
  "\u3138": "dd",
  "\u3139": "r",
  "\u3141": "m",
  "\u3142": "b",
  "\u3143": "bb",
  "\u3145": "s",
  "\u3146": "ss",
  "\u3147": "ng",
  "\u3148": "j",
  "\u3149": "jj",
  "\u314a": "ch",
  "\u314b": "k",
  "\u314c": "t",
  "\u314d": "p",
  "\u314e": "h",
};

const YEARLY_RANK_KEY = "\uc5f0\ub3c4\ubcc4 \uc778\uae30 \uc21c\uc704";
const YEARLY_BIRTH_KEY = "\uc5f0\ub3c4\ubcc4 \ucd9c\uc0dd\uc544 \uc218";
const TOTAL_KEY = "\uc804\uccb4";
const MALE_KEY = "\ub0a8\uc790";
const FEMALE_KEY = "\uc5ec\uc790";

const DEFAULT_HOEKSU = 10;
const EARTH = "\u571f";

function loadSqlite() {
  try {
    return require("node:sqlite");
  } catch (error) {
    throw new Error("`node:sqlite` is not available in this Node runtime.", {
      cause: error,
    });
  }
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function readJsonSync(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readGzipLinesSync(filePath) {
  const content = zlib.gunzipSync(fs.readFileSync(filePath)).toString("utf8");
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function readGzipJsonSync(filePath) {
  const content = zlib.gunzipSync(fs.readFileSync(filePath)).toString("utf8");
  return JSON.parse(content);
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toRecord(value) {
  return isRecord(value) ? value : {};
}

function toStringList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set();
  const out = [];
  for (const entry of value) {
    if (typeof entry !== "string") {
      continue;
    }
    const text = normalizeText(entry);
    if (!text || seen.has(text)) {
      continue;
    }
    seen.add(text);
    out.push(text);
  }
  return out;
}

function extractChosung(char) {
  if (!char) {
    return "";
  }
  if (CHOSUNG_LIST.includes(char)) {
    return char;
  }
  const code = char.codePointAt(0);
  if (code === undefined || code < HANGUL_BASE || code > HANGUL_END) {
    return "";
  }
  const idx = Math.floor((code - HANGUL_BASE) / CHOSUNG_DIVIDER);
  return CHOSUNG_LIST[idx] ?? "";
}

function extractJungsung(char) {
  if (!char) {
    return "";
  }
  const code = char.codePointAt(0);
  if (code === undefined || code < HANGUL_BASE || code > HANGUL_END) {
    return "";
  }
  const idx = Math.floor(((code - HANGUL_BASE) % CHOSUNG_DIVIDER) / JUNGSUNG_DIVIDER);
  const table = [
    "\u314f",
    "\u3150",
    "\u3151",
    "\u3152",
    "\u3153",
    "\u3154",
    "\u3155",
    "\u3156",
    "\u3157",
    "\u3158",
    "\u3159",
    "\u315a",
    "\u315b",
    "\u315c",
    "\u315d",
    "\u315e",
    "\u315f",
    "\u3160",
    "\u3161",
    "\u3162",
    "\u3163",
  ];
  return table[idx] ?? "";
}

function isYangVowel(char) {
  const jung = extractJungsung(char);
  return YANG_VOWELS.has(jung);
}

function splitChars(value) {
  return Array.from(normalizeText(value));
}

function splitChars3(value) {
  const chars = splitChars(value);
  return [chars[0] ?? "", chars[1] ?? "", chars[2] ?? ""];
}

function toElementByDigit(value) {
  return DIGIT_TO_ELEMENT[normalizeText(value)] ?? EARTH;
}

function runInTransaction(db, fn) {
  db.exec("BEGIN");
  try {
    fn();
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function parseRadicals(lines) {
  const out = new Map();
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx <= 0) {
      continue;
    }
    out.set(normalizeText(line.slice(0, idx)), normalizeText(line.slice(idx + 1)));
  }
  return out;
}

function parseDict(lines, radicals, isSurname) {
  const out = [];
  for (const line of lines) {
    const idx = line.indexOf(";");
    if (idx < 0) {
      continue;
    }
    const info = line.slice(0, idx);
    const meaning = normalizeText(line.slice(idx + 1));
    if (info.length < 6) {
      continue;
    }
    const hangul = normalizeText(info.slice(0, 1));
    const hanja = normalizeText(info.slice(1, 2));
    const hoeksu = Number.parseInt(info.slice(2, 4), 10);
    if (!hangul || !hanja || Number.isNaN(hoeksu)) {
      continue;
    }
    const strokeElement = toElementByDigit(info.slice(4, 5));
    const rootElement = toElementByDigit(info.slice(5, 6));
    const pronunciationElement = CHOSUNG_ELEMENT[extractChosung(hangul)] ?? EARTH;
    const pronunciationPolarityBit = isYangVowel(hangul) ? 1 : 0;
    const strokePolarityBit = Math.abs(hoeksu) % 2 === 0 ? 0 : 1;
    const radical = radicals.get(hanja) ?? "";
    out.push({
      hangul,
      hanja,
      meaning,
      hoeksu,
      strokeElement,
      rootElement,
      pronunciationElement,
      pronunciationPolarityBit,
      strokePolarityBit,
      radical,
      isSurname,
    });
  }
  return out;
}

function importHanja(db, dataRoot) {
  const hanjaRoot = path.join(dataRoot, "hanja");
  const metadataPath = path.join(hanjaRoot, "metadata.json");
  if (!fs.existsSync(metadataPath)) {
    throw new Error(`Hanja metadata not found: ${metadataPath}`);
  }
  const metadata = toRecord(readJsonSync(metadataPath));
  const files = toRecord(metadata.files);

  const nameRadicals = parseRadicals(
    readGzipLinesSync(path.join(hanjaRoot, files.name_hanja_dict_radicals ?? "name_hanja_dict_radicals.gz")),
  );
  const surnameRadicals = parseRadicals(
    readGzipLinesSync(path.join(hanjaRoot, files.surname_hanja_dict_radicals ?? "surname_hanja_dict_radicals.gz")),
  );
  const nameEntries = parseDict(
    readGzipLinesSync(path.join(hanjaRoot, files.name_hanja_dict ?? "name_hanja_dict.gz")),
    nameRadicals,
    false,
  );
  const surnameEntries = parseDict(
    readGzipLinesSync(path.join(hanjaRoot, files.surname_hanja_dict ?? "surname_hanja_dict.gz")),
    surnameRadicals,
    true,
  );
  const surnamePairs = readGzipLinesSync(path.join(hanjaRoot, files.surname_pairs ?? "surname_pairs.gz"));

  const insertEntry = db.prepare(
    [
      "INSERT OR REPLACE INTO hanja_entries (",
      "  hangul, hanja, meaning, hoeksu, hoeksu_ohaeng, jawon_ohaeng,",
      "  pronunciation_ohaeng, pronunciation_eumyang, hoeksu_eumyang, boosoo, is_surname,",
      "  hangul_chosung, hangul_jungsung",
      ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ].join("\n"),
  );
  const insertPair = db.prepare(
    "INSERT OR IGNORE INTO surname_pairs (korean, hanja) VALUES (?, ?)",
  );

  runInTransaction(db, () => {
    for (const entry of [...nameEntries, ...surnameEntries]) {
      insertEntry.run(
        entry.hangul,
        entry.hanja,
        entry.meaning,
        Number.isFinite(entry.hoeksu) ? entry.hoeksu : DEFAULT_HOEKSU,
        entry.strokeElement,
        entry.rootElement,
        entry.pronunciationElement,
        entry.pronunciationPolarityBit,
        entry.strokePolarityBit,
        entry.radical,
        entry.isSurname ? 1 : 0,
        extractChosung(entry.hangul),
        extractJungsung(entry.hangul),
      );
    }
    for (const line of surnamePairs) {
      const idx = line.indexOf("/");
      if (idx <= 0 || idx >= line.length - 1) {
        continue;
      }
      const korean = normalizeText(line.slice(0, idx));
      const hanja = normalizeText(line.slice(idx + 1));
      if (!korean || !hanja) {
        continue;
      }
      insertPair.run(korean, hanja);
    }
  });

  const strokeByPair = new Map();
  const strokeByHanja = new Map();
  const nameHanjaByHangul = new Map();
  for (const entry of [...nameEntries, ...surnameEntries]) {
    strokeByPair.set(`${entry.hangul}/${entry.hanja}`, Number.isFinite(entry.hoeksu) ? entry.hoeksu : DEFAULT_HOEKSU);
    if (!strokeByHanja.has(entry.hanja)) {
      strokeByHanja.set(entry.hanja, Number.isFinite(entry.hoeksu) ? entry.hoeksu : DEFAULT_HOEKSU);
    }
    if (!entry.isSurname) {
      const list = nameHanjaByHangul.get(entry.hangul) ?? [];
      if (!list.includes(entry.hanja)) {
        list.push(entry.hanja);
        nameHanjaByHangul.set(entry.hangul, list);
      }
    }
  }

  return {
    nameCount: nameEntries.length,
    surnameCount: surnameEntries.length,
    pairCount: surnamePairs.length,
    strokeByPair,
    strokeByHanja,
    nameHanjaByHangul,
  };
}

function toYearOffsetMap(value) {
  const map = toRecord(value);
  const out = {};
  for (const [rawYear, rawValue] of Object.entries(map)) {
    const parsedYear = Number.parseInt(rawYear, 10);
    if (Number.isNaN(parsedYear)) {
      continue;
    }
    const n = typeof rawValue === "number" ? rawValue : Number.parseFloat(String(rawValue));
    if (!Number.isFinite(n)) {
      continue;
    }
    const offset = parsedYear >= 1900 ? parsedYear - 2000 : parsedYear;
    out[String(offset)] = n;
  }
  return out;
}

function pickGenderMap(value) {
  const row = toRecord(value);
  if (Object.keys(row).length === 0) {
    return {};
  }
  const candidates = [row[MALE_KEY], row[FEMALE_KEY], row.male, row.female, row.m];
  for (const candidate of candidates) {
    const rec = toRecord(candidate);
    if (Object.keys(rec).length > 0) {
      return rec;
    }
  }
  return {};
}

function toCompactStatsPayload(rawRow) {
  const row = toRecord(rawRow);
  if ("s" in row || "r" in row || "b" in row || "h" in row) {
    return {
      s: toStringList(row.s),
      r: toRecord(row.r),
      b: toRecord(row.b),
      h: toStringList(row.h),
    };
  }

  const rankRoot = toRecord(row[YEARLY_RANK_KEY]);
  const birthRoot = toRecord(row[YEARLY_BIRTH_KEY]);

  const rankTotal = toRecord(rankRoot[TOTAL_KEY]);
  const birthTotal = toRecord(birthRoot[TOTAL_KEY]);

  const rankGender = pickGenderMap(rankRoot);
  const birthGender = pickGenderMap(birthRoot);

  return {
    s: toStringList(row.similar_names),
    r: {
      t: toYearOffsetMap(rankTotal),
      m: toYearOffsetMap(rankGender),
    },
    b: {
      t: toYearOffsetMap(birthTotal),
      m: toYearOffsetMap(birthGender),
    },
    h: toStringList(row.hanja_combinations),
  };
}

function fileKeyFromName(nameHangul) {
  const first = Array.from(normalizeText(nameHangul))[0] ?? "";
  const chosung = extractChosung(first);
  return CHOSUNG_TO_ENGLISH[chosung] ?? "misc";
}

function strokeOfPair(hangulChar, hanjaChar, strokeByPair, strokeByHanja) {
  if (!hanjaChar) {
    return 0;
  }
  const pairValue = strokeByPair.get(`${hangulChar}/${hanjaChar}`);
  if (Number.isFinite(pairValue)) {
    return pairValue;
  }
  const value = strokeByHanja.get(hanjaChar);
  return Number.isFinite(value) ? value : DEFAULT_HOEKSU;
}

function buildCombinationIndexFields(nameHangul, nameHanja, strokeByPair, strokeByHanja) {
  const [k1, k2, k3] = splitChars3(nameHangul);
  const [h1, h2, h3] = splitChars3(nameHanja);
  const c1 = extractChosung(k1);
  const c2 = extractChosung(k2);
  const c3 = extractChosung(k3);
  const j1 = extractJungsung(k1);
  const j2 = extractJungsung(k2);
  const j3 = extractJungsung(k3);

  const hangulChars = splitChars(nameHangul);
  const hanjaChars = splitChars(nameHanja);
  const strokeKey = hanjaChars
    .map((char, i) => String(strokeOfPair(hangulChars[i] ?? "", char, strokeByPair, strokeByHanja)))
    .join(",");

  return {
    k1,
    k2,
    k3,
    h1,
    h2,
    h3,
    c1,
    c2,
    c3,
    j1,
    j2,
    j3,
    strokeKey,
  };
}

function collectHanjaCandidates(nameHangul, nameLength, payloadHanja, nameHanjaByHangul) {
  const out = new Set(toStringList(payloadHanja));
  if (nameLength === 1) {
    const char = splitChars(nameHangul)[0] ?? "";
    const extras = nameHanjaByHangul.get(char) ?? [];
    for (const hanja of extras) {
      if (Array.from(hanja).length === 1) {
        out.add(hanja);
      }
    }
  }
  return Array.from(out);
}

function importStatsFromMinified(
  db,
  minifiedPath,
  strokeByPair,
  strokeByHanja,
  nameHanjaByHangul,
) {
  const raw = toRecord(readJsonSync(minifiedPath));

  const insertIndex = db.prepare(
    "INSERT OR IGNORE INTO stats_index (chosung_key, file_id, ord) VALUES (?, ?, ?)",
  );
  const insertName = db.prepare(
    "INSERT OR REPLACE INTO stats_name (file_id, name_hangul, payload_json) VALUES (?, ?, ?)",
  );
  const insertCombo = db.prepare(
    [
      "INSERT OR IGNORE INTO stats_combinations (",
      "  file_id, name_hangul, name_hanja, name_length,",
      "  k1, k2, k3, h1, h2, h3, c1, c2, c3, j1, j2, j3, stroke_key",
      ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ].join("\n"),
  );

  const indexedKeys = new Set();
  let nameCount = 0;
  let comboCount = 0;

  runInTransaction(db, () => {
    for (const [nameHangul, rawRow] of Object.entries(raw)) {
      const normalizedName = normalizeText(nameHangul);
      if (!normalizedName) {
        continue;
      }
      const fileId = fileKeyFromName(normalizedName);
      if (!indexedKeys.has(fileId)) {
        indexedKeys.add(fileId);
        insertIndex.run(fileId, fileId, 0);
      }

      const payload = toCompactStatsPayload(rawRow);
      insertName.run(fileId, normalizedName, JSON.stringify(payload));
      nameCount += 1;

      const nameLength = Array.from(normalizedName).length;
      const hanjaCandidates = collectHanjaCandidates(
        normalizedName,
        nameLength,
        payload.h,
        nameHanjaByHangul,
      );
      for (const hanja of hanjaCandidates) {
        if (Array.from(hanja).length !== nameLength) {
          continue;
        }
        const indexed = buildCombinationIndexFields(
          normalizedName,
          hanja,
          strokeByPair,
          strokeByHanja,
        );
        insertCombo.run(
          fileId,
          normalizedName,
          hanja,
          nameLength,
          indexed.k1,
          indexed.k2,
          indexed.k3,
          indexed.h1,
          indexed.h2,
          indexed.h3,
          indexed.c1,
          indexed.c2,
          indexed.c3,
          indexed.j1,
          indexed.j2,
          indexed.j3,
          indexed.strokeKey,
        );
        comboCount += 1;
      }
    }
  });

  return {
    mode: "minified",
    filePath: minifiedPath,
    nameCount,
    comboCount,
    fileCount: indexedKeys.size,
  };
}

function importStatsFromShards(db, statsRoot, strokeByPair, strokeByHanja) {
  const indexPath = path.join(statsRoot, "chosung_index.json.gz");
  if (!fs.existsSync(indexPath)) {
    throw new Error(
      `Stats source not found. Expected either minified JSON or shard index at: ${indexPath}`,
    );
  }

  const indexMap = toRecord(readGzipJsonSync(indexPath));
  const insertIndex = db.prepare(
    "INSERT OR IGNORE INTO stats_index (chosung_key, file_id, ord) VALUES (?, ?, ?)",
  );
  const insertName = db.prepare(
    "INSERT OR REPLACE INTO stats_name (file_id, name_hangul, payload_json) VALUES (?, ?, ?)",
  );
  const insertCombo = db.prepare(
    [
      "INSERT OR IGNORE INTO stats_combinations (",
      "  file_id, name_hangul, name_hanja, name_length,",
      "  k1, k2, k3, h1, h2, h3, c1, c2, c3, j1, j2, j3, stroke_key",
      ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ].join("\n"),
  );

  const filesToLoad = new Set();
  runInTransaction(db, () => {
    for (const [chosungKey, rawFiles] of Object.entries(indexMap)) {
      if (!Array.isArray(rawFiles)) {
        continue;
      }
      for (let i = 0; i < rawFiles.length; i += 1) {
        const fileId = normalizeText(rawFiles[i]);
        if (!fileId) {
          continue;
        }
        insertIndex.run(normalizeText(chosungKey), fileId, i);
        filesToLoad.add(fileId);
      }
    }
  });

  let nameCount = 0;
  let comboCount = 0;
  runInTransaction(db, () => {
    for (const fileId of filesToLoad) {
      const shardPath = path.join(statsRoot, `stat_${fileId}.gz`);
      if (!fs.existsSync(shardPath)) {
        continue;
      }
      const fileRows = toRecord(readGzipJsonSync(shardPath));
      for (const [nameHangul, row] of Object.entries(fileRows)) {
        const normalizedName = normalizeText(nameHangul);
        if (!normalizedName) {
          continue;
        }
        const payload = toCompactStatsPayload(row);
        insertName.run(fileId, normalizedName, JSON.stringify(payload));
        nameCount += 1;

        const nameLength = Array.from(normalizedName).length;
        const hanjaCandidates = toStringList(payload.h);
        for (const hanja of hanjaCandidates) {
          if (Array.from(hanja).length !== nameLength) {
            continue;
          }
          const indexed = buildCombinationIndexFields(
            normalizedName,
            hanja,
            strokeByPair,
            strokeByHanja,
          );
          insertCombo.run(
            fileId,
            normalizedName,
            hanja,
            nameLength,
            indexed.k1,
            indexed.k2,
            indexed.k3,
            indexed.h1,
            indexed.h2,
            indexed.h3,
            indexed.c1,
            indexed.c2,
            indexed.c3,
            indexed.j1,
            indexed.j2,
            indexed.j3,
            indexed.strokeKey,
          );
          comboCount += 1;
        }
      }
    }
  });

  return {
    mode: "shards",
    filePath: indexPath,
    nameCount,
    comboCount,
    fileCount: filesToLoad.size,
  };
}

function findStatsMinifiedPath(statsRoot) {
  const candidates = [
    path.join(statsRoot, "name_to_stat_minified_with_hanja.json"),
    path.join(statsRoot, "name_to_stat_minified_with_hanja"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

function hasShardStats(statsRoot) {
  return fs.existsSync(path.join(statsRoot, "chosung_index.json.gz"));
}

function resolveStatsSource(statsRoot) {
  const shardCandidates = [
    process.env.SEED_STATS_SHARD_ROOT ? path.resolve(process.env.SEED_STATS_SHARD_ROOT) : null,
    statsRoot,
    path.resolve("C:/Projects/metaintelligence/seed/src/main/resources/seed/data/stats"),
    path.resolve("C:/Projects/metacomputing-dev/NameSpring/seed/src/main/resources/seed/data/stats"),
  ].filter(Boolean);

  for (const candidate of shardCandidates) {
    if (candidate && hasShardStats(candidate)) {
      return { kind: "shards", root: candidate };
    }
  }

  const minifiedPath = findStatsMinifiedPath(statsRoot);
  if (minifiedPath) {
    return { kind: "minified", path: minifiedPath };
  }

  throw new Error(
    `Stats source not found. Checked shard roots: ${shardCandidates.join(", ")}`,
  );
}

function extractSagyeokNumber(input) {
  const row = toRecord(input);
  const keys = ["number", "su", "num", "value", "sagyeoksu", "stroke"];
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return Math.trunc(value);
    }
    if (typeof value === "string") {
      const n = Number.parseInt(value, 10);
      if (!Number.isNaN(n)) {
        return n;
      }
    }
  }
  return null;
}

function extractLuckyLevel(input) {
  const row = toRecord(input);
  const keys = ["lucky_level", "luckyLevel", "level", "grade", "category"];
  for (const key of keys) {
    if (key in row) {
      const text = normalizeText(row[key]);
      if (text) {
        return text;
      }
    }
  }
  return "\ubbf8\uc815";
}

function importSagyeok(db, dataRoot) {
  const sourcePath = path.join(dataRoot, "sagyeoksu_data.json");
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Sagyeoksu source not found: ${sourcePath}`);
  }

  const raw = readJsonSync(sourcePath);
  const rows = [];

  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (isRecord(row)) {
        rows.push(row);
      }
    }
  } else if (isRecord(raw)) {
    const meanings = toRecord(raw.sagyeoksu_meanings);
    if (Object.keys(meanings).length > 0) {
      for (const [key, value] of Object.entries(meanings)) {
        if (!isRecord(value)) {
          continue;
        }
        rows.push({
          ...value,
          number: value.number ?? key,
        });
      }
    } else {
      for (const [key, value] of Object.entries(raw)) {
        if (!isRecord(value)) {
          continue;
        }
        rows.push({
          ...value,
          number: value.number ?? key,
        });
      }
    }
  }

  const insertSagyeok = db.prepare(
    "INSERT OR REPLACE INTO sagyeok_data (number, lucky_level, payload_json) VALUES (?, ?, ?)",
  );

  let inserted = 0;
  runInTransaction(db, () => {
    for (const row of rows) {
      const number = extractSagyeokNumber(row);
      if (number === null) {
        continue;
      }
      const luckyLevel = extractLuckyLevel(row);
      const payload = {
        ...row,
        number,
        lucky_level: luckyLevel,
      };
      insertSagyeok.run(number, luckyLevel, JSON.stringify(payload));
      inserted += 1;
    }
  });

  return {
    sourcePath,
    rowCount: inserted,
  };
}

function buildSqlite() {
  const { DatabaseSync } = loadSqlite();
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const pkgRoot = path.resolve(__dirname, "..");

  const dataRoot = process.env.SEED_DATA_ROOT
    ? path.resolve(process.env.SEED_DATA_ROOT)
    : path.join(pkgRoot, "src", "main", "resources", "seed", "data");
  const sqliteRoot = path.join(dataRoot, "sqlite");
  const schemaPath = path.join(sqliteRoot, "schema.sql");
  const outputPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(sqliteRoot, "seed.db");

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`SQLite schema not found: ${schemaPath}`);
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  if (fs.existsSync(outputPath)) {
    fs.rmSync(outputPath, { force: true });
  }

  const db = new DatabaseSync(outputPath);
  try {
    db.exec(fs.readFileSync(schemaPath, "utf8"));

    const hanjaSummary = importHanja(db, dataRoot);
    const statsRoot = path.join(dataRoot, "stats");
    const statsSource = resolveStatsSource(statsRoot);
    const statsSummary =
      statsSource.kind === "shards"
        ? importStatsFromShards(
            db,
            statsSource.root,
            hanjaSummary.strokeByPair,
            hanjaSummary.strokeByHanja,
          )
        : importStatsFromMinified(
            db,
            statsSource.path,
            hanjaSummary.strokeByPair,
            hanjaSummary.strokeByHanja,
            hanjaSummary.nameHanjaByHangul,
          );
    const sagyeokSummary = importSagyeok(db, dataRoot);

    console.log(`SQLite build completed: ${outputPath}`);
    console.log(
      `Hanja imported: ${hanjaSummary.nameCount + hanjaSummary.surnameCount} entries (${hanjaSummary.pairCount} surname pairs)`,
    );
    console.log(
      `Stats imported (${statsSummary.mode}): ${statsSummary.nameCount} names, ${statsSummary.comboCount} combinations, ${statsSummary.fileCount} files`,
    );
    console.log(`Sagyeok imported: ${sagyeokSummary.rowCount} rows`);
  } finally {
    db.close?.();
  }
}

try {
  buildSqlite();
} catch (error) {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}
