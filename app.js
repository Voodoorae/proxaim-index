/* Proxaim Index — country switcher, per-country language, gated rendering.
   Data lives in data/<country>.json. Buckets under MIN_BUCKET stay
   "collecting": the Index never shows a number it cannot defend. */

const MIN_BUCKET = 10;

/* Interface language follows the selected country: the Italian edition reads
   in Italian, the Spanish in Spanish, the UK in English. */
const STRINGS = {
  uk: {
    nav_method: "Methodology", nav_cite: "Cite the Index",
    hero_kicker: "The Proxaim Index",
    hero_title: "Can AI find, trust and recommend the professionals your economy runs on?",
    hero_lede: "An independent, aggregate measure of AI findability, security posture and GDPR exposure across professional-services firms. No firm is ever named. Every figure states its sample size.",
    by_profession: "By profession", by_city: "By city",
    gate_note: "Buckets are published only once they reach a credible sample (n ≥ 10). Until then they are shown as collecting, never estimated.",
    method_title: "Methodology",
    m1_h: "What is measured",
    m1_p: "Each firm is scanned with the Proxaim Triptique: AI findability (crawler permissions, structured data, business profiles across Google, Bing and Apple, NAP consistency), security posture (outdated software, known CVEs, missing security headers, compound risk), and GDPR exposure signals. Scores are 0 to 100; security is also expressed as a grade.",
    m2_h: "How firms are selected",
    m2_p: "Firms are sampled from neutral public registers and top-of-search results per city and profession, with no performance-based filtering, plus firms scanned organically through Proxaim's public tools. Each record is tagged by source so the Index can always be recomputed.",
    m3_h: "Privacy by design",
    m3_p: "The Index is aggregate-only. No individual firm is named, ranked or identifiable. Buckets below the minimum sample threshold are withheld. This is a structural measure of a market, not a register of firms.",
    cite_title: "Citing the Index",
    cite_p: "The Proxaim Index may be cited freely with attribution. Suggested form:",
    cite_contact: "Press and institutional enquiries: hello@proxaim.com",
    footer_by: "Published by", footer_tag: "The diagnostic platform behind the data.",
    collecting: "Collecting — published at n ≥ 10",
    sample_prefix: "Sample:", firms: "firms scanned",
    updated: "Updated",
    stats: {
      invisible: "not fully findable by AI assistants",
      security: "did not reach a passing security grade",
      avgFound: "average AI findability score (0–100)",
      avgSecure: "average security score (0–100)",
    },
  },
  it: {
    nav_method: "Metodologia", nav_cite: "Citare l'Indice",
    hero_kicker: "L'Indice Proxaim",
    hero_title: "L'IA riesce a trovare, verificare e consigliare i professionisti su cui si regge la tua economia?",
    hero_lede: "Una misura indipendente e aggregata della trovabilità nell'IA, della postura di sicurezza e dell'esposizione al GDPR degli studi professionali. Nessuno studio viene mai nominato. Ogni cifra dichiara il proprio campione.",
    by_profession: "Per professione", by_city: "Per città",
    gate_note: "I gruppi vengono pubblicati solo al raggiungimento di un campione credibile (n ≥ 10). Fino ad allora risultano in raccolta, mai stimati.",
    method_title: "Metodologia",
    m1_h: "Cosa viene misurato",
    m1_p: "Ogni studio viene analizzato con il Triptique di Proxaim: trovabilità nell'IA (permessi dei crawler, dati strutturati, profili aziendali su Google, Bing e Apple, coerenza NAP), postura di sicurezza (software obsoleto, CVE noti, header di sicurezza mancanti, rischio composto) e segnali di esposizione al GDPR. I punteggi vanno da 0 a 100; la sicurezza è espressa anche come voto.",
    m2_h: "Come vengono selezionati gli studi",
    m2_p: "Gli studi sono campionati da registri pubblici neutrali e dai primi risultati di ricerca per città e professione, senza filtri basati sulle prestazioni, oltre agli studi analizzati organicamente tramite gli strumenti pubblici di Proxaim. Ogni record è etichettato per fonte, così l'Indice può sempre essere ricalcolato.",
    m3_h: "Privacy fin dalla progettazione",
    m3_p: "L'Indice è solo aggregato. Nessuno studio viene nominato, classificato o reso identificabile. I gruppi sotto la soglia minima di campione vengono trattenuti. È una misura strutturale di un mercato, non un registro di studi.",
    cite_title: "Citare l'Indice",
    cite_p: "L'Indice Proxaim può essere citato liberamente con attribuzione. Forma suggerita:",
    cite_contact: "Richieste stampa e istituzionali: hello@proxaim.com",
    footer_by: "Pubblicato da", footer_tag: "La piattaforma diagnostica dietro i dati.",
    collecting: "In raccolta — pubblicato a n ≥ 10",
    sample_prefix: "Campione:", firms: "studi analizzati",
    updated: "Aggiornato",
    stats: {
      invisible: "non pienamente trovabili dagli assistenti IA",
      security: "non hanno raggiunto un voto di sicurezza sufficiente",
      avgFound: "punteggio medio di trovabilità IA (0–100)",
      avgSecure: "punteggio medio di sicurezza (0–100)",
    },
  },
  es: {
    nav_method: "Metodología", nav_cite: "Citar el Índice",
    hero_kicker: "El Índice Proxaim",
    hero_title: "¿Puede la IA encontrar, verificar y recomendar a los profesionales de los que depende tu economía?",
    hero_lede: "Una medida independiente y agregada de la localizabilidad ante la IA, la postura de seguridad y la exposición al RGPD de los despachos profesionales. Nunca se nombra a ningún despacho. Cada cifra declara su tamaño de muestra.",
    by_profession: "Por profesión", by_city: "Por ciudad",
    gate_note: "Los grupos se publican solo al alcanzar una muestra creíble (n ≥ 10). Hasta entonces figuran como en recogida, nunca estimados.",
    method_title: "Metodología",
    m1_h: "Qué se mide",
    m1_p: "Cada despacho se analiza con el Triptique de Proxaim: localizabilidad ante la IA (permisos de rastreadores, datos estructurados, perfiles de empresa en Google, Bing y Apple, coherencia NAP), postura de seguridad (software obsoleto, CVE conocidos, cabeceras de seguridad ausentes, riesgo compuesto) y señales de exposición al RGPD. Las puntuaciones van de 0 a 100; la seguridad se expresa también como calificación.",
    m2_h: "Cómo se seleccionan los despachos",
    m2_p: "Los despachos se muestrean de registros públicos neutrales y de los primeros resultados de búsqueda por ciudad y profesión, sin filtros basados en el rendimiento, además de los despachos analizados orgánicamente mediante las herramientas públicas de Proxaim. Cada registro se etiqueta por fuente, de modo que el Índice siempre puede recalcularse.",
    m3_h: "Privacidad desde el diseño",
    m3_p: "El Índice es solo agregado. Ningún despacho es nombrado, clasificado ni identificable. Los grupos por debajo del umbral mínimo de muestra se retienen. Es una medida estructural de un mercado, no un registro de despachos.",
    cite_title: "Citar el Índice",
    cite_p: "El Índice Proxaim puede citarse libremente con atribución. Forma sugerida:",
    cite_contact: "Consultas de prensa e institucionales: hello@proxaim.com",
    footer_by: "Publicado por", footer_tag: "La plataforma de diagnóstico detrás de los datos.",
    collecting: "En recogida — se publica con n ≥ 10",
    sample_prefix: "Muestra:", firms: "despachos analizados",
    updated: "Actualizado",
    stats: {
      invisible: "no plenamente localizables por los asistentes de IA",
      security: "no alcanzaron una calificación de seguridad aprobatoria",
      avgFound: "puntuación media de localizabilidad IA (0–100)",
      avgSecure: "puntuación media de seguridad (0–100)",
    },
  },
};

const HTML_LANG = { uk: "en", it: "it", es: "es" };

function t(country) { return STRINGS[country] || STRINGS.uk; }

function applyStrings(country) {
  const s = t(country);
  document.documentElement.lang = HTML_LANG[country] || "en";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (s[key]) el.textContent = s[key];
  });
}

function statCard(value, cls, label, collecting, s) {
  if (collecting) {
    return `<div class="stat collecting"><div class="stat-num">${s.collecting}</div><div class="stat-label">${label}</div></div>`;
  }
  return `<div class="stat"><div class="stat-num ${cls}">${value}</div><div class="stat-label">${label}</div></div>`;
}

function rowHtml(name, n, avg, s) {
  if (n < MIN_BUCKET) {
    return `<div class="row gated"><span class="name">${name}</span><span class="val">${s.collecting} (n=${n})</span></div>`;
  }
  const low = avg < 60;
  return `<div class="row"><span class="name">${name}</span><div class="bar${low ? " low" : ""}"><span style="width:${Math.max(4, Math.min(100, avg))}%"></span></div><span class="val">${avg}<small>/100 · n=${n}</small></span></div>`;
}

async function loadCountry(country) {
  applyStrings(country);
  const s = t(country);
  document.querySelectorAll(".tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.country === country)));
  try { localStorage.setItem("proxaim-index-country", country); } catch { /* private mode */ }

  let d;
  try {
    const res = await fetch(`data/${country}.json`, { cache: "no-store" });
    d = await res.json();
  } catch {
    document.getElementById("headline-stats").innerHTML = `<div class="stat collecting"><div class="stat-num">${s.collecting}</div></div>`;
    return;
  }

  document.getElementById("edition-label").textContent = d.edition;
  document.getElementById("edition-updated").textContent = d.updated ? `${s.updated} ${d.updated}` : "";
  document.getElementById("edition-sample").innerHTML = d.sampleSize
    ? `${s.sample_prefix} <strong>${d.sampleSize}</strong> ${s.firms}`
    : "";

  const collecting = (d.sampleSize || 0) < MIN_BUCKET && !d.previewOverride;
  const h = d.headline || {};
  document.getElementById("headline-stats").innerHTML = [
    statCard(h.pctNotAiVisible != null ? h.pctNotAiVisible + "%" : "—", "red", s.stats.invisible, collecting || h.pctNotAiVisible == null, s),
    statCard(h.pctFailedSecurity != null ? h.pctFailedSecurity + "%" : "—", "amber", s.stats.security, collecting || h.pctFailedSecurity == null, s),
    statCard(h.avgFound != null ? h.avgFound : "—", "teal", s.stats.avgFound, collecting || h.avgFound == null, s),
    statCard(h.avgSecure != null ? h.avgSecure : "—", "teal", s.stats.avgSecure, collecting || h.avgSecure == null, s),
  ].join("");

  document.getElementById("profession-table").innerHTML =
    (d.professions || []).map((p) => rowHtml(p.name, p.n, p.avgFound, s)).join("") ||
    `<div class="row gated"><span class="val">${s.collecting}</span></div>`;
  document.getElementById("city-table").innerHTML =
    (d.cities || []).map((c) => rowHtml(c.name, c.n, c.avgFound, s)).join("") ||
    `<div class="row gated"><span class="val">${s.collecting}</span></div>`;

  const citeYear = new Date().getFullYear();
  document.getElementById("cite-example").textContent =
    `${d.citeName || "Proxaim Index"}, ${d.edition} (${citeYear}): AI findability of professional services. proxaimindex.com`;
}

document.querySelectorAll(".tab").forEach((b) =>
  b.addEventListener("click", () => loadCountry(b.dataset.country))
);
document.getElementById("year").textContent = new Date().getFullYear();

let initial = "it";
try { initial = localStorage.getItem("proxaim-index-country") || "it"; } catch { /* default */ }
loadCountry(initial);
