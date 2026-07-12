# The Proxaim Index

Static site for the Proxaim Index: the AI findability index of professional
services in Italy, Spain and the UK. Aggregate-only, GDPR-clean, sample sizes
always stated. Published by Proxaim (proxaim.com).

## Stack
Plain static HTML/CSS/JS, no build step. Deployed as a Render **static site**
(free tier). The country switcher also switches interface language (Italy =
Italian, Spain = Spanish, UK = English).

## Updating the data (the whole job)
Edit `data/it.json`, `data/es.json`, `data/uk.json` and push. Render redeploys
automatically.

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
