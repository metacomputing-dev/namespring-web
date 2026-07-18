import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { REPORT_DELIVERY_REQUEST_SCHEMA_V1 } from "../../../lib/spring-ts/src/report/delivery/types.js";
import {
  ServerSpringEngineAssetError,
  ServerSpringEngineAssetIntegrityError,
  createServerSpringEngineV1,
} from "../../api/_lib/server-spring-engine.js";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

test("paid server engine initializes and computes from local files without network", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("server SpringEngine attempted an external fetch");
  };

  const engine = createServerSpringEngineV1();
  try {
    await engine.init();
    const repository = engine.getHanjaRepository();
    const surname = (await repository.findSurnamesByHangul("\uAE40"))[0];
    const first = (await repository.findByHangul("\uBBFC"))[0];
    const second = (await repository.findByHangul("\uC900"))[0];
    assert.ok(surname && first && second, "fixture characters exist in the verified DB");

    const delivery = await engine.getReportDelivery({
      birth: {
        year: 1986,
        month: 4,
        day: 19,
        hour: 5,
        minute: 45,
        gender: "male",
      },
      surname: [{ hangul: surname.hangul, hanja: surname.hanja }],
      givenName: [
        { hangul: first.hangul, hanja: first.hanja },
        { hangul: second.hangul, hanja: second.hanja },
      ],
      targetDate: "2026-07-18",
      delivery: {
        schemaVersion: REPORT_DELIVERY_REQUEST_SCHEMA_V1,
        surfaces: [
          { id: "integrated", depth: "standard" },
          { id: "saju", depth: "expert", life: "summary" },
          { id: "naming", depth: "expert" },
        ],
      },
    });

    assert.deepEqual(
      delivery.surfaces.map((surface) => surface.id),
      ["integrated", "saju", "naming"],
    );
    assert.ok(delivery.facts.length > 0);
    assert.ok(delivery.interpretations.length > 0);
  } finally {
    engine.close();
    globalThis.fetch = originalFetch;
  }
});

test("paid server engine fails closed when an explicit asset path is missing", () => {
  assert.throws(
    () => createServerSpringEngineV1({ hanjaDatabase: "missing/hanja.db" }),
    (error: unknown) => error instanceof ServerSpringEngineAssetError
      && error.asset === "hanjaDatabase",
  );
});

test("paid server accepts byte-identical overrides and rejects every mismatched asset before engine use", () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), "namespring-server-assets-"));
  const cases = [
    {
      field: "hanjaDatabase" as const,
      asset: "hanjaDatabase",
      source: resolve(repositoryRoot, "namespring/public/data/hanja.db"),
    },
    {
      field: "fourFrameDatabase" as const,
      asset: "fourFrameDatabase",
      source: resolve(repositoryRoot, "namespring/public/data/fourframe.db"),
    },
    {
      field: "sqlWasm" as const,
      asset: "sqlWasm",
      source: resolve(repositoryRoot, "lib/seed-ts/assets/sql-wasm-1.14.1.wasm"),
    },
    {
      field: "nameStatSummary" as const,
      asset: "nameStatSummary",
      source: resolve(repositoryRoot, "lib/spring-ts/data/name-stat/name-stat-summary.v1.bin"),
    },
  ];
  try {
    for (const candidate of cases) {
      const good = join(temporaryRoot, `${candidate.asset}.good`);
      cpSync(candidate.source, good);
      const engine = createServerSpringEngineV1({ [candidate.field]: good });
      engine.close();

      const bad = join(temporaryRoot, `${candidate.asset}.bad`);
      const bytes = Buffer.from(readFileSync(candidate.source));
      bytes[Math.floor(bytes.length / 2)] ^= 0xff;
      writeFileSync(bad, bytes);
      assert.throws(
        () => createServerSpringEngineV1({ [candidate.field]: bad }),
        (error: unknown) => error instanceof ServerSpringEngineAssetIntegrityError
          && error.asset === candidate.asset
          && !JSON.stringify(error).includes(bad),
        `${candidate.asset} must be pinned by bytes, not accepted because an override exists`,
      );
    }
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
