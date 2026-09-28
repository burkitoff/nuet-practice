import { api } from "./api.js";
import { deriveItems, summarize, groupBy, insights, byThirds, mockTrend } from "./analytics.js";
import { lineChart, accBar, ratioPill, timeBars } from "./charts.js";
import { $, esc, fmtDur, fmtDate, pct, fmtPct, h } from "./util.js";

export async function loadQuestionMeta(ids) {
  const qs = await api.questions([...new Set(ids)]);
  return Object.fromEntries(qs.map(q => [q.id, q]));
}

export function typeTable(ds, keyFn, labelFn, { showChanges = true } = {}) {
  const rows = [...groupBy(ds, keyFn)].map(([k, g]) => ({ k, ...summarize(g) })).sort((a, b) => (a.acc ?? 0) - (b.acc ?? 0));
  if (!rows.length) return `<p class="muted">No data yet.</p>`;
  return `<table class="tbl"><thead><tr><th>Type</th><th>Qs</th><th>Correct</th><th>Avg time</th><th>vs target</th><th title="Wrong after very little time">Rushed</th><th title="More than 2× target">Stuck</th>${showChanges ? "<th>W→R / R→W</th>" : ""}</tr></thead><tbody>
    ${rows.map(r => `<tr><td>${labelFn(r.k)}</td><td>${r.n}</td><td>${accBar(r.acc)}</td><td>${fmtDur(r.avgMs)}</td><td>${ratioPill(r.avgRatio)}</td>
      <td>${r.rushed ? `${r.rushed} <span class="muted">(${pct(r.rushed, r.n)}%)</span>` : ""}</td><td>${r.stuck ? `${r.stuck} <span class="muted">(${pct(r.stuck, r.n)}%)</span>` : ""}</td>
      ${showChanges ? `<td>${r.wr || r.rw ? `${r.wr} / ${r.rw}` : ""}</td>` : ""}</tr>`).join("")}</tbody></table>`;
}

export async function showStats(root, userId, ctx) {
  root.innerHTML = `<div class="loading">Loading…</div>`;
  const L = ctx.labels;
  let who = ctx.me;
  if (userId !== ctx.me.id) who = (await api.profiles()).find(p => p.id === userId) || { display_name: "Student" };
  const { attempts, items } = await api.statsData(userId);
  const qmeta = await loadQuestionMeta(items.map(i => i.question_id));
  const all = deriveItems(attempts, items, qmeta);
  let mode = "all", days = 0;

  function render() {
    const since = days ? Date.now() - days * 86400000 : 0;
    const ds = all.filter(d => (mode === "all" || d.mode === mode) && Date.parse(d.attempt.started_at) >= since);
    const atts = attempts.filter(a => (mode === "all" || a.mode === mode) && Date.parse(a.started_at) >= since);
    const s = summarize(ds);
    const trend = mockTrend(atts, ds);
    const cats = { P: "Problem Solving", R: "Critical Thinking" };
    const lbl = k => `${esc(L[k] || k)}`;
    const subLbl = k => { const c = ds.find(d => d.subcategory === k)?.category; return `<span class="cat cat-${esc(c)}">${esc(c)}</span> ${lbl(k)}`; };
    const hasSkills = ds.some(d => d.skills.length);
    const th = byThirds(ds);

    $("#statsBody", root).innerHTML = !ds.length ? `<div class="card empty"><p>No finished questions yet${mode !== "all" || days ? " for this filter" : ""}.</p><p><a class="btn btn-primary" href="#/practice">Start practising</a></p></div>` : `
      <div class="tiles">
        <div class="tile"><b>${s.n}</b><span>questions done</span></div>
        <div class="tile"><b>${fmtPct(s.acc)}</b><span>correct</span></div>
        <div class="tile"><b>${s.avgRatio ? s.avgRatio.toFixed(2) + "×" : "–"}</b><span>average time vs target</span></div>
        <div class="tile"><b>${trend.length}</b><span>mocks taken</span></div>
        <div class="tile"><b>${fmtPct(pct(s.rushed, s.n))}</b><span>rushed</span></div>
        <div class="tile"><b>${fmtPct(pct(s.stuck, s.n))}</b><span>stuck</span></div>
        <div class="tile"><b>${fmtDur(s.wastedMs, { sec: false })}</b><span>spent on questions answered wrong</span></div>
      </div>
      <section class="card"><h2>Key findings</h2><ul class="insights">${insights(ds, L).map(i => `<li class="ins-${i.kind}">${esc(i.text)}</li>`).join("")}</ul></section>
      ${trend.length ? `<section class="card"><h2>Mock scores over time</h2>
        <div class="chart-wrap">${lineChart(trend.map((t, i) => ({ v: t.scorePct ?? 0, x: fmtDate(t.date, false), title: t.attempt.title })))}</div>
        <table class="tbl"><thead><tr><th>Date</th><th>Mock</th><th>Score</th><th>Time used</th><th>Blanks</th><th>Rushed</th><th>Stuck</th><th></th></tr></thead><tbody>
        ${trend.slice().reverse().map(t => `<tr><td>${fmtDate(t.date)}</td><td>${esc(t.attempt.title)}</td><td><b>${t.attempt.score}/${t.attempt.total}</b> <span class="muted">${fmtPct(t.scorePct)}</span></td>
          <td>${fmtDur(t.usedMs)}${t.attempt.time_limit_sec ? ` / ${fmtDur(t.attempt.time_limit_sec * 1000)}` : ""}${t.attempt.auto_submitted ? ' <span class="pill pill-warn">timed out</span>' : ""}</td>
          <td>${t.blanks || ""}</td><td>${t.rushed || ""}</td><td>${t.stuck || ""}</td><td><a href="#/attempt/${t.attempt.id}">Review →</a></td></tr>`).join("")}</tbody></table></section>` : ""}
      <section class="card"><h2>By section</h2>${typeTable(ds, d => d.category, k => `<span class="cat cat-${esc(k)}">${esc(k)}</span> ${esc(cats[k] || k)}`)}</section>
      <section class="card"><h2>By question type</h2><p class="muted small">Sorted weakest first. “vs target” compares your time with the time you can afford per question.</p>${typeTable(ds, d => d.subcategory, subLbl)}</section>
      ${hasSkills ? `<section class="card"><h2>By skill</h2>${typeTable(ds.filter(d => d.skills.length), d => d.skills, lbl, { showChanges: false })}</section>` : ""}
      ${th.some(t => t.n) ? `<section class="card"><h2>Stamina: position in the mock</h2><p class="muted small">If accuracy falls or blanks rise in the last third, time management — not knowledge — is costing marks.</p>
        <table class="tbl"><thead><tr><th>Part of the paper</th><th>Qs</th><th>Correct</th><th>Avg time</th><th>Blank</th><th>Rushed</th></tr></thead><tbody>
        ${th.map(t => `<tr><td>${t.label}</td><td>${t.n}</td><td>${accBar(t.acc)}</td><td>${fmtDur(t.avgMs)}</td><td>${t.blanks || ""}</td><td>${t.rushed || ""}</td></tr>`).join("")}</tbody></table></section>` : ""}
      <section class="card"><h2>All sessions</h2><table class="tbl"><thead><tr><th>Date</th><th>Type</th><th>Title</th><th>Score</th><th></th></tr></thead><tbody>
        ${atts.slice().reverse().map(a => `<tr><td>${fmtDate(a.started_at)}</td><td>${a.mode}</td><td>${esc(a.title)}</td><td>${a.score ?? "–"}/${a.total}</td><td><a href="#/attempt/${a.id}">Review →</a></td></tr>`).join("")}
      </tbody></table></section>`;
  }

  root.innerHTML = `<div class="page">
    <p class="crumbs"><a href="#/">Home</a>${userId !== ctx.me.id ? ` › <a href="#/admin/class">Class</a>` : ""} › Statistics</p>
    <div class="page-head"><h1>${userId === ctx.me.id ? "My statistics" : esc(who.display_name || who.username)}</h1>
      <div class="filters">
        <select id="fMode" aria-label="Mode"><option value="all">Mocks + practice</option><option value="mock">Mocks only</option><option value="practice">Practice only</option></select>
        <select id="fDays" aria-label="Period"><option value="0">All time</option><option value="30">Last 30 days</option><option value="7">Last 7 days</option></select>
      </div></div>
    <div id="statsBody"></div></div>`;
  $("#fMode", root).onchange = e => { mode = e.target.value; render(); };
  $("#fDays", root).onchange = e => { days = +e.target.value; render(); };
  render();
}
