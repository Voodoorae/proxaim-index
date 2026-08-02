#!/usr/bin/env node
/* Proxaim Index generator — computes data/<country>.json from the benchmark
   store (Google Sheet "Proxaim Benchmark Registry", tab "Benchmark Scores").
   Zero dependencies: service-account JWT is signed with node:crypto and the
   Sheets/Drive REST APIs are called with fetch (Node 18+).

   Usage:
     GCP_SERVICE_ACCOUNT_B64=... node scripts/generate.mjs
     node scripts/generate.mjs --self-test     (no network, fixture data)

   Env:
     GCP_SERVICE_ACCOUNT_B64 or GCP_SERVICE_ACCOUNT_JSON  (required)
     GOOGLE_SHEET_ID    (optional: skips the Drive name lookup)
     GOOGLE_SHEET_NAME  (default "Proxaim Benchmark Registry")

   Honesty rules (enforced here, not in prose):
   - source="seed" rows are template values, NEVER real scans: excluded from
     every published figure.
   - A rescanned domain counts once, at its latest score (per pillar).
   - Bucket averages are null below MIN_BUCKET so the raw public JSON never
     leaks a small-sample figure the site would refuse to display.
   - Editorial fields (citeName, edition, updated, previewOverride, _note,
     cities) are preserved from the existing file, never invented here.
   - Cities are NOT computed: the benchmark store has no city column yet.
   - Countries with zero mappable rows are skipped, never zeroed out. */

import { createSign } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TAB = "Benchmark Scores";
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME || "Proxaim Benchmark Registry";

/* Published-figure definitions (state these wherever the numbers appear):
   - "not fully findable by AI assistants" = Found score below 100.
     (Matches the established claim language: "zero achieved 100/100".)
   - "did not reach a passing security grade" = Secure score below 80,
     i.e. below grade B, the passing boundary used in the corrected
     cohort narrative (80/B = a passing grade). */
const NOT_FULLY_FINDABLE_BELOW = 100;
const SECURITY_PASS_AT = 80;
const MIN_BUCKET = 10; // must match MIN_BUCKET in app.js

/* Store enums (must match found-score/server/src/lib/found-score/benchmark.ts) */
const REGION_TO_COUNTRY = {
  "Northern Italy": "it",
  "Central Italy": "it",
  "Southern Italy & Islands": "it",
  "United Kingdom": "uk",
  "Northern Spain": "es",
  "Central Spain": "es",
  "Southern Spain & Islands": "es",
};

const PROFESSION_LABELS = {
  it: {
    "Accountant (Commercialista)": "Commercialisti",
    "Lawyer (Avvocato)": "Studi legali",
    "Notary (Notaio)": "Notai",
    "Consultant": "Consulenti",
    "Architect / Engineer": "Architetti e ingegneri",
    "Customs agent / freight forwarder": "Spedizionieri e dogane",
    "Logistics": "Operatori logistici",
    "Food safety consultant": "Consulenti sicurezza alimentare",
    "Other professional services": "Altri servizi professionali",
  },
  uk: {
    "Accountant (Commercialista)": "Accountants",
    "Lawyer (Avvocato)": "Solicitors and legal",
    "Notary (Notaio)": "Notaries",
    "Consultant": "Consultants",
    "Architect / Engineer": "Architects and engineers",
    "Customs agent / freight forwarder": "Customs and freight",
    "Logistics": "Logistics providers",
    "Food safety consultant": "Food safety consultants",
    "Other professional services": "Other professional services",
  },
  es: {
    "Accountant (Commercialista)": "Asesores fiscales y contables",
    "Lawyer (Avvocato)": "Despachos de abogados",
    "Notary (Notaio)": "Notarías",
    "Consultant": "Consultores",
    "Architect / Engineer": "Arquitectos e ingenieros",
    "Customs agent / freight forwarder": "Agentes de aduanas y transitarios",
    "Logistics": "Operadores logísticos",
    "Food safety consultant": "Consultores de seguridad alimentaria",
    "Other professional services": "Otros servicios profesionales",
  },
};

/* ---------- pure computation (exercised by --self-test) ---------- */

export function parseRows(values) {
  return (values ?? [])
    .map((r) => ({
      domain: String(r[0] ?? ""),
      timestamp: String(r[1] ?? ""),
      score: Number(r[2] ?? NaN),
      profession: String(r[3] ?? "Unspecified"),
      region: String(r[4] ?? "Unspecified"),
      source: r[5] === "seed" ? "seed" : "audit",
      pillar: r[6] === "Secure" ? "Secure" : "Found", // legacy rows = Found
      city: String(r[7] ?? "").trim(), // "" on all rows before 17 Jul 2026
    }))
    .filter((r) => r.domain && Number.isFinite(r.score) && r.score >= 0 && r.score <= 100);
}

function latestPerDomain(rows) {
  const byDomain = new Map();
  for (const r of rows) {
    const prev = byDomain.get(r.domain);
    if (!prev || r.timestamp > prev.timestamp) byDomain.set(r.domain, r);
  }
  return [...byDomain.values()];
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round = (x) => (x === null ? null : Math.round(x));
const pct = (part, whole) => (whole ? Math.round((part / whole) * 100) : null);

export function computeCountry(rows, country) {
  const inCountry = rows.filter(
    (r) => r.source === "audit" && REGION_TO_COUNTRY[r.region] === country,
  );
  const found = latestPerDomain(inCountry.filter((r) => r.pillar === "Found"));
  const secure = latestPerDomain(inCountry.filter((r) => r.pillar === "Secure"));
  const domains = new Set(inCountry.map((r) => r.domain));

  return {
    sampleSize: domains.size,
    headline: {
      // Gated the same way as computeProfessions/computeCities below: below
      // MIN_BUCKET the public JSON must never carry a national average from
      // a handful of domains (IDX-01).
      pctNotAiVisible: found.length >= MIN_BUCKET ? pct(found.filter((r) => r.score < NOT_FULLY_FINDABLE_BELOW).length, found.length) : null,
      pctFailedSecurity: secure.length >= MIN_BUCKET ? pct(secure.filter((r) => r.score < SECURITY_PASS_AT).length, secure.length) : null,
      avgFound: found.length >= MIN_BUCKET ? round(mean(found.map((r) => r.score))) : null,
      avgSecure: secure.length >= MIN_BUCKET ? round(mean(secure.map((r) => r.score))) : null,
    },
    professionBuckets: computeProfessions(found, country),
    cityBuckets: computeCities(found),
    counts: { foundDomains: found.length, secureDomains: secure.length },
  };
}

/** Profession is free text at the store level (see cleanProfession in
 * benchmark.ts) — a firm outside the original 9 known niches is captured as
 * whatever the visitor typed, not discarded. This groups Found-pillar rows
 * case-insensitively; a profession matching a known niche (e.g. "lawyer
 * (avvocato)") gets that niche's translated label, anything else is bucketed
 * under the raw text as typed, so new niches show up rather than vanishing. */
export function computeProfessions(foundRows, country) {
  const labels = PROFESSION_LABELS[country] ?? {};
  const knownByLower = new Map(Object.entries(labels).map(([k, v]) => [k.toLowerCase(), v]));
  const groups = new Map(); // display label -> rows
  for (const r of foundRows) {
    if (!r.profession || r.profession === "Unspecified") continue;
    const label = knownByLower.get(r.profession.toLowerCase()) ?? r.profession;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(r);
  }
  return [...groups.entries()].map(([name, rows]) => ({
    name,
    n: rows.length,
    avgFound: rows.length >= MIN_BUCKET ? round(mean(rows.map((r) => r.score))) : null,
  }));
}

/** Merge computed profession buckets into the editorial target-profession
 * list: editorial names (the original 8 niches) keep their order and get
 * computed n/avg (0 when no data yet); computed professions not on the
 * editorial list — a new niche someone actually typed in — are appended, so
 * they start accumulating in the published edition rather than being lost
 * until someone remembers to add them to the taxonomy. */
export function mergeProfessions(editorial, computed) {
  const byKey = new Map(computed.map((p) => [p.name.toLowerCase(), p]));
  const merged = (editorial ?? []).map((e) => {
    const hit = byKey.get(String(e.name).toLowerCase());
    if (hit) byKey.delete(hit.name.toLowerCase());
    return { name: e.name, n: hit?.n ?? 0, avgFound: hit?.avgFound ?? null };
  });
  return merged.concat([...byKey.values()]);
}

/** City buckets from Found-pillar rows that captured a city (H column,
 * populated from 17 Jul 2026). Case-insensitive grouping; display name is
 * the most common spelling seen. */
export function computeCities(foundRows) {
  const groups = new Map(); // lower-case key -> rows
  for (const r of foundRows) {
    if (!r.city) continue;
    const key = r.city.toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return [...groups.values()].map((rows) => {
    const nameCounts = new Map();
    for (const r of rows) nameCounts.set(r.city, (nameCounts.get(r.city) ?? 0) + 1);
    const name = [...nameCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return {
      name,
      n: rows.length,
      avgFound: rows.length >= MIN_BUCKET ? round(mean(rows.map((r) => r.score))) : null,
    };
  });
}

/** Merge computed city buckets into the editorial target-city list:
 * editorial names keep their order and get computed n/avg (0 when no data);
 * computed cities not on the editorial list are appended. */
export function mergeCities(editorial, computed) {
  const byKey = new Map(computed.map((c) => [c.name.toLowerCase(), c]));
  const merged = (editorial ?? []).map((e) => {
    const hit = byKey.get(String(e.name).toLowerCase());
    if (hit) byKey.delete(hit.name.toLowerCase());
    return { name: e.name, n: hit?.n ?? 0, avgFound: hit?.avgFound ?? null };
  });
  return merged.concat([...byKey.values()]);
}

/* ---------- Google auth + fetch (no deps) ---------- */

function loadServiceAccount() {
  let raw = process.env.GCP_SERVICE_ACCOUNT_B64 || process.env.GCP_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Set GCP_SERVICE_ACCOUNT_B64 (or _JSON). Same credential the Found Score service uses.");
  raw = raw.trim();
  if (raw.length >= 2 && raw[0] === raw[raw.length - 1] && (raw[0] === "'" || raw[0] === '"')) {
    raw = raw.slice(1, -1).trim();
  }
  if (!raw.startsWith("{")) raw = Buffer.from(raw, "base64").toString("utf-8");
  return JSON.parse(raw);
}

const b64url = (buf) => Buffer.from(buf).toString("base64url");

async function accessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const jwt = `${header}.${claims}.${b64url(signer.sign(sa.private_key))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`);
  return (await res.json()).access_token;
}

async function gapi(token, url) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${url} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

async function fetchSheetRows(token) {
  let id = process.env.GOOGLE_SHEET_ID;
  if (!id) {
    const q = encodeURIComponent(
      `name = '${SHEET_NAME.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
    );
    const list = await gapi(token, `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`);
    id = list.files?.[0]?.id;
    if (!id) throw new Error(`Spreadsheet "${SHEET_NAME}" not found in Drive for this service account.`);
  }
  const range = encodeURIComponent(`'${TAB}'!A2:H`);
  const data = await gapi(token, `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${range}`);
  return data.values ?? [];
}

/* ---------- file assembly ---------- */

function regenerateFile(country, computed) {
  const path = join(ROOT, "data", `${country}.json`);
  const existing = JSON.parse(readFileSync(path, "utf-8"));
  const out = {
    // Editorial fields: preserved, never generated.
    citeName: existing.citeName,
    edition: existing.edition,
    updated: existing.updated,
    sampleSize: computed.sampleSize,
    previewOverride: existing.previewOverride ?? false,
    _note: existing._note,
    _method:
      `Generated ${new Date().toISOString().slice(0, 10)} from the Proxaim Benchmark Registry ` +
      `(measured scans only; template seeds excluded; latest score per domain per pillar). ` +
      `"Not fully findable" = Found score < ${NOT_FULLY_FINDABLE_BELOW}. ` +
      `"Failed security" = Secure score < ${SECURITY_PASS_AT} (below grade B). ` +
      `Bucket averages withheld below n=${MIN_BUCKET}. ` +
      `City capture began 17 Jul 2026; earlier scans carry no city and appear only in national figures. ` +
      `Profession is free text since 18 Jul 2026 — niches outside the original 8 are grouped under ` +
      `whatever visitors actually type, not discarded.`,
    headline: computed.headline,
    professions: mergeProfessions(existing.professions, computed.professionBuckets),
    cities: mergeCities(existing.cities, computed.cityBuckets),
  };
  writeFileSync(path, JSON.stringify(out, null, 2) + "\n");
  return path;
}

/* ---------- self-test (fixtures, no network) ---------- */

function selfTest() {
  const rows = parseRows([
    // domain, timestamp, score, profession, region, source, pillar, city
    ["a.it", "2026-07-01 10:00:00", 40, "Accountant (Commercialista)", "Northern Italy", "audit", "Found", "Milano"],
    ["a.it", "2026-07-10 10:00:00", 60, "Accountant (Commercialista)", "Northern Italy", "audit", "Found", "Milano"], // rescan wins
    ["a.it", "2026-07-10 10:05:00", 70, "Accountant (Commercialista)", "Northern Italy", "audit", "Secure", "Milano"],
    ["b.it", "2026-07-02 10:00:00", 100, "Lawyer (Avvocato)", "Central Italy", "audit"], // legacy row, no pillar/city -> Found, ""
    ["b.it", "2026-07-02 10:05:00", 85, "Lawyer (Avvocato)", "Central Italy", "audit", "Secure"],
    ["seed:x", "2026-07-01 09:00:00", 45, "Accountant (Commercialista)", "Northern Italy", "seed", "Found"], // excluded
    ["c.uk", "2026-07-03 10:00:00", 55, "Consultant", "United Kingdom", "audit", "Found", "Edinburgh"],
    ["d.es", "2026-07-04 10:00:00", 65, "Lawyer (Avvocato)", "Central Spain", "audit", "Found", "Madrid"],
    ["e.it", "2026-07-05 10:00:00", 50, "Customs agent / freight forwarder", "Northern Italy", "audit", "Found", "milano"], // case-folds with Milano
    ["f.it", "2026-07-06 10:00:00", 45, "Dentist", "Northern Italy", "audit", "Found", "Bergamo"], // profession outside the 9 known niches
    ["bad.it", "2026-07-03 10:00:00", 999, "Consultant", "Northern Italy", "audit", "Found"], // invalid, dropped
  ]);
  const it = computeCountry(rows, "it");
  const uk = computeCountry(rows, "uk");
  const es = computeCountry(rows, "es");
  const assert = (cond, msg) => { if (!cond) throw new Error(`SELF-TEST FAIL: ${msg}`); };

  assert(it.sampleSize === 4, `it sampleSize 4, got ${it.sampleSize}`);
  // it has 4 found rows / 2 secure rows, both under MIN_BUCKET=10, so the
  // national headline is gated null too (IDX-01) — same rule as buckets,
  // not just the es case this was originally caught on.
  assert(it.headline.avgFound === null, `it avgFound gated below MIN_BUCKET (n=4), got ${it.headline.avgFound}`);
  assert(it.headline.avgSecure === null, `it avgSecure gated below MIN_BUCKET (n=2), got ${it.headline.avgSecure}`);
  assert(it.professionBuckets.every((p) => p.avgFound === null), "small buckets must stay null");
  assert(it.professionBuckets.find((p) => p.name === "Commercialisti").n === 1, "seed row must not count");
  assert(it.professionBuckets.find((p) => p.name === "Spedizionieri e dogane").n === 1, "new customs profession bucket");
  assert(it.professionBuckets.find((p) => p.name === "Dentist").n === 1, "profession outside the 9 known niches still gets its own bucket");
  const milano = it.cityBuckets.find((c) => c.name === "Milano");
  assert(milano && milano.n === 2 && milano.avgFound === null, `Milano case-folds to n=2, gated null; got ${JSON.stringify(it.cityBuckets)}`);
  assert(uk.sampleSize === 1 && uk.headline.avgSecure === null, "uk: 1 domain, no secure rows -> null");
  assert(es.sampleSize === 1 && es.headline.avgFound === null, `es: region maps but n=1 stays gated below MIN_BUCKET, got ${JSON.stringify(es.headline)}`);
  const mergedCities = mergeCities(
    [{ name: "Milano", n: 0, avgFound: null }, { name: "Torino", n: 0, avgFound: null }],
    it.cityBuckets,
  );
  assert(mergedCities.find((c) => c.name === "Milano").n === 2, "editorial Milano picks up computed n");
  assert(mergedCities.find((c) => c.name === "Torino").n === 0, "editorial Torino stays 0 (Dentist row isn't a city)");
  const mergedProfessions = mergeProfessions(
    [{ name: "Commercialisti", n: 0, avgFound: null }, { name: "Notai", n: 0, avgFound: null }],
    it.professionBuckets,
  );
  assert(mergedProfessions.find((p) => p.name === "Commercialisti").n === 1, "editorial Commercialisti picks up computed n");
  assert(mergedProfessions.find((p) => p.name === "Notai").n === 0, "editorial Notai with no data stays 0");
  assert(mergedProfessions.find((p) => p.name === "Dentist").n === 1, "unlisted profession appended by mergeProfessions");
  console.log("Self-test passed: seed exclusion, rescan-latest, legacy pillar, gating, thresholds, es mapping, city + profession fold/merge all verified.");
}

/* ---------- main ---------- */

const main = async () => {
  if (process.argv.includes("--self-test")) return selfTest();

  const sa = loadServiceAccount();
  const token = await accessToken(sa);
  const values = await fetchSheetRows(token);
  const rows = parseRows(values);
  const seeds = values.length - rows.filter((r) => r.source === "audit").length;
  console.log(`Read ${values.length} rows (${rows.filter((r) => r.source === "audit").length} audits kept, seeds/invalid excluded: ${seeds}).`);

  if (process.argv.includes("--diagnose")) {
    const unmapped = rows.filter((r) => r.source === "audit" && !REGION_TO_COUNTRY[r.region]);
    console.log(`\n${unmapped.length} audit row(s) have a region that maps to no country (excluded from every edition):`);
    for (const r of unmapped) console.log(`  domain=${r.domain}  region="${r.region}"  profession="${r.profession}"  pillar=${r.pillar}  city="${r.city}"`);
    console.log("\nIf region is empty or \"Unspecified\", the scan form did not send a region. If it's a real place name spelled outside the REGIONS enum, it needs to be typed as one of: " + Object.keys(REGION_TO_COUNTRY).join(", "));
  }

  for (const country of ["it", "uk", "es"]) {
    const computed = computeCountry(rows, country);
    if (computed.sampleSize === 0) {
      console.warn(`SKIP ${country}: zero mappable audit rows (existing file left untouched).`);
      continue;
    }
    const path = regenerateFile(country, computed);
    console.log(`Wrote ${path}: n=${computed.sampleSize} (Found domains: ${computed.counts.foundDomains}, Secure: ${computed.counts.secureDomains}).`);
  }
  console.log("Review the diff, update the editorial 'updated'/'edition' fields if publishing, then commit and push (Render redeploys).");
};

main().catch((err) => { console.error(err.message ?? err); process.exit(1); });
