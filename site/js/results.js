import { api } from "./api.js";
import { renderQuestion, mediaPaths } from "./render.js";
import { deriveItems, summarize, groupBy, timeline, insights, targetMs } from "./analytics.js";
import { timelineChart, timeBars, accBar, ratioPill } from "./charts.js";
import { $, $$, esc, fmtDur, fmtDate, pct, fmtPct, modal, toast } from "./util.js";
import { reportProblem } from "./runner.js";

const EV_TEXT = { in: "opened", out: "left", sel: "chose", clr: "cleared answer", x: "crossed out", ux: "un-crossed", flag: "flagged", unflag: "unflagged", hide: "switched away from the tab", show: "came back", idle: "no activity — clock paused", active: "active again" };

export function eventLog(events) {
  const rows = (events || []).filter(e => e.e !== "in" && e.e !== "out" || true).map(e =>
    `<li><span class="t">${fmtDur(e.t)}</span> ${esc(EV_TEXT[e.e] || e.e)}${e.v ? ` <b>${esc(e.v)}</b>` : ""}${e.src === "sheet" ? ' <span class="muted">(on answer sheet)</span>' : ""}</li>`);
  return `<ol class="evlog">${rows.join("")}</ol>`;
}

export async function showAttempt(root, id, ctx) {
  root.innerHTML = `<div class="loading">Loading…</div>`;
  const { attempt: a, items } = await api.attempt(id);
  if (a.status === "in_progress") {
    const me = await api.me();
    if (a.user_id === me.id) { ctx.go(`#/run/${id}`); return; }
  }
  const qs = await api.questions(a.question_ids);
  const qById = Object.fromEntries(qs.map(q => [q.id, q]));
  const isAdmin = ctx.me.role === "admin";
  const exBy = Object.fromEntries(items.map(i => [i.question_id, i]));
  const rows = deriveItems([{ ...a, excluded: false }], items.map(i => ({ ...i, excluded: false })), qById)
    .map(d => ({ ...d, isExcluded: !!exBy[d.question_id].excluded || a.excluded, note: exBy[d.question_id].admin_note, overridden: exBy[d.question_id].time_override_ms != null }))
    .sort((x, y) => x.position - y.position);
  const ds = rows.filter(d => !d.isExcluded);
  const s = summarize(ds);
  const tgt = targetMs(a);
  const used = ds.reduce((x, d) => x + d.time_ms, 0);
  const isMock = a.mode === "mock";
  const reveal = ds.some(d => d.correct_answer);
  const L = ctx.labels;
  let owner = "";
  if (ctx.me.role === "admin" && a.user_id !== ctx.me.id) {
    const p = (await api.profiles()).find(x => x.id === a.user_id);
    owner = p ? ` · <a href="#/stats/${p.id}">${esc(p.display_name || p.username)}</a>` : "";
  }

  const subs = [...groupBy(ds, d => d.subcategory)].map(([k, g]) => ({ k, cat: g[0].category, ...summarize(g) }))
    .sort((x, y) => x.cat.localeCompare(y.cat) || x.acc - y.acc);

  root.innerHTML = `
  <div class="page">
    <p class="crumbs"><a href="#/">Home</a> › ${isMock ? "Mock" : "Practice"} result${owner}</p>
    <div class="result-head card">
      <div>
        <h1>${esc(a.title || (isMock ? "Mock" : "Practice"))}</h1>
        <p class="muted">${fmtDate(a.started_at)}${a.auto_submitted ? " · <b>submitted automatically</b> (time ran out)" : ""}</p>
        ${a.excluded ? `<p class="note">Your teacher has left this attempt out of your statistics${a.admin_note ? `: ${esc(a.admin_note)}` : ""}.</p>` : ""}
        ${!a.excluded && rows.some(d => d.isExcluded) ? `<p class="note">${rows.filter(d => d.isExcluded).length} question(s) are not counted in the statistics (set by your teacher).</p>` : ""}
      </div>
      ${isAdmin ? `<div class="admin-box"><label class="check small"><input type="checkbox" id="exAttempt" ${a.excluded ? "checked" : ""}> Leave this whole attempt out of statistics</label>
        <button class="btn btn-ghost btn-sm danger" id="delAttempt">Delete attempt</button></div>` : ""}
      <div class="bigscore"><span>${a.score ?? 0}</span>/<small>${a.total}</small><div class="muted">${fmtPct(pct(a.score, a.total))}</div></div>
    </div>

    <div class="tiles">
      <div class="tile"><b>${fmtDur(used)}</b><span>time on questions${a.time_limit_sec ? ` of ${fmtDur(a.time_limit_sec * 1000)}` : ""}</span></div>
      <div class="tile"><b>${fmtDur(s.avgMs)}</b><span>average per question (target ${fmtDur(tgt)})</span></div>
      <div class="tile"><b>${s.blanks}</b><span>left blank</span></div>
      <div class="tile"><b>${s.rushed}</b><span>rushed (wrong in &lt; ${fmtDur(tgt * 0.4)})</span></div>
      <div class="tile"><b>${s.stuck}</b><span>stuck (&gt; ${fmtDur(tgt * 2)})</span></div>
      <div class="tile"><b>${reveal ? `${s.wr} / ${s.rw}` : s.changed}</b><span>${reveal ? "changes wrong→right / right→wrong" : "answers changed"}</span></div>
      ${a.hidden_ms > 5000 ? `<div class="tile"><b>${fmtDur(a.hidden_ms)}</b><span>away from the tab</span></div>` : ""}
    </div>

    ${ds.length >= 5 ? `<section class="card"><h2>What this attempt shows</h2><ul class="insights">${insights(ds, L).map(i => `<li class="ins-${i.kind}">${esc(i.text)}</li>`).join("")}</ul></section>` : ""}

    <section class="card">
      <h2>Your path through the ${isMock ? "test" : "set"}</h2>
      <p class="muted small">Each blue bar is the time a question was open; dots are answer choices (<span class="c-good">●</span> right, <span class="c-bad">●</span> wrong). ${isMock ? "The dashed line is an even pace; the red line is the time limit." : ""}</p>
      <div class="chart-wrap">${timelineChart(timeline(items), { total: a.total, limitMs: a.time_limit_sec ? a.time_limit_sec * 1000 : null })}</div>
    </section>

    <section class="card">
      <h2>Time per question</h2>
      <div class="chart-wrap">${timeBars(ds, { targetMs: tgt })}</div>
    </section>

    <section class="card">
      <h2>By question type</h2>
      <table class="tbl"><thead><tr><th>Type</th><th>Qs</th><th>Correct</th><th>Avg time</th><th>vs target</th><th>Rushed</th><th>Stuck</th></tr></thead>
      <tbody>${subs.map(r => `<tr><td><span class="cat cat-${esc(r.cat)}">${esc(r.cat)}</span> ${esc(L[r.k] || r.k)}</td><td>${r.n}</td><td>${accBar(r.acc)}</td><td>${fmtDur(r.avgMs)}</td><td>${ratioPill(r.avgRatio)}</td><td>${r.rushed || ""}</td><td>${r.stuck || ""}</td></tr>`).join("")}</tbody></table>
    </section>

    <section class="card">
      <h2>Question by question</h2>
      ${!reveal && isMock ? `<p class="note">Correct answers for this mock will be shown after your teacher releases them.</p>` : ""}
      <table class="tbl qtable"><thead><tr><th>#</th><th>Type</th><th>Yours</th><th>Correct</th><th>Time</th><th>1st answer after</th><th>Visits</th><th>Changes</th><th></th>${isAdmin ? "<th></th>" : ""}</tr></thead>
      <tbody>${rows.map(d => `
        <tr class="qrow st-${d.status} ${d.isExcluded ? "is-excluded" : ""}" data-q="${d.position}" title="${d.isExcluded ? "Not counted" + (d.note ? ": " + esc(d.note) : "") : ""}">
          <td><b>${d.position}</b></td>
          <td class="small">${esc(L[d.subcategory] || d.subcategory)}</td>
          <td><span class="ans ans-${d.status}">${esc(d.answer || "—")}</span></td>
          <td>${esc(d.correct_answer || (reveal ? "" : "?"))}</td>
          <td>${fmtDur(d.time_ms)}${d.overridden ? ` <span class="pill" title="Recorded ${fmtDur(d.raw_time_ms)}; corrected by teacher">edited</span>` : ""} ${d.isExcluded ? '<span class="pill">not counted</span>' : ""} ${d.stuck ? '<span class="pill pill-bad">stuck</span>' : d.rushed ? '<span class="pill pill-warn">rushed</span>' : ""}</td>
          <td>${d.decisionMs != null ? fmtDur(d.decisionMs) : "–"}</td>
          <td>${d.visits}</td>
          <td>${d.changes || ""}${d.change === "RW" ? ' <span class="pill pill-bad">R→W</span>' : d.change === "WR" ? ' <span class="pill pill-good">W→R</span>' : ""}</td>
          <td>${d.flagged ? "⚑" : ""}</td>
          ${isAdmin ? `<td><button class="btn btn-ghost btn-sm" data-edit="${d.position}">Edit</button></td>` : ""}
        </tr>
        <tr class="qdetail" hidden data-detail="${d.position}"><td colspan="${isAdmin ? 10 : 9}"></td></tr>`).join("")}</tbody></table>
    </section>
  </div>`;

  let urls = null;
  if (isAdmin) {
    $("#exAttempt", root).onchange = async e => {
      const note = e.target.checked ? (await modal({ title: "Reason (optional)", body: `<label>Note<input id="nt" maxlength="200" placeholder="e.g. left the window open"></label>`,
        buttons: [{ label: "Save", value: box => $("#nt", box).value.trim(), kind: "primary" }] })) ?? "" : "";
      await api.adminUpdateAttempt(a.id, e.target.checked, note); toast("Saved", "good"); showAttempt(root, id, ctx);
    };
    $("#delAttempt", root).onclick = async () => {
      if (!(await modal({ title: "Delete this attempt?", body: "<p>All answers of this attempt are permanently deleted. To keep them but not count them, use the checkbox instead.</p>",
        buttons: [{ label: "Cancel", value: false }, { label: "Delete", value: true, kind: "danger" }] }))) return;
      await api.deleteAttempt(a.id); toast("Deleted", "good"); ctx.go("#/admin/cleanup");
    };
    $$("[data-edit]", root).forEach(b => b.addEventListener("click", async e => {
      e.stopPropagation();
      const d = rows.find(x => x.position === +b.dataset.edit);
      if (await editItemDialog(d, tgt)) showAttempt(root, id, ctx);
    }));
  }

  $$(".qrow", root).forEach(tr => tr.addEventListener("click", async () => {
    const pos = +tr.dataset.q;
    const det = $(`[data-detail="${pos}"]`, root);
    if (!det.hidden) { det.hidden = true; return; }
    const d = rows.find(x => x.position === pos);
    const q = qById[d.question_id];
    if (!q) { det.firstElementChild.innerHTML = `<p class="muted">This question is no longer available.</p>`; det.hidden = false; return; }
    urls = urls || await api.mediaUrls(qs.flatMap(mediaPaths));
    det.firstElementChild.innerHTML = `<div class="detail-grid">
      <div class="paper paper-small">${renderQuestion(q, urls, { number: pos, answer: d.answer, crossed: new Set(d.crossed), correct: d.correct_answer })}</div>
      <div><h3>What happened</h3>${eventLog(d.events)}
      ${isAdmin ? `<p class="muted small">${esc(q.id)}${d.note ? ` · note: ${esc(d.note)}` : ""}</p>` : `<p><button class="btn btn-ghost btn-sm" data-report="${esc(q.id)}">Report a problem with this question</button></p>`}</div></div>`;
    det.hidden = false;
    det.querySelector("[data-report]")?.addEventListener("click", () => reportProblem(q.id, a.id));
  }));
}

export async function editItemDialog(d, targetMs) {
  const cur = d.overridden ? Math.round(d.time_ms / 1000) : "";
  const res = await modal({
    title: `Question ${d.position} — fix data`,
    body: `<p class="small muted">Recorded time: <b>${fmtDur(d.raw_time_ms)}</b> (target ${fmtDur(targetMs)}). Answer: <b>${esc(d.answer || "blank")}</b>. Nothing is deleted — you can undo this any time.</p>
      <label class="check"><input type="checkbox" id="exi" ${d.isExcluded ? "checked" : ""}> Don't count this question (misclick, opened by mistake…)</label>
      <label>Corrected time in seconds <span class="muted small">(empty = use recorded time)</span>
        <span class="inline-form"><input id="tov" type="number" min="0" max="86400" value="${cur}" style="width:110px">
        <button type="button" class="btn btn-sm" id="cap2">Cap at 2× target</button><button type="button" class="btn btn-sm" id="clr">Clear</button></span></label>
      <label>Note <span class="muted small">(the student can see it)</span><input id="nte" maxlength="200" value="${esc(d.note || "")}" placeholder="e.g. left the question open"></label>`,
    buttons: [{ label: "Cancel", value: null }, { label: "Save", kind: "primary", value: box => ({
      excluded: $("#exi", box).checked, tov: $("#tov", box).value.trim(), note: $("#nte", box).value.trim() }) }],
    onOpen: box => {
      $("#cap2", box).onclick = () => { $("#tov", box).value = Math.round(Math.min(d.raw_time_ms, 2 * targetMs) / 1000); };
      $("#clr", box).onclick = () => { $("#tov", box).value = ""; };
    },
  });
  if (!res) return false;
  try {
    await api.adminUpdateItems([{ attempt_id: d.attempt_id, question_id: d.question_id, excluded: res.excluded,
      time_override_ms: res.tov === "" ? null : Math.round(+res.tov * 1000), note: res.note, reviewed: true }]);
    toast("Saved", "good"); return true;
  } catch (e) { toast(e.message, "error"); return false; }
}
