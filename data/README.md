# data/elec.db

The engineering database the web applications are built from. This is a
**trimmed copy** of the full elec.db shared with the EleCalc WPF desktop tool —
it holds only the four tables the applications read, and no project data.

| Table | Rows | Used for |
| --- | --- | --- |
| `low_voltage` | 17 | LV cable geometry and resistance (Neher-McGrath) |
| `medium_voltage` | 12 | MV cable geometry and resistance (Neher-McGrath) |
| `conduitsNeher` | 12 | Conduit trade sizes, OD and SCH40 wall |
| `nec_430_250` | 27 | Motor full-load current (Current Calc) |

The schema of each table is copied verbatim from the source database, so the
extraction produces byte-identical output either way.

## Regenerating it

The full database is **not** tracked here. Keep it outside the repository
(the desktop tool reads `C:\temp\database\elec.db`) and regenerate this file
whenever the cable or conduit tables change:

```bash
node scripts/make-app-db.mjs                        # C:/temp/database/elec.db -> data/elec.db
node scripts/make-app-db.mjs path/to/full/elec.db   # or point it anywhere
node scripts/extract-elec-db.mjs                    # then refresh cables.json
```

`make-app-db.mjs` copies a fixed allow-list of four tables. It cannot pick up
anything else, so re-running it can never leak project data into the repository.

## Why the full database is excluded

Beyond these four tables the full file carries roughly 123,000 rows across ~54
other tables that have nothing to do with these tools: client cable lists and
circuit schedules (`TSMC_*`, `PH1CIRCUITS`, `cableList_*`, `nederlandsCircuits*`,
`tool_cable_list*`), load lists, a Kanban board with task notes and user names
(`elecad_kanban_*`), and a 115,000-row document index (`sincronia`).

None of it is used by any application, and this repository is public — so it
stays out.

## Runtime note

The database is a build-time input only. `scripts/extract-elec-db.mjs` turns it
into `apps/neher/data/cables.json`; nothing under `data/` is ever copied into
`dist/`, so the published site never serves it.
