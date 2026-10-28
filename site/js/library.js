import { api } from "./api.js";
import { deriveItems, summarize, groupBy } from "./analytics.js";
import { loadQuestionMeta } from "./stats.js";
import { $, esc, fmtDur, fmtDate, pct, toast, modal } from "./util.js";

const PLAN = { 1: ["ps-runs", "oxford-full", "oxford-mix"], 2: ["oxford-full", "ps-runs", "oxford-mix"], 3: ["oxford-full", "oxford-mix", "ps-runs"] };

export async function loadLibrary() {
  const [series, mocks, status, attempts] = await Promise.all([api.series(), api.mocks(), api.myMockStatus(), api.myAttempts()]);
  const mById = Object.fromEntries(mocks.map(m => [m.id, m]));
  const rows = status.filter(s => mById[s.mock_id]).map(s => ({ ...s, mock: mById[s.mock_id] }));
  const lastAttempt = id => attempts.find(a => a.mock_id === id && a.status === "submitted");
  const openAttempt = id => attempts.find(a => a.mock_id === id && a.status === "in_progress");
  return { series, rows, attempts, lastAttempt, openAttempt };
}

export function relTime(iso) {
  const ms = Date.parse(iso) - Date.now(), abs = Math.abs(ms);
  const t = abs < 3600000 ? `${Math.max(1, Math.round(abs / 60000))} min` : abs < 172800000 ? `${Math.round(abs / 3600000)} h` : `${Math.round(abs / 86400000)} days`;
  return ms >= 0 ? `in ${t}` : `${t} ago`;
}

export function dueLine(r) {
  if (r.state === "upcoming") return `opens ${fmtDate(r.opens_at)} (${relTime(r.opens_at)})`;
  if (r.deadline_at && !r.closed_at) return `due ${fmtDate(r.deadline_at)} (${relTime(r.deadline_at)})`;
  return "";
}

export async function startMockFlow(r, ctx) {
  const m = r.mock, mins = fmtDur(r.time_limit_sec * 1000, { sec: false });
  const ok = await modal({ title: `Start “${m.title}”?`, body: `<p>${m.question_ids.length} questions, <b>${mins}</b>${r.extra_time_sec > 0 ? ` <span class="muted small">(includes ${fmtDur(r.extra_time_sec * 1000, { sec: false })} extra time)</span>` : ""}.</p>
    ${r.assignment_id && r.state === "available" && !r.released ? `<p class="muted small">Answers are shown after everyone assigned has finished${r.deadline_at ? " or the deadline passes" : ""}.</p>` : ""}
    <p>The timer starts now and keeps running even if you close the page. Find a quiet place and make sure you have time to finish.</p>
    <p class="muted small">Tip: you can hide the timer by clicking it; you'll still get warnings at 10, 5 and 1 minutes.</p>`,
    buttons: [{ label: "Not now", value: false }, { label: "Start the test", value: true, kind: "primary" }] });
  if (!ok) return;
  try { ctx.go(`#/run/${await api.startMock(m.id)}`); } catch (err) { toast(err.message, "error"); }
}

const LOCK = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor"/><path d="M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;

function tile(r, lib) {
  const m = r.mock, last = lib.lastAttempt(m.id), open = lib.openAttempt(m.id);
  const label = `${m.title}${m.description ? " — " + m.description : ""}`;
  const n = `<span class="lt-n">${r.seq ?? "•"}</span>`;
  if (r.state === "in_progress" && open) return `<a class="lt lt-go" href="#/run/${open.id}" title="${esc(label)}">${n}<span class="lt-s">Continue</span></a>`;
  if (r.state === "available") return `<button class="lt lt-go${r.assignment_id && !r.closed_at ? " lt-asg" : ""}" data-start="${m.id}" title="${esc(label)}${r.assignment_id && !r.closed_at ? " — assigned to you" : ""}">${n}<span class="lt-s">${last ? "Retake" : "Start"}</span></button>`;
  if (r.state === "done" && last) return `<a class="lt lt-done" href="#/attempt/${last.id}" title="${esc(label)}">${n}<span class="lt-s">${last.score ?? 0}/${last.total}</span></a>`;
  if (r.state === "done") return `<span class="lt lt-done" title="${esc(label)}${r.skipped ? " — done on paper" : ""}">${n}<span class="lt-s">${r.skipped ? "paper" : "done"}</span></span>`;
  if (r.state === "upcoming") return `<span class="lt lt-wait" title="${esc(label)}">${n}<span class="lt-s">${esc(fmtDate(r.opens_at, false))}</span></span>`;
  if (r.state === "missed") return `<span class="lt lt-lock" title="${esc(label)} — the deadline passed">${n}<span class="lt-s">missed</span></span>`;
  if (r.state === "locked_tier") return `<span class="lt lt-plan" title="${esc(label)} — not included in your plan">${n}<span class="lt-s">${LOCK}</span></span>`;
  return `<span class="lt lt-lock" title="${esc(label)} — finish the previous one first">${n}<span class="lt-s">${LOCK}</span></span>`;
}

export function assignedRows(lib) {
  return lib.rows.filter(r => r.assignment_id && !r.closed_at && ["available", "in_progress", "upcoming"].includes(r.state))
    .sort((a, b) => (a.deadline_at || "9").localeCompare(b.deadline_at || "9"));
}

function assignedCard(lib) {
  const rows = assignedRows(lib);
  if (!rows.length) return "";
  return `<section class="card assigned"><h2>Assigned to you</h2>${rows.map(r => {
    const open = lib.openAttempt(r.mock.id);
    const soon = r.deadline_at && Date.parse(r.deadline_at) - Date.now() < 86400000;
    return `<div class="row-item"><div><b>${esc(r.mock.title)}</b> ${soon ? '<span class="pill pill-warn">due soon</span>' : ""}
      <div class="muted small">${r.mock.question_ids.length} questions · ${fmtDur(r.time_limit_sec * 1000, { sec: false })}${dueLine(r) ? " · " + esc(dueLine(r)) : ""}</div></div>
      ${r.state === "in_progress" && open ? `<a class="btn btn-primary" href="#/run/${open.id}">Continue</a>` : r.state === "available" ? `<button class="btn btn-primary" data-start="${r.mock.id}">Start</button>` : `<span class="muted small">not open yet</span>`}</div>`;
  }).join("")}</section>`;
}

export function seriesProgress(lib) {
  return lib.series.map(s => {
    const rs = lib.rows.filter(r => r.series_id === s.id);
    return { s, rs, done: rs.filter(r => r.state === "done").length, inPlan: rs.filter(r => r.state !== "locked_tier").length };
  }).filter(x => x.rs.length);
}

export async function showMocksPage(root, ctx) {
  root.innerHTML = `<div class="loading">Loading…</div>`;
  const lib = await loadLibrary();
  const other = lib.rows.filter(r => !r.series_id && !(r.assignment_id && !r.closed_at && ["available", "in_progress", "upcoming"].includes(r.state)));
  root.innerHTML = `<div class="page">
    <div class="page-head"><h1>Mocks</h1></div>
    ${assignedCard(lib)}
    ${seriesProgress(lib).map(({ s, rs, done, inPlan }) => `<section class="card lib-series">
      <div class="card-head"><h2>${esc(s.title)}</h2><span class="muted small">${done} of ${inPlan} done${inPlan < rs.length ? ` · ${rs.length - inPlan} more in a bigger plan` : ""}</span></div>
      ${s.description ? `<p class="muted small">${esc(s.description)}</p>` : ""}
      <div class="lib-grid">${rs.map(r => tile(r, lib)).join("")}</div></section>`).join("")}
    ${other.length ? `<section class="card"><h2>Other mocks</h2>${other.map(r => {
      const last = lib.lastAttempt(r.mock.id), open = lib.openAttempt(r.mock.id);
      return `<div class="row-item"><div><b>${esc(r.mock.title)}</b><div class="muted small">${r.mock.question_ids.length} questions · ${fmtDur(r.time_limit_sec * 1000, { sec: false })}${r.mock.description ? " · " + esc(r.mock.description) : ""}${r.used ? ` · taken ${r.used}×` : ""}</div></div>
        ${r.state === "in_progress" && open ? `<a class="btn" href="#/run/${open.id}">Continue</a>` : r.state === "available" ? `<button class="btn btn-primary" data-start="${r.mock.id}">Start</button>` : last ? `<a class="btn btn-ghost" href="#/attempt/${last.id}">${last.score ?? 0}/${last.total} · Review</a>` : `<span class="muted small">${r.state === "missed" ? "missed" : "done"}</span>`}</div>`;
    }).join("")}</section>` : ""}
    ${lib.rows.length ? `<p class="muted small lib-legend"><span class="lt-key lt-go"></span> open <span class="lt-key lt-done"></span> done (your score) <span class="lt-key lt-lock"></span> opens after the previous one <span class="lt-key lt-plan"></span> not in your plan</p>` : `<div class="card empty"><p class="muted">No mocks yet.</p></div>`}
  </div>`;
  root.onclick = e => {
    const b = e.target.closest("[data-start]");
    if (b) startMockFlow(lib.rows.find(r => r.mock.id === b.dataset.start), ctx);
  };
}

async function weakestType(ctx) {
  const { attempts, items } = await api.statsData(ctx.me.id);
  if (items.length < 10) return null;
  const qmeta = await loadQuestionMeta(items.map(i => i.question_id));
  const ds = deriveItems(attempts, items, qmeta).filter(d => d.category !== "?");
  const rows = [...groupBy(ds, d => d.subcategory)].map(([k, g]) => ({ k, cat: g[0].category, ...summarize(g) }))
    .filter(r => r.n >= 5 && r.acc < 75).sort((a, b) => a.acc - b.acc);
  return rows[0] || null;
}

export function recommendMock(lib, level) {
  const assigned = new Set(assignedRows(lib).map(r => r.mock.id));
  const order = PLAN[level] || PLAN[3];
  const ids = [...order, ...lib.series.map(s => s.id).filter(id => !order.includes(id))];
  for (const id of ids) {
    const r = lib.rows.filter(x => x.series_id === id && x.state === "available" && !assigned.has(x.mock.id)).sort((a, b) => a.seq - b.seq)[0];
    if (r) return { r, why: () => `Next in ${esc(lib.series.find(s => s.id === id)?.title || "the library")}.` };
  }
  return null;
}

export async function nextStepCard(el, lib, ctx) {
  const rec = recommendMock(lib, ctx.me.skill_level);
  const lvl = ctx.levels.find(l => l.level === ctx.me.skill_level);
  const parts = [];
  if (rec) parts.push(`<div class="row-item"><div><b>${esc(rec.r.mock.title)}</b><div class="muted small">${rec.why(rec.r)} ${rec.r.mock.question_ids.length} questions · ${fmtDur(rec.r.time_limit_sec * 1000, { sec: false })}</div></div>
    <button class="btn btn-primary" data-start="${rec.r.mock.id}">Start</button></div>`);
  parts.push(`<div class="row-item" id="weakRow"><div><b>Practice</b><div class="muted small">Looking at your answers…</div></div></div>`);
  el.innerHTML = `<section class="card next-step"><div class="card-head"><h2>Next step</h2>${lvl ? `<span class="pill">${esc(lvl.label)}</span>` : ""}</div>${parts.join("")}</section>`;
  el.onclick = e => {
    const b = e.target.closest("[data-start]");
    if (b) return startMockFlow(lib.rows.find(r => r.mock.id === b.dataset.start), ctx);
    const p = e.target.closest("[data-weak]");
    if (p) {
      p.disabled = true;
      const o = JSON.parse(p.dataset.weak);
      api.startPractice({ count: 10, ...o }).then(id => ctx.go(`#/run/${id}`)).catch(err => {
        toast(/no questions/.test(err.message) ? "No more practice questions of this type yet — try a mock first." : err.message, "error"); p.disabled = false; });
    }
  };
  let w = null;
  try { w = await weakestType(ctx); } catch (_) {}
  const row = $("#weakRow", el); if (!row) return;
  if (w) {
    const label = ctx.labels[w.k] || w.k;
    const o = w.k.endsWith(":untagged") || w.k === "untagged" ? { category: w.cat } : { subcategory: w.k };
    row.innerHTML = `<div><b>Practise: ${esc(label)}</b><div class="muted small">Your weakest question type so far: ${w.acc}% correct over ${w.n} questions.</div></div>
      <button class="btn" data-weak='${esc(JSON.stringify(o))}'>10 questions</button>`;
  } else {
    row.innerHTML = `<div><b>Practice</b><div class="muted small">A short untimed set to keep your accuracy up.</div></div><button class="btn" data-weak='{}'>10 questions</button>`;
  }
}

export { assignedCard };
