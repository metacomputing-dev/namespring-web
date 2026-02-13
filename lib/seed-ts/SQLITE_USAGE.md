# SQLite usage (`seed-ts`)

## Seed options

Use SQLite repositories by passing `sqlite.path`:

```ts
import { Seed } from "@namespring/seed-ts";

const seed = new Seed({
  sqlite: {
    path: "C:/path/to/seed.db",
    useFor: "all", // "all" | "hanja" | "stats"
  },
});
```

`useFor` behavior:
- `all`: use SQLite for both `HanjaRepository` and `StatsRepository`
- `hanja`: use SQLite only for hanja repository
- `stats`: use SQLite only for stats repository

## Required schema

Create the database using:

- `src/main/resources/seed/data/sqlite/schema.sql`

Required tables:
- `hanja_entries`
- `surname_pairs`
- `stats_index`
- `stats_name`
- `stats_combinations`

## Build command

```bash
npm run sqlite:build
```

Optional args:
- `--data-root <path>`
- `--out <db-path>`
- `--schema <schema-path>`

## Notes

- Default behavior is unchanged. If `sqlite` is omitted, in-memory gzip/json repositories are used.
- Existing evaluation/search logic is shared; only data source repositories are swapped.
