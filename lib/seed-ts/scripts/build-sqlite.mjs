#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite");

const CHOSUNG_OHAENG = {
  "\u3131": "\u6728",
  "\u3132": "\u6728",
  "\u314F": "\u571F",
  "\u3134": "\u706B",
  "\u3137": "\u706B",
  "\u3138": "\u706B",
  "\u3139": "\u91D1",
  "\u3141": "\u6C34",
  "\u3142": "\u6C34",
  "\u3143": "\u6C34",
  "\u3145": "\u91D1",
  "\u3146": "\u91D1",
  "\u3147": "\u571F",
  "\u3148": "\u91D1",
  "\u3149": "\u91D1",
  "\u314A": "\u91D1",
  "\u314B": "\u6728",
  "\u314C": "\u706B",
  "\u314D": "\u6C34",
  "\u314E": "\u571F",
};

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token?.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = args[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = "true";
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function resolvePaths() {
  const args = parseArgs();
  const cwd = process.cwd();
  const dataRoot = path.resolve(cwd, args["data-root"] ?? "src/main/resources/seed/data");
  const dbPath = path.resolve(cwd, args.out ?? path.join("src/main/resources/seed/data/sqlite", "seed.db"));
  const schemaPath = path.resolve(cwd, args.schema ?? path.join("src/main/resources/seed/data/sqlite", "schema.sql"));
  return { dataRoot, dbPath, schemaPath };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readGzipText(filePath) {
  return zlib.gunzipSync(fs.readFileSync(filePath)).toString("utf8");
}

function readGzipJson(filePath) {
  return JSON.parse(readGzipText(filePath));
}

function readGzipLines(filePath) {
  const text = readGzipText(filePath);
  return text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
}

function extractChosung(char) {
  const code = char.codePointAt(0);
  if (code === undefined || code < 0xac00 || code > 0xd7a3) {
    return "";
  }
  const base = code - 0xac00;
  const chosungIndex = Math.floor(base / 588);
  return (
    [
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
      "\u314A",
      "\u314B",
      "\u314C",
      "\u314D",
      "\u314E",
    ][chosungIndex] ?? ""
  );
}

function isYangVowel(char) {
  const code = char.codePointAt(0);
  if (code === undefined || code < 0xac00 || code > 0xd7a3) {
    return false;
  }
  const base = code - 0xac00;
  const jungsungIndex = Math.floor((base % 588) / 28);
  return new Set([0, 2, 8, 9, 12, 13, 17]).has(jungsungIndex);
}

function loadRadicalMap(lines) {
  const map = new Map();
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    map.set(line.slice(0, idx), line.slice(idx + 1));
  }
  return map;
}

function parseHanjaDict(lines, radicals, isSurname) {
  const out = [];
  for (const line of lines) {
    const idx = line.indexOf(";");
    if (idx < 0) continue;
    const info = line.slice(0, idx);
    const meaning = line.slice(idx + 1);
    if (info.length < 6) continue;
    const hangul = info.slice(0, 1);
    const hanja = info.slice(1, 2);
    const hoeksu = Number.parseInt(info.slice(2, 4), 10);
    if (!hangul || !hanja || Number.isNaN(hoeksu)) continue;
    const hoeksuOhaeng = { "1": "\u6728", "2": "\u706B", "3": "\u571F", "4": "\u91D1", "5": "\u6C34" }[info.slice(4, 5)] ?? "\u571F";
    const jawonOhaeng = { "1": "\u6728", "2": "\u706B", "3": "\u571F", "4": "\u91D1", "5": "\u6C34" }[info.slice(5, 6)] ?? "\u571F";
    const pronunciationOhaeng = CHOSUNG_OHAENG[extractChosung(hangul)] ?? "\u571F";
    const pronunciationEumyang = isYangVowel(hangul) ? 1 : 0;
    const hoeksuEumyang = Math.abs(hoeksu) % 2 === 0 ? 0 : 1;
    out.push({
      hangul,
      hanja,
      meaning,
      hoeksu,
      hoeksuOhaeng,
      jawonOhaeng,
      pronunciationOhaeng,
      pronunciationEumyang,
      hoeksuEumyang,
      boosoo: radicals.get(hanja) ?? "",
      isSurname: isSurname ? 1 : 0,
    });
  }
  return out;
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function main() {
  const { dataRoot, dbPath, schemaPath } = resolvePaths();
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`schema not found: ${schemaPath}`);
  }
  ensureDir(dbPath);
  if (fs.existsSync(dbPath)) {
    fs.rmSync(dbPath);
  }

  const db = new DatabaseSync(dbPath);
  db.exec(fs.readFileSync(schemaPath, "utf8"));

  const insertHanja = db.prepare(
    [
      "INSERT OR REPLACE INTO hanja_entries (",
      "  hangul, hanja, meaning, hoeksu, hoeksu_ohaeng, jawon_ohaeng,",
      "  pronunciation_ohaeng, pronunciation_eumyang, hoeksu_eumyang, boosoo, is_surname",
      ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ].join("\n"),
  );
  const insertSurnamePair = db.prepare(
    "INSERT OR IGNORE INTO surname_pairs (korean, hanja) VALUES (?, ?)",
  );
  const insertStatsIndex = db.prepare(
    "INSERT OR IGNORE INTO stats_index (chosung_key, file_id, ord) VALUES (?, ?, ?)",
  );
  const insertStatsName = db.prepare(
    "INSERT OR REPLACE INTO stats_name (file_id, name_hangul, payload_json) VALUES (?, ?, ?)",
  );
  const insertStatsCombo = db.prepare(
    "INSERT OR IGNORE INTO stats_combinations (file_id, name_hangul, name_hanja, name_length) VALUES (?, ?, ?, ?)",
  );

  const metadata = readJson(path.join(dataRoot, "hanja", "metadata.json"));
  const files = metadata.files ?? {};

  const nameRadicals = loadRadicalMap(
    readGzipLines(path.join(dataRoot, "hanja", files.name_hanja_dict_radicals ?? "name_hanja_dict_radicals.gz")),
  );
  const surnameRadicals = loadRadicalMap(
    readGzipLines(path.join(dataRoot, "hanja", files.surname_hanja_dict_radicals ?? "surname_hanja_dict_radicals.gz")),
  );
  const nameEntries = parseHanjaDict(
    readGzipLines(path.join(dataRoot, "hanja", files.name_hanja_dict ?? "name_hanja_dict.gz")),
    nameRadicals,
    false,
  );
  const surnameEntries = parseHanjaDict(
    readGzipLines(path.join(dataRoot, "hanja", files.surname_hanja_dict ?? "surname_hanja_dict.gz")),
    surnameRadicals,
    true,
  );
  const surnamePairs = readGzipLines(path.join(dataRoot, "hanja", files.surname_pairs ?? "surname_pairs.gz"));

  const indexMap = readGzipJson(path.join(dataRoot, "stats", "chosung_index.json.gz"));
  const uniqueFiles = [...new Set(Object.values(indexMap).flat())];

  db.exec("BEGIN");
  try {
    for (const entry of [...nameEntries, ...surnameEntries]) {
      insertHanja.run(
        entry.hangul,
        entry.hanja,
        entry.meaning,
        entry.hoeksu,
        entry.hoeksuOhaeng,
        entry.jawonOhaeng,
        entry.pronunciationOhaeng,
        entry.pronunciationEumyang,
        entry.hoeksuEumyang,
        entry.boosoo,
        entry.isSurname,
      );
    }

    for (const pair of surnamePairs) {
      const idx = pair.indexOf("/");
      if (idx <= 0 || idx >= pair.length - 1) continue;
      insertSurnamePair.run(pair.slice(0, idx), pair.slice(idx + 1));
    }

    for (const [key, list] of Object.entries(indexMap)) {
      list.forEach((fileId, idx) => {
        insertStatsIndex.run(key, fileId, idx);
      });
    }

    for (const fileId of uniqueFiles) {
      const stat = readGzipJson(path.join(dataRoot, "stats", `stat_${fileId}.gz`));
      for (const [nameHangul, payload] of Object.entries(stat)) {
        insertStatsName.run(fileId, nameHangul, JSON.stringify(payload));
        const hanjas = Array.isArray(payload?.h) ? payload.h : [];
        const len = [...nameHangul].length;
        for (const hanja of hanjas) {
          if (typeof hanja !== "string" || [...hanja].length !== len) continue;
          insertStatsCombo.run(fileId, nameHangul, hanja, len);
        }
      }
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.close?.();
  }

  console.log(`sqlite build complete: ${dbPath}`);
  console.log(`hanja entries: ${nameEntries.length + surnameEntries.length}`);
  console.log(`surname pairs: ${surnamePairs.length}`);
  console.log(`stats files: ${uniqueFiles.length}`);
}

main();

