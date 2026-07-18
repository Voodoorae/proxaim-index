# The Proxaim Index

Static site for the Proxaim Index: the AI findability index of professional
services in Italy, Spain and the UK. Aggregate-only, GDPR-clean, sample sizes
always stated. Published by Proxaim (proxaim.com).

## Stack
Plain static HTML/CSS/JS, no build step. Deployed as a Render **static site**
(free tier). The country switcher also switches interface language (Italy =
Italian, Spain = Spanish, UK = English).

## Updating the data (the whole job)
Preferred: generate from the benchmark store, review the diff, push. Render
redeploys automatically.

```
GCP_SERVICE_ACCOUNT_B64=<same credential the Found Score service uses> \
  node scripts/generate.mjs
node scripts/generate.mjs --self-test   # fixture-only check, no network
```

The generator (zero dependencies, Node 18+) reads the "Benchmark Scores" tab
of the "Proxaim Benchmark Registry" sheet and recomputes `sampleSize`,
`headline`, and `professions` for `it` and `uk`. Rules it enforces: template
seed rows are excluded from every figure; a rescanned domain counts once at
its latest score per pillar; bucket averages stay `null` below n = 10 so the
raw JSON never leaks a small-sample number; editorial fields (`citeName`,
`edition`, `updated`, `previewOverride`, `_note`, `cities`) are preserved,
never generated. Definitions are stamped into a `_method` field: "not fully
findable" = Found < 100; "failed security" = Secure < 80 (below grade B).

City, Spain, and the customs/food-safety professions are supported from
17 Jul 2026 (city column H, Spanish regions, and the two professions were
added to the store schema that day). Scans recorded before then carry no
city and appear only in national figures.

Profession is free text at the store level from 18 Jul 2026, not a closed
enum: a firm outside the original 8 known niches (a dentist, a translator,
whatever comes next) is captured as whatever the visitor typed instead of
being discarded as "Unspecified". The generator groups professions
case-insensitively; text matching a known niche gets that niche's translated
label, anything else is bucketed under the raw text as its own entry.
Editorial profession and city lists keep their order and pick up computed
counts; anything computed that isn't on the editorial list yet (a new niche,
a new city) is appended so it starts accumulating in the published edition.
Manual editing of the data files still works and remains the path for
editorial fields and for renaming/merging a newly-appeared entry into the
formal taxonomy once it has enough volume to deserve one.

Per-country shape:

```json
{
  "citeName": "L'Indice Proxaim",
  "edition": "Edizione 1 (settembre 2026)",
  "updated": "settembre 2026",
  "sampleSize": 132,
  "previewOverride": false,
  "headline": {
    "pctNotAiVisible": 78,
    "pctFailedSecurity": 91,
    "avgFound": 47,
    "avgSecure": 52
  },
  "professions": [ { "name": "Commercialisti", "n": 41, "avgFound": 46 } ],
  "cities": [ { "name": "Milano", "n": 18, "avgFound": 51 } ]
}
```

Rules enforced by the front end (`app.js`):
- Any profession/city bucket with `n < 10` renders as "collecting", never a number.
- Headline stats render as "collecting" when `sampleSize < 10`, unless
  `previewOverride: true` (used for the honest small-cohort preview, where the
  sample size is displayed prominently instead).
- Never add firm names to these files. Aggregates only (standing GDPR rule).

## Data sources
1. Organic scans through Proxaim's public tools (the benchmark store).
2. Manual seeding runs (neutral registers / top-of-search per city+profession).
Future: generate these JSONs directly from the found-score benchmark store
instead of hand-editing.

## Edition cadence
Quarterly. Edition 1 targeted September 2026 to coincide with market entry.
