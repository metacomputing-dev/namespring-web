import { Cheongan, CHEONGAN_VALUES } from '../../domain/Cheongan.js';
import { Ohaeng, OHAENG_VALUES } from '../../domain/Ohaeng.js';
import rawJohuCatalog from './data/johuCatalog.json';

export interface JohuCatalogEntry {
  readonly primary: Ohaeng;
  readonly secondary: Ohaeng | null;
  readonly note: string;
}

export type JohuRowRegistrar = (
  dayMaster: Cheongan,
  entries: readonly JohuCatalogEntry[],
) => void;

type JohuCatalogRow = readonly [dayMaster: Cheongan, entries: readonly JohuCatalogEntry[]];

interface RawJohuCatalogEntry {
  readonly primary: string;
  readonly secondary: string | null;
  readonly note: string;
}

interface JohuCatalogData {
  readonly rows: readonly (readonly [string, readonly RawJohuCatalogEntry[]])[];
}

const JOHU_CATALOG_DATA = rawJohuCatalog as unknown as JohuCatalogData;
const CHEONGAN_SET: ReadonlySet<Cheongan> = new Set(CHEONGAN_VALUES);
const OHAENG_SET: ReadonlySet<Ohaeng> = new Set(OHAENG_VALUES);

function toCheongan(raw: string): Cheongan {
  if (CHEONGAN_SET.has(raw as Cheongan)) return raw as Cheongan;
  throw new Error(`Invalid Cheongan in JohuCatalog: ${raw}`);
}

function toOhaeng(raw: string): Ohaeng {
  if (OHAENG_SET.has(raw as Ohaeng)) return raw as Ohaeng;
  throw new Error(`Invalid Ohaeng in JohuCatalog: ${raw}`);
}

const JOHU_CATALOG_ROWS: readonly JohuCatalogRow[] = JOHU_CATALOG_DATA.rows.map(
  ([dayMaster, entries]) => [
    toCheongan(dayMaster),
    entries.map((entry) => ({
      primary: toOhaeng(entry.primary),
      secondary: entry.secondary == null ? null : toOhaeng(entry.secondary),
      note: entry.note,
    })),
  ],
);

export function registerJohuCatalog(registerRow: JohuRowRegistrar): void {
  for (const [dayMaster, entries] of JOHU_CATALOG_ROWS) {
    registerRow(dayMaster, entries);
  }
}
