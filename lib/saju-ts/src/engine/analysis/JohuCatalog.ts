import { Cheongan, CHEONGAN_VALUES } from '../../domain/Cheongan.js';
import { Ohaeng, OHAENG_VALUES } from '../../domain/Ohaeng.js';
import { createValueParser } from '../../domain/EnumValueParser.js';
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
const toCheongan = createValueParser('Cheongan', 'JohuCatalog', CHEONGAN_VALUES);
const toOhaeng = createValueParser('Ohaeng', 'JohuCatalog', OHAENG_VALUES);

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
