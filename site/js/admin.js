import { api } from "./api.js";
import { deriveItems, summarize, groupBy, questionStats, insights } from "./analytics.js";
import { accBar, ratioPill } from "./charts.js";
import { renderQuestion, mediaPaths, lettersFor } from "./render.js";
import { targetMs } from "./analytics.js";
import { $, $$, esc, h, fmtDur, fmtDate, pct, fmtPct, toast, modal, randomPassword, downloadCsv } from "./util.js";

const TABS = [["class", "Class"], ["cleanup", "Data clean-up"], ["students", "Students"], ["mocks", "Mocks"], ["access", "Access"], ["questions", "Questions"]];
const TEACH_TABS = [["class", "Class"], ["mocks", "Mocks"]];
const isAdm = ctx => ctx.me.role === "admin";
const P = ctx => (isAdm(ctx) ? "#/admin" : "#/teach");

function frame(root, tab, ctx, inner) {
  root.innerHTML = `<div class="page wide">
    <div class="page-head"><h1>${isAdm(ctx) ? "Admin" : "My groups"}</h1>
      <nav class="tabs">${(isAdm(ctx) ? TABS : TEACH_TABS).map(([k, l]) => `<a href="${P(ctx)}/${k}" class="${k === tab ? "on" : ""}">${l}</a>`).join("")}</nav></div>
    <div id="adminBody">${inner || `<div class="loading">Loading…</div>`}</div></div>`;
  return $("#adminBody", root);
}

let cache = null;
async function base(force) {
  if (cache && !force) return cache;
  const [profiles, groups, questions] = await Promise.all([api.profiles(), api.groups(), api.allQuestions()]);
  cache = { profiles, groups, questions, qById: Object.fromEntries(questions.map(q => [q.id, q])) };
  return cache;
}
export function clearAdminCache() { cache = null; }

async function previewQuestion(qid, extra = "") {
  const { qById } = await base();
  const q = qById[qid];
  const [urls, keys] = await Promise.all([api.mediaUrls(mediaPaths(q)), api.answerKeys([qid])]);
  await modal({ title: `${q.id} · ${q.category || "?"} ${q.subcategory || ""}`, wide: true,
    body: `<div class="paper paper-small">${renderQuestion(q, urls, { number: q.qnum, correct: keys[qid] })}</div>${extra}`,
    buttons: [{ label: "Close", value: true }] });
}

export async function showClass(root, ctx) {
  const body = frame(root, "class", ctx);
  const { profiles, groups: allGroups, qById } = await base(true);
  const groups = isAdm(ctx) ? allGroups : allGroups.filter(g => ctx.myGroups.includes(g.code));
  const { attempts, items } = await api.statsData("*");
  const all = deriveItems(attempts, items, qById);
  const L = ctx.labels;
  const students = profiles.filter(p => p.role === "student");
  if (!isAdm(ctx) && !groups.length) { body.innerHTML = `<div class="card empty"><p>No groups are assigned to your account yet. Ask the admin.</p></div>`; return; }
  let grp = "";

  function render() {
    const studs = students.filter(s => !grp || (grp === "__none" ? !s.group_code : s.group_code === grp));
    const subs = [...new Set(all.map(d => d.subcategory))].sort((a, b) => {
      const ca = all.find(d => d.subcategory === a).category, cb = all.find(d => d.subcategory === b).category;
      return ca.localeCompare(cb) || a.localeCompare(b);
    });
    const rows = studs.map(s => {
      const ds = all.filter(d => d.user_id === s.id);
      const mocks = attempts.filter(a => a.user_id === s.id && a.mode === "mock");
      const last = ds.length ? ds.reduce((m, d) => (d.attempt.started_at > m ? d.attempt.started_at : m), "") : null;
      return { s, ds, sum: summarize(ds), mocks, mockAvg: mocks.length ? Math.round(mocks.reduce((x, a) => x + pct(a.score, a.total), 0) / mocks.length) : null, last,
        bySub: Object.fromEntries([...groupBy(ds, d => d.subcategory)].map(([k, g]) => [k, summarize(g)])) };
    }).sort((a, b) => (a.s.display_name || "").localeCompare(b.s.display_name || ""));
    const cls = summarize(all.filter(d => studs.some(s => s.id === d.user_id)));

    body.innerHTML = `
      <div class="toolbar">
        <select id="grp"><option value="">All groups</option>${groups.map(g => `<option ${g.code === grp ? "selected" : ""}>${esc(g.code)}</option>`).join("")}${isAdm(ctx) ? `<option value="__none" ${grp === "__none" ? "selected" : ""}>No group (sign-ups)</option>` : ""}</select>
        <span class="muted small">${studs.length} students · ${cls.n} answers · ${fmtPct(cls.acc)} correct</span>
        <span class="grow"></span>
        ${isAdm(ctx) ? `<button class="btn btn-sm" id="csvSum">Download summary (CSV)</button>
        <button class="btn btn-sm" id="csvRaw">Download all answers (CSV)</button>` : ""}
      </div>
      <section class="card"><h2>Students</h2>
      <div class="scroll-x"><table class="tbl"><thead><tr><th>Student</th><th>Group</th><th>Mocks</th><th>Mock avg</th><th>Qs</th><th>Correct</th><th>Time vs target</th><th>Rushed</th><th>Stuck</th><th>W→R / R→W</th><th>Last active</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td><a href="#/stats/${r.s.id}"><b>${esc(r.s.display_name || r.s.username)}</b></a>${r.s.active ? "" : ' <span class="pill">disabled</span>'}</td>
        <td>${esc(r.s.group_code || "")}</td><td>${r.mocks.length || ""}</td><td>${fmtPct(r.mockAvg)}</td><td>${r.sum.n || ""}</td>
        <td>${r.sum.n ? accBar(r.sum.acc) : ""}</td><td>${r.sum.n ? ratioPill(r.sum.avgRatio) : ""}</td>
        <td>${r.sum.n ? fmtPct(pct(r.sum.rushed, r.sum.n)) : ""}</td><td>${r.sum.n ? fmtPct(pct(r.sum.stuck, r.sum.n)) : ""}</td>
        <td>${r.sum.wr || r.sum.rw ? `${r.sum.wr} / ${r.sum.rw}` : ""}</td><td class="small">${r.last ? fmtDate(r.last, false) : "never"}</td></tr>`).join("")}
      </tbody></table></div></section>
      <section class="card"><h2>Accuracy by question type</h2><p class="muted small">Cell = % correct (number of questions). Hover for average time.</p>
      <div class="scroll-x"><table class="tbl heat"><thead><tr><th>Student</th>${subs.map(k => `<th title="${esc(L[k] || k)}">${esc(k)}</th>`).join("")}</tr></thead><tbody>
      ${rows.filter(r => r.sum.n).map(r => `<tr><td><a href="#/stats/${r.s.id}">${esc(r.s.display_name || r.s.username)}</a></td>${subs.map(k => {
        const x = r.bySub[k]; if (!x) return "<td></td>";
        const hue = Math.round((x.acc / 100) * 120);
        return `<td style="background:hsl(${hue} 65% 88%)" title="${esc(L[k] || k)}: ${x.acc}% of ${x.n}, avg ${fmtDur(x.avgMs)} (${x.avgRatio.toFixed(2)}× target)">${x.acc}<small> (${x.n})</small></td>`;
      }).join("")}</tr>`).join("")}
      <tr class="total"><td>Class</td>${subs.map(k => { const x = summarize(all.filter(d => d.subcategory === k && studs.some(s => s.id === d.user_id))); return `<td>${x.n ? x.acc + "%" : ""}</td>`; }).join("")}</tr>
      </tbody></table></div></section>`;

    $("#grp", body).onchange = e => { grp = e.target.value; render(); };
    if (!isAdm(ctx)) return;
    $("#csvSum", body).onclick = () => downloadCsv("class-summary.csv", [
      ["student", "username", "group", "mocks", "mock_avg_pct", "questions", "correct_pct", "time_vs_target", "rushed", "stuck", "wrong_to_right", "right_to_wrong"],
      ...rows.map(r => [r.s.display_name, r.s.username, r.s.group_code, r.mocks.length, r.mockAvg, r.sum.n, r.sum.acc, r.sum.avgRatio?.toFixed(2), r.sum.rushed, r.sum.stuck, r.sum.wr, r.sum.rw])]);
    $("#csvRaw", body).onclick = () => {
      const pBy = Object.fromEntries(profiles.map(p => [p.id, p]));
      downloadCsv("all-answers.csv", [
        ["date", "student", "username", "mode", "title", "position", "question_id", "category", "subcategory", "answer", "correct_answer", "is_correct", "time_sec", "target_sec", "first_answer_sec", "visits", "changes", "flagged", "rushed", "stuck"],
        ...all.map(d => [d.attempt.started_at, pBy[d.user_id]?.display_name, pBy[d.user_id]?.username, d.mode, d.attempt.title, d.position, d.question_id, d.category, d.subcategory,
          d.answer, d.correct_answer, d.is_correct, (d.time_ms / 1000).toFixed(1), (d.target / 1000).toFixed(0), d.first_answer_ms != null ? (d.first_answer_ms / 1000).toFixed(1) : "",
          d.visits, d.changes, d.flagged, d.rushed, d.stuck])]);
    };
  }
  render();
}

export async function showMockResults(root, mockId, ctx, assignmentId) {
  const body = frame(root, "mocks", ctx);
  const D = await mockData(ctx, true);
  const { profiles, qById } = D;
  const mock = D.mocks.find(m => m.id === mockId);
  if (!mock) { body.innerHTML = `<p>Mock not found.</p>`; return; }
  const asg = assignmentId ? D.assigns.find(a => a.id === assignmentId) : null;
  const scope = asg ? D.studentsOf(asg) : null;
  const inScope = a => !scope || scope.some(s => s.id === a.user_id);
  const allAtt = (await api.allAttempts()).filter(a => a.mock_id === mockId && inScope(a));
  const { attempts, items } = await api.statsData("*");
  const subAtt = attempts.filter(a => a.mock_id === mockId && inScope(a));
  const adm = isAdm(ctx), pre = P(ctx);
  const keys = await api.answerKeys(mock.question_ids);
  const released = asg ? !!asg.released_at : mock.show_review;
  const hideMarks = !adm && !released && ctx.me.teacher_level !== "full";
  const skipped = D.skips.filter(k => k.mock_id === mockId && (!scope || scope.some(s => s.id === k.user_id)));
  const missing = scope ? scope.filter(s => !subAtt.some(a => a.user_id === s.id) && !allAtt.some(a => a.user_id === s.id && a.status === "in_progress") && !skipped.some(k => k.user_id === s.id)) : [];
  const back = asg ? `${pre}/mocks/${D.aState(asg) === "finished" ? "finished" : "assignments"}` : `${pre}/mocks/${mock.series_id ? "library" : "custom"}`;
  const its = items.filter(i => subAtt.some(a => a.id === i.attempt_id)).map(i => ({ ...i, correct_answer: i.correct_answer || keys[i.question_id] }));
  const ds = deriveItems(subAtt, its, qById);
  const pBy = Object.fromEntries(profiles.map(p => [p.id, p]));
  const inprog = allAtt.filter(a => a.status === "in_progress");
  const qst = Object.fromEntries(questionStats(ds).map(x => [x.qid, x]));
  const L = ctx.labels;

  body.innerHTML = `
    <p class="crumbs"><a href="${back}">Mocks</a> › ${esc(mock.title)}${asg ? " › assignment" : ""}</p>
    <div class="toolbar"><h2 class="grow">${esc(mock.title)} <span class="muted small">${mock.question_ids.length} Qs · ${fmtDur(mock.time_limit_sec * 1000, { sec: false })}</span></h2>
      ${asg ? (asg.released_at ? "" : adm ? `<button class="btn btn-sm" id="releaseA">Release answers to these students</button>` : `<span class="pill">answers not released to students yet</span>`)
        : mock.show_review ? "" : adm ? `<button class="btn btn-sm" id="release">Release answers to students</button>` : `<span class="pill">answers not released to students yet</span>`}
      ${adm ? `<a class="btn btn-sm" href="#/admin/paper/${mockId}${asg ? "/" + asg.id : ""}">Enter paper results</a>` : ""}</div>
    ${asg ? `<section class="card asg-head"><div><b>Assignment for</b> ${D.who(asg)}</div>
      <div class="small muted">${D.aState(asg) === "upcoming" ? `opens ${fmtDate(asg.opens_at)}` : `opened ${fmtDate(asg.opens_at)}`}${asg.deadline_at ? ` · deadline ${fmtDate(asg.deadline_at)}` : " · no deadline"}${asg.closed_at ? ` · closed ${fmtDate(asg.closed_at)}` : ""} · ${asg.released_at ? "answers shown to students" : asg.release_mode === "manual" ? "you release the answers" : "answers shown automatically when it closes"}</div>
      ${missing.length ? `<div class="small" style="margin-top:6px"><b>Not done yet (${missing.length}):</b> ${missing.map(s => esc(s.display_name)).join(", ")}</div>` : scope.length ? `<div class="small c-good" style="margin-top:6px">Everyone has submitted.</div>` : ""}</section>` : ""}
    ${hideMarks ? `<p class="note">Right/wrong marks are hidden until the answers are released to students.</p>` : ""}
    ${inprog.length ? `<section class="card attention"><h2>In progress (${inprog.length})</h2>${inprog.map(a => `<div class="row-item"><div>${esc(pBy[a.user_id]?.display_name || "?")} <span class="muted small">started ${fmtDate(a.started_at)}</span></div>
      ${adm ? `<button class="btn btn-sm" data-final="${a.id}">Close &amp; grade now</button>` : ""}</div>`).join("")}</section>` : ""}
    ${skipped.length ? `<p class="note">Marked done without a score (paper): ${skipped.map(k => esc(pBy[k.user_id]?.display_name || "?")).join(", ")}</p>` : ""}
    <section class="card"><h2>Results</h2>
    ${subAtt.length ? `<div class="scroll-x"><table class="tbl grid-res"><thead><tr><th>Student</th><th>Score</th><th>Time</th>${mock.question_ids.map((q, i) => `<th class="qc" title="${esc(q)}">${i + 1}</th>`).join("")}<th></th></tr></thead><tbody>
      ${subAtt.sort((a, b) => b.score - a.score).map(a => {
        const row = ds.filter(d => d.attempt_id === a.id);
        const used = row.reduce((s, d) => s + d.time_ms, 0);
        const adj = row.length !== a.total ? `<b>${row.filter(d => d.status === "correct").length}</b>/${row.length} <span class="muted small" title="Raw score ${a.score}/${a.total}; voided/excluded questions not counted">adj.</span>` : `<b>${a.score}</b>/${a.total}`;
        return `<tr class="${a.excluded ? "is-excluded" : ""}"><td><a href="#/attempt/${a.id}">${esc(pBy[a.user_id]?.display_name || "?")}</a>${a.excluded ? ' <span class="pill">not counted</span>' : ""}</td><td>${adj}</td>
          <td class="small">${a.paper ? '<span class="pill">paper</span>' : `${fmtDur(used)}${a.auto_submitted ? " ⏱" : ""}`}</td>
          ${mock.question_ids.map(qid => { const d = row.find(x => x.question_id === qid); if (!d) return "<td></td>";
            return `<td class="qc ${hideMarks ? "" : `st-${d.status}`}" title="Q${d.position}: ${d.answer || "blank"}${d.paper ? " · paper" : ` · ${fmtDur(d.time_ms)}`}${d.changes ? ` · ${d.changes} change(s)` : ""}">${d.answer || "·"}</td>`; }).join("")}
          <td>${adm ? `<button class="btn btn-ghost btn-sm" data-del="${a.id}" title="Delete this attempt (lets the student retake)">✕</button>` : ""}</td></tr>`;
      }).join("")}
      ${hideMarks ? "" : `<tr class="total"><td>% correct</td><td></td><td></td>${mock.question_ids.map(qid => `<td class="qc">${qst[qid] ? qst[qid].acc : ""}</td>`).join("")}<td></td></tr>`}
      <tr class="total"><td>avg time</td><td></td><td></td>${mock.question_ids.map(qid => `<td class="qc small">${qst[qid] ? Math.round(qst[qid].avgMs / 1000) : ""}</td>`).join("")}<td></td></tr>
      </tbody></table></div>` : `<p class="muted">Nobody has submitted this mock yet.</p>`}
    </section>
    ${subAtt.length ? `<section class="card"><h2>Questions</h2><table class="tbl"><thead><tr><th>#</th><th>Question</th><th>Type</th><th>Correct</th><th>Avg time</th><th>Answers</th><th></th></tr></thead><tbody>
      ${mock.question_ids.map((qid, i) => { const q = qById[qid] || {};
        const mine = its.filter(it => it.question_id === qid); const voided = mine.length && mine.every(it => it.excluded);
        const x = qst[qid];
        const btn = !adm ? "" : `<button class="btn btn-ghost btn-sm" data-void="${esc(qid)}" data-on="${voided ? 0 : 1}" title="${voided ? "Count this question again" : "Stop counting this question for everyone (e.g. the question itself is wrong)"}">${voided ? "Un-void" : "Void"}</button>`;
        if (!x) return voided ? `<tr class="is-excluded"><td>${i + 1}</td><td>${esc(qid)}</td><td colspan="4"><span class="pill">voided — not counted for anyone</span></td><td>${btn}</td></tr>` : "";
        return `<tr><td>${i + 1}</td><td><a href="#" data-prev="${esc(qid)}">${esc(qid)}</a></td><td class="small">${esc(L[q.subcategory] || q.subcategory || "")}</td><td>${hideMarks ? "" : accBar(x.acc)}</td><td>${fmtDur(x.avgMs)}</td>
          <td class="dist">${lettersFor(q).map(Lt => `<span class="${Lt === keys[qid] ? "key" : ""}">${Lt}:${x.dist[Lt]}</span>`).join(" ")} <span class="muted">–:${x.dist.blank}</span></td><td>${btn}</td></tr>`; }).join("")}
      </tbody></table></section>` : ""}`;

  body.onclick = async e => {
    if (!adm) { const p = e.target.closest("[data-prev]"); if (p) { e.preventDefault(); previewQuestion(p.dataset.prev); } return; }
    const vb = e.target.closest("[data-void]");
    if (vb) { await api.voidQuestion(mockId, vb.dataset.void, vb.dataset.on === "1"); toast(vb.dataset.on === "1" ? "Question voided" : "Question counted again", "good"); return showMockResults(root, mockId, ctx, assignmentId); }
    const f = e.target.closest("[data-final]"), d = e.target.closest("[data-del]"), p = e.target.closest("[data-prev]");
    if (f) { await api.adminFinalize(f.dataset.final); toast("Graded", "good"); showMockResults(root, mockId, ctx, assignmentId); }
    if (d) {
      if (await modal({ title: "Delete this attempt?", body: "<p>The student's answers for this attempt will be permanently deleted and they can take the mock again.</p>", buttons: [{ label: "Cancel", value: false }, { label: "Delete", value: true, kind: "danger" }] })) {
        await api.deleteAttempt(d.dataset.del); showMockResults(root, mockId, ctx, assignmentId);
      }
    }
    if (p) { e.preventDefault(); previewQuestion(p.dataset.prev); }
    if (e.target.id === "releaseA") {
      if (await modal({ title: "Release answers?", body: "<p>Students who took this mock through this assignment will see the correct answers in their review.</p>", buttons: [{ label: "Cancel", value: false }, { label: "Release", value: true, kind: "primary" }] })) {
        await api.releaseAssignment(asg.id); toast("Answers released", "good"); showMockResults(root, mockId, ctx, assignmentId);
      }
    }
    if (e.target.id === "release") {
      if (await modal({ title: "Release answers?", body: "<p>Students who took this mock will see the correct answers in their review.</p>", buttons: [{ label: "Cancel", value: false }, { label: "Release", value: true, kind: "primary" }] })) {
        await api.releaseReview(mockId); toast("Answers released", "good"); showMockResults(root, mockId, ctx, assignmentId);
      }
    }
  };
}

export async function showStudents(root, ctx) {
  const body = frame(root, "students", ctx);
  const { profiles, groups } = await base(true);
  const studs = profiles.filter(p => p.id !== ctx.me.id);
  const [tgs, tiers] = await Promise.all([api.teacherGroups(), api.tiers()]);
  const tierOpts = sel => tiers.map(t => `<option value="${esc(t.code)}" ${t.code === sel ? "selected" : ""}>${esc(t.label)}</option>`).join("") + `<option value="" ${sel ? "" : "selected"}>No library access</option>`;
  const levelSel = sel => `<option value="">— not set —</option>` + ctx.levels.map(l => `<option value="${l.level}" ${l.level === sel ? "selected" : ""}>${esc(l.label)}${l.extra_time_pct ? ` (+${l.extra_time_pct}% time)` : ""}</option>`).join("");
  const tgOf = id => tgs.filter(t => t.teacher_id === id).map(t => t.group_code);
  const LEVELS = { full: "Full — sees correct answers everywhere", results: "Results — sees what the student sees" };
  const levelOpts = sel => Object.entries(LEVELS).map(([k, l]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${l}</option>`).join("");
  const grpChecks = sel => groups.length ? groups.map(g => `<label class="check"><input type="checkbox" name="tgrp" value="${esc(g.code)}" ${sel.includes(g.code) ? "checked" : ""}> ${esc(g.code)}${g.label && g.label !== g.code ? ` <span class="muted small">${esc(g.label)}</span>` : ""}</label>`).join("") : `<p class="muted small">No groups yet.</p>`;
  const grpOpts = sel => `<option value="">— none —</option>` + groups.map(g => `<option ${g.code === sel ? "selected" : ""}>${esc(g.code)}</option>`).join("");

  body.innerHTML = `
    <div class="two-col">
      <form class="card form" id="addForm"><h2>Add an account</h2>
        <label>Account type<select name="kind"><option value="student">Student</option><option value="teacher">Teacher (view only)</option></select></label>
        <label>Name shown in the app<input name="display_name" required maxlength="80" placeholder="e.g. Aruzhan K."></label>
        <label>Username <span class="muted small">(what they type to log in: a–z, 0–9, . _ -)</span><input name="username" required pattern="[a-z0-9._\\-]{3,32}" autocapitalize="none" spellcheck="false" placeholder="e.g. aruzhan.k"></label>
        <label data-for="student">Group<select name="group_code">${grpOpts("")}</select></label>
        <div class="two-col" data-for="student"><label>Access tier<select name="tier">${tierOpts("full")}</select></label><label>Skill level<select name="skill_level">${levelSel(null)}</select></label></div>
        <label data-for="teacher" hidden>Teacher level<select name="level">${levelOpts("results")}</select></label>
        <fieldset data-for="teacher" hidden><legend>Groups they can see</legend>${grpChecks([])}</fieldset>
        <label>Password <span class="muted small">(generated — you can change it)</span><input name="password" required minlength="8" value="${randomPassword()}"></label>
        <button class="btn btn-primary">Create account</button>
      </form>
      <div class="card"><h2>Groups</h2>
        <table class="tbl"><tbody>${groups.map(g => `<tr><td><b>${esc(g.code)}</b></td><td>${esc(g.label)}</td><td class="small muted">${((n) => `${n} student${n === 1 ? "" : "s"}`)(studs.filter(s => s.group_code === g.code).length)}${tgs.some(t => t.group_code === g.code) ? ` · ${tgs.filter(t => t.group_code === g.code).length} teacher(s)` : ""}</td>
          <td><button class="btn btn-ghost btn-sm" data-delgroup="${esc(g.code)}">Delete</button></td></tr>`).join("")}</tbody></table>
        <form id="grpForm" class="inline-form"><input name="code" placeholder="Code, e.g. NC070" required pattern="[A-Za-z0-9_\\-]{1,32}"><input name="label" placeholder="Label (optional)"><button class="btn btn-sm">Add group</button></form>
      </div>
    </div>
    <section class="card"><div class="card-head"><h2>Accounts (${studs.length})</h2>
      <select id="accF"><option value="">Everyone</option><option value="centre">Centre (created by you)</option><option value="signup">Signed up themselves (${studs.filter(x => x.self_signup).length})</option><option value="unconfirmed">Email not confirmed (${studs.filter(x => x.self_signup && !x.confirmed).length})</option></select></div>
      <div class="scroll-x"><table class="tbl"><thead><tr><th>Name</th><th>Username</th><th>Group</th><th>Tier</th><th>Level</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>
      ${studs.map(s => `<tr data-id="${s.id}" data-kind="${s.self_signup ? (s.confirmed ? "signup" : "signup unconfirmed") : "centre"}"><td><b>${esc(s.display_name)}</b>${s.self_signup ? `<div class="small muted">${[s.email, s.signup_info?.telegram, s.signup_info?.city, s.signup_info?.school, s.signup_info?.grade ? "grade " + s.signup_info.grade : ""].filter(Boolean).map(esc).join(" · ")}${s.confirmed ? "" : ' <span class="pill pill-warn">email not confirmed</span>'} <span class="pill">signed up ${esc(fmtDate(s.created_at, false))}</span></div>` : ""}</td><td><code>${esc(s.username)}</code></td>
        <td>${s.role === "teacher" ? `<span class="small">${esc(tgOf(s.id).join(", ") || "no groups")}</span>` : s.role === "admin" ? "" : `<select data-setgroup="${s.id}">${grpOpts(s.group_code)}</select>`}</td>
        <td>${s.role === "student" ? `<select data-settier="${s.id}">${tierOpts(s.tier)}</select>` : ""}</td>
        <td>${s.role === "student" ? `<select data-setlevel="${s.id}">${levelSel(s.skill_level)}</select>` : ""}</td>
        <td>${esc(s.role)}${s.role === "teacher" ? ` <span class="pill" title="${esc(LEVELS[s.teacher_level] || "")}">${esc(s.teacher_level)}</span>` : ""}</td>
        <td>${s.active ? '<span class="pill pill-good">active</span>' : '<span class="pill">disabled</span>'}</td>
        <td class="actions">${s.role === "teacher" ? `<button class="btn btn-ghost btn-sm" data-act="teacher">Groups &amp; level</button>` : `<a class="btn btn-ghost btn-sm" href="#/stats/${s.id}">Stats</a>`}
          <button class="btn btn-ghost btn-sm" data-act="rename">Rename</button>
          <button class="btn btn-ghost btn-sm" data-act="reset">New password</button>
          <button class="btn btn-ghost btn-sm" data-act="toggle">${s.active ? "Disable" : "Enable"}</button>
          <button class="btn btn-ghost btn-sm danger" data-act="delete">Delete</button></td></tr>`).join("")}
      </tbody></table></div></section>`;

  const showCreds = (name, username, password) => modal({ title: `Login details for ${name}`,
    body: `<p>Give these to the account owner (they can change the password under “Account”). <b>This password will not be shown again.</b></p>
      <div class="creds"><div>Website: <code>${esc(location.origin + location.pathname)}</code></div><div>Username: <code>${esc(username)}</code></div><div>Password: <code>${esc(password)}</code></div></div>`,
    buttons: [{ label: "Copy", value: () => { navigator.clipboard?.writeText(`${location.origin + location.pathname}\nUsername: ${username}\nPassword: ${password}`); return true; } }, { label: "Done", value: true, kind: "primary" }] });

  $("#addForm", body).onsubmit = async e => {
    e.preventDefault(); const f = e.target; const btn = f.querySelector("button"); btn.disabled = true;
    const teacher = f.kind.value === "teacher";
    const tg = $$('[name="tgrp"]:checked', f).map(x => x.value);
    const p = { action: "create", display_name: f.display_name.value.trim(), username: f.username.value.trim().toLowerCase(), group_code: teacher ? null : f.group_code.value || null, password: f.password.value };
    let created = null;
    try {
      created = await api.adminUsers(p);
      if (teacher) await api.setTeacher(created.id, f.level.value, tg);
      else if (f.tier.value !== "full" || f.skill_level.value) await api.updateProfile(created.id, { tier: f.tier.value || null, skill_level: f.skill_level.value ? +f.skill_level.value : null });
      await showCreds(p.display_name, p.username, p.password); showStudents(root, ctx);
    } catch (err) {
      toast(created && teacher ? `The account was created, but as a student without a group (${err.message}). Delete it and try again.` : err.message, "error");
      if (created) showStudents(root, ctx); else btn.disabled = false;
    }
  };
  $("#accF", body).onchange = e => $$("tr[data-kind]", body).forEach(tr => (tr.hidden = !!e.target.value && !tr.dataset.kind.split(" ").includes(e.target.value)));
  const addF = $("#addForm", body);
  addF.kind.onchange = () => $$("[data-for]", addF).forEach(el => (el.hidden = el.dataset.for !== addF.kind.value));
  $("#grpForm", body).onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    try { await api.saveGroup({ code: f.code.value.trim(), label: f.label.value.trim() || f.code.value.trim() }); showStudents(root, ctx); } catch (err) { toast(err.message, "error"); }
  };
  body.onchange = async e => {
    const g = e.target.closest("[data-setgroup]"), t = e.target.closest("[data-settier]"), l = e.target.closest("[data-setlevel]");
    try {
      if (g) { await api.updateProfile(g.dataset.setgroup, { group_code: g.value || null }); toast("Group updated", "good"); }
      if (t) { await api.updateProfile(t.dataset.settier, { tier: t.value || null }); toast("Tier updated", "good"); }
      if (l) { await api.updateProfile(l.dataset.setlevel, { skill_level: l.value ? +l.value : null }); toast("Level updated", "good"); }
    } catch (err) { toast(err.message, "error"); }
  };
  body.onclick = async e => {
    const dg = e.target.closest("[data-delgroup]");
    if (dg) {
      if (await modal({ title: `Delete group ${dg.dataset.delgroup}?`, body: "<p>Students stay, they just won't be in a group.</p>", buttons: [{ label: "Cancel", value: false }, { label: "Delete", value: true, kind: "danger" }] })) {
        await api.deleteGroup(dg.dataset.delgroup); showStudents(root, ctx);
      }
      return;
    }
    const b = e.target.closest("[data-act]"); if (!b) return;
    const s = studs.find(x => x.id === b.closest("tr").dataset.id);
    try {
      if (b.dataset.act === "teacher") {
        const res = await modal({ title: `${s.display_name} — teacher access`,
          body: `<div class="form"><label>Teacher level<select id="tl">${levelOpts(s.teacher_level)}</select></label><fieldset id="tgf"><legend>Groups they can see</legend>${grpChecks(tgOf(s.id))}</fieldset>
            <p class="muted small">They see every student currently in these groups, with all their results. Teachers can't change anything.</p></div>`,
          buttons: [{ label: "Cancel", value: null }, { label: "Save", kind: "primary", value: box => ({ level: $("#tl", box).value, groups: $$('[name="tgrp"]:checked', box).map(x => x.value) }) }] });
        if (res) { await api.setTeacher(s.id, res.level, res.groups); toast("Saved", "good"); showStudents(root, ctx); }
      } else if (b.dataset.act === "reset") {
        const pw = randomPassword();
        if (!(await modal({ title: `New password for ${s.display_name}?`, body: "<p>The old password stops working immediately.</p>", buttons: [{ label: "Cancel", value: false }, { label: "Set new password", value: true, kind: "primary" }] }))) return;
        await api.adminUsers({ action: "reset_password", user_id: s.id, password: pw });
        await showCreds(s.display_name, s.username, pw);
      } else if (b.dataset.act === "rename") {
        const name = await modal({ title: "Rename", body: `<label>Name<input id="nn" value="${esc(s.display_name)}" maxlength="80"></label>`, buttons: [{ label: "Cancel", value: null }, { label: "Save", value: box => $("#nn", box).value.trim(), kind: "primary" }] });
        if (name) { await api.updateProfile(s.id, { display_name: name }); showStudents(root, ctx); }
      } else if (b.dataset.act === "toggle") {
        await api.adminUsers({ action: "set_active", user_id: s.id, active: !s.active }); showStudents(root, ctx);
      } else if (b.dataset.act === "delete") {
        const typed = await modal({ title: `Delete ${s.display_name}?`, body: `<p>This permanently deletes the account <b>and all of its answers and statistics</b>. It cannot be undone.</p><label>Type the username <code>${esc(s.username)}</code> to confirm<input id="cf" autocapitalize="none"></label>`,
          buttons: [{ label: "Cancel", value: null }, { label: "Delete forever", value: box => $("#cf", box).value.trim(), kind: "danger" }] });
        if (typed == null) return;
        if (typed !== s.username) return toast("Username didn't match — nothing deleted.", "warn");
        await api.adminUsers({ action: "delete", user_id: s.id }); toast("Deleted", "good"); showStudents(root, ctx);
      }
    } catch (err) { toast(err.message, "error"); }
  };
}

const SUBS = [["library", "Library"], ["assignments", "Assignments"], ["finished", "Finished"], ["custom", "Other mocks"]];
const toLocal = iso => { if (!iso) return ""; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const fromLocal = v => (v ? new Date(v).toISOString() : null);

async function mockData(ctx, force) {
  if (isAdm(ctx) || ctx.me.role === "teacher") await api.sweepAssignments().catch(() => {});
  const [b, mocks, series, assigns, targets, atts, skips] = await Promise.all([base(force), api.mocks(), api.series(), api.assignments(), api.assignmentTargets(), api.allAttempts(), api.mockSkips()]);
  const students = b.profiles.filter(p => p.role === "student");
  const groups = isAdm(ctx) ? b.groups : b.groups.filter(g => ctx.myGroups.includes(g.code));
  const tOf = a => targets.filter(t => t.assignment_id === a.id);
  const studentsOf = a => { const ts = tOf(a); return students.filter(s => s.active && ts.some(t => t.user_id === s.id || (t.group_code && t.group_code === s.group_code))); };
  const submitted = (mockId, ids) => new Set([...atts.filter(x => x.mock_id === mockId && x.status === "submitted" && ids.includes(x.user_id)).map(x => x.user_id),
    ...skips.filter(k => k.mock_id === mockId && ids.includes(k.user_id)).map(k => k.user_id)]);
  const aState = a => (a.closed_at ? "finished" : Date.parse(a.opens_at) > Date.now() ? "upcoming" : "open");
  const pBy = Object.fromEntries(b.profiles.map(p => [p.id, p]));
  const who = a => tOf(a).map(t => (t.group_code ? `<span class="pill">${esc(t.group_code)}</span>` : esc(pBy[t.user_id]?.display_name || "student"))).join(" ") || '<span class="muted">nobody</span>';
  return { ...b, mocks, series, assigns, targets, atts, skips, students, groups, tOf, studentsOf, submitted, aState, pBy, who };
}

function mockOptions(D, sel) {
  const bySeries = D.series.map(s => [s.title, D.mocks.filter(m => m.series_id === s.id).sort((a, b) => a.seq - b.seq)]).filter(x => x[1].length);
  const other = D.mocks.filter(m => !m.series_id);
  const opt = m => `<option value="${m.id}" ${m.id === sel ? "selected" : ""}>${esc(m.title)} · ${m.question_ids.length} Qs</option>`;
  return bySeries.map(([t, ms]) => `<optgroup label="${esc(t)}">${ms.map(opt).join("")}</optgroup>`).join("") + (other.length ? `<optgroup label="Other mocks">${other.map(opt).join("")}</optgroup>` : "");
}

async function assignDialog(D, pre) {
  const a = { mock_id: pre.mock_id, note: "", opens_at: new Date().toISOString(), deadline_at: null, release_mode: "auto", max_attempts: 1, groups: [], users: [], ...pre };
  const res = await modal({ title: a.id ? "Edit assignment" : "Assign a mock", wide: true,
    body: `<div class="form assign-form">
      <label>Mock<select id="am">${mockOptions(D, a.mock_id)}</select></label>
      <div class="two-col">
        <fieldset><legend>Groups</legend>${D.groups.map(g => `<label class="check"><input type="checkbox" name="ag" value="${esc(g.code)}" ${a.groups.includes(g.code) ? "checked" : ""}> ${esc(g.code)} <span class="muted small">${((n) => `${n} student${n === 1 ? "" : "s"}`)(D.students.filter(s => s.group_code === g.code && s.active).length)}</span></label>`).join("") || '<p class="muted small">No groups yet.</p>'}</fieldset>
        <fieldset><legend>Single students</legend><input id="aq" placeholder="Search name…" autocomplete="off">
          <div class="picker" id="ap">${D.students.filter(s => s.active).map(s => `<label class="check small" data-name="${esc((s.display_name + " " + s.username).toLowerCase())}"><input type="checkbox" name="au" value="${s.id}" ${a.users.includes(s.id) ? "checked" : ""}> ${esc(s.display_name)} <span class="muted">${esc(s.group_code || "no group")}</span></label>`).join("")}</div></fieldset>
      </div>
      <div class="two-col">
        <label>Opens<input id="ao" type="datetime-local" value="${toLocal(a.opens_at)}"></label>
        <label>Deadline <span class="muted small">(optional)</span><input id="ad" type="datetime-local" value="${toLocal(a.deadline_at)}"></label>
      </div>
      <fieldset><legend>Correct answers</legend>
        <label class="check"><input type="radio" name="ar" value="auto" ${a.release_mode === "auto" ? "checked" : ""}> Show automatically when it closes (deadline passed or everyone submitted)</label>
        <label class="check"><input type="radio" name="ar" value="manual" ${a.release_mode === "manual" ? "checked" : ""}> I'll release them myself</label></fieldset>
      <div class="two-col"><label>Attempts per student<input id="an" type="number" min="1" max="20" value="${a.max_attempts}"></label>
        <label>Note <span class="muted small">(only you see it)</span><input id="ax" maxlength="200" value="${esc(a.note)}"></label></div>
      <p class="muted small">An assignment opens the mock for these students even if it's locked for them in the library or not in their plan. It closes at the deadline or once everyone has submitted.</p></div>`,
    onOpen: box => { $("#aq", box).oninput = e => { const q = e.target.value.trim().toLowerCase(); $$("[data-name]", box).forEach(l => (l.hidden = q && !l.dataset.name.includes(q))); }; },
    buttons: [{ label: "Cancel", value: null }, { label: a.id ? "Save" : "Assign", kind: "primary", value: box => ({
      id: a.id, mock_id: $("#am", box).value, groups: $$('[name="ag"]:checked', box).map(x => x.value), users: $$('[name="au"]:checked', box).map(x => x.value),
      opens_at: fromLocal($("#ao", box).value) || new Date().toISOString(), deadline_at: fromLocal($("#ad", box).value),
      release_mode: $('[name="ar"]:checked', box).value, max_attempts: +$("#an", box).value || 1, note: $("#ax", box).value.trim() }) }] });
  if (!res) return false;
  if (!res.groups.length && !res.users.length) { toast("Choose at least one group or student.", "error"); return assignDialog(D, res); }
  if (res.deadline_at && Date.parse(res.deadline_at) <= Date.parse(res.opens_at)) { toast("The deadline must be after the opening time.", "error"); return assignDialog(D, res); }
  try { await api.saveAssignment(res); toast(res.id ? "Saved" : "Assigned", "good"); return true; }
  catch (err) { toast(err.message, "error"); return assignDialog(D, res); }
}

export async function showMocks(root, ctx, sub) {
  sub = SUBS.some(x => x[0] === sub) ? sub : "library";
  const body = frame(root, "mocks", ctx);
  const D = await mockData(ctx);
  const adm = isAdm(ctx), pre = P(ctx);
  let grp = sessionStorage.getItem("nuet-mocks-grp") || "";
  if (grp && !D.groups.some(g => g.code === grp)) grp = "";

  function render() {
    const pool = D.students.filter(s => s.active && (!grp || s.group_code === grp));
    const poolIds = pool.map(s => s.id);
    const inFilter = a => !grp || D.tOf(a).some(t => t.group_code === grp || pool.some(s => s.id === t.user_id));
    const head = `<div class="toolbar">
      <nav class="tabs subtabs">${SUBS.map(([k, l]) => `<a href="${pre}/mocks/${k}" class="${k === sub ? "on" : ""}">${l}${k === "assignments" ? ` <span class="count">${D.assigns.filter(a => D.aState(a) !== "finished").length}</span>` : ""}</a>`).join("")}</nav>
      <span class="grow"></span>
      <select id="grpF"><option value="">All ${adm ? "groups" : "my groups"}</option>${D.groups.map(g => `<option ${g.code === grp ? "selected" : ""}>${esc(g.code)}</option>`).join("")}</select>
      ${adm && sub !== "custom" ? `<button class="btn btn-primary" id="newA">Assign a mock</button>` : ""}
      ${adm && sub === "custom" ? `<a class="btn btn-primary" href="#/admin/mock-edit/new">New mock</a>` : ""}</div>`;
    let html = "";

    const mockRow = m => {
      const q = m.question_ids.map(id => D.qById[id]).filter(Boolean);
      const nR = q.filter(x => x.category === "R").length, nP = q.filter(x => x.category === "P").length;
      const sub_ = D.atts.filter(x => x.mock_id === m.id && x.status === "submitted" && poolIds.includes(x.user_id));
      const people = D.submitted(m.id, poolIds).size;
      const avg = sub_.length ? Math.round(sub_.reduce((t, x) => t + pct(x.score, x.total), 0) / sub_.length) : null;
      const open = D.assigns.filter(a => a.mock_id === m.id && D.aState(a) !== "finished" && inFilter(a));
      return `<tr class="${m.published ? "" : "is-dim"}"><td class="num">${m.seq ?? ""}</td><td><b>${esc(m.title)}</b>${m.published ? "" : ' <span class="pill">hidden</span>'}${open.length ? ` <span class="pill pill-warn">assigned</span>` : ""}<div class="small muted">${esc(m.description)}</div></td>
        <td class="small">${m.question_ids.length}${nR || nP ? ` <span class="muted">(${nR} R / ${nP} P)</span>` : ""}</td><td class="small">${fmtDur(m.time_limit_sec * 1000, { sec: false })}</td>
        <td>${people ? `<span class="prog sm"><span style="width:${pool.length ? Math.round(100 * people / pool.length) : 0}%"></span></span> <span class="small">${people}/${pool.length}</span>` : `<span class="muted small">0/${pool.length}</span>`}</td>
        <td>${avg == null ? "" : accBar(avg)}</td>
        <td class="actions"><a class="btn btn-sm" href="${pre}/mock/${m.id}">Results</a>${adm ? ` <button class="btn btn-ghost btn-sm" data-assign="${m.id}">Assign</button> <a class="btn btn-ghost btn-sm" href="#/admin/paper/${m.id}" title="Type in answers from a paper mock, or mark it done">Paper</a> <a class="btn btn-ghost btn-sm" href="#/admin/mock-edit/${m.id}">Edit</a>` : ""}</td></tr>`;
    };
    const mockTable = ms => `<div class="scroll-x"><table class="tbl lib-tbl"><thead><tr><th>#</th><th>Mock</th><th>Qs</th><th>Time</th><th title="Students (in the filter) who have submitted it">Done by</th><th>Avg score</th><th></th></tr></thead><tbody>${ms.map(mockRow).join("")}</tbody></table></div>`;

    if (sub === "library") {
      const groupsOfSeries = D.series.map(s => [s, D.mocks.filter(m => m.series_id === s.id).sort((a, b) => a.seq - b.seq)]).filter(x => x[1].length);
      html = groupsOfSeries.length ? groupsOfSeries.map(([s, ms], i) => {
        const doneAll = ms.filter(m => pool.length && D.submitted(m.id, poolIds).size === pool.length).length;
        return `<details class="card series-card" ${i === 0 || sessionStorage.getItem("nuet-open-" + s.id) === "1" ? "open" : ""} data-series="${esc(s.id)}">
          <summary><h2>${esc(s.title)}</h2><span class="muted small">${ms.length} mocks · ${fmtDur(ms[0].time_limit_sec * 1000, { sec: false })} each${pool.length ? ` · ${doneAll} done by everyone${grp ? " in " + esc(grp) : ""}` : ""}</span></summary>
          ${s.description ? `<p class="muted small">${esc(s.description)}</p>` : ""}${mockTable(ms)}</details>`;
      }).join("") : `<div class="card empty"><p class="muted">The library is empty. Run the library SQL (006b) in Supabase to add the Oxford mocks and problem-solving runs.</p></div>`;
    } else if (sub === "custom") {
      const ms = D.mocks.filter(m => !m.series_id);
      html = `<section class="card">${ms.length ? mockTable(ms) : `<p class="muted">No other mocks. Library mocks are under “Library”.</p>`}</section>`;
    } else {
      const want = sub === "finished" ? ["finished"] : ["open", "upcoming"];
      const list = D.assigns.filter(a => want.includes(D.aState(a)) && inFilter(a));
      const row = a => {
        const m = D.mocks.find(x => x.id === a.mock_id) || { title: "(deleted mock)", question_ids: [] };
        const studs = D.studentsOf(a).filter(s => poolIds.includes(s.id) || !grp);
        const doneN = D.submitted(a.mock_id, studs.map(s => s.id)).size;
        const st = D.aState(a);
        const when = st === "upcoming" ? `opens ${fmtDate(a.opens_at)}` : st === "finished" ? `closed ${fmtDate(a.closed_at)}` : a.deadline_at ? `due ${fmtDate(a.deadline_at)}` : "no deadline";
        const late = st === "open" && a.deadline_at && Date.parse(a.deadline_at) - Date.now() < 86400000;
        return `<tr><td><a href="${pre}/mock/${a.mock_id}/${a.id}"><b>${esc(m.title)}</b></a>${a.note && adm ? `<div class="small muted">${esc(a.note)}</div>` : ""}</td><td class="who-cell">${D.who(a)}</td>
          <td class="small">${esc(when)}${late ? ' <span class="pill pill-warn">due soon</span>' : ""}</td>
          <td><span class="prog sm"><span style="width:${studs.length ? Math.round(100 * doneN / studs.length) : 0}%"></span></span> <span class="small">${doneN}/${studs.length}</span></td>
          <td>${a.released_at ? '<span class="pill pill-good">answers shown</span>' : a.release_mode === "manual" ? '<span class="pill">you release</span>' : '<span class="pill">auto release</span>'}</td>
          <td class="actions"><a class="btn btn-sm" href="${pre}/mock/${a.mock_id}/${a.id}">Results</a>${adm ? ` <a class="btn btn-ghost btn-sm" href="#/admin/paper/${a.mock_id}/${a.id}">Paper</a>` : ""}${adm ? (st === "finished"
            ? `${a.released_at ? "" : ` <button class="btn btn-sm" data-release="${a.id}">Release answers</button>`} <button class="btn btn-ghost btn-sm danger" data-adel="${a.id}">Delete</button>`
            : ` <button class="btn btn-ghost btn-sm" data-aedit="${a.id}">Edit</button> <button class="btn btn-ghost btn-sm" data-aclose="${a.id}">Close now</button> <button class="btn btn-ghost btn-sm danger" data-adel="${a.id}">Delete</button>`) : ""}</td></tr>`;
      };
      const tbl = (title, rows) => `<section class="card"><h2>${title} <span class="muted small">(${rows.length})</span></h2>${rows.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>Mock</th><th>For</th><th>When</th><th>Submitted</th><th>Answers</th><th></th></tr></thead><tbody>${rows.map(row).join("")}</tbody></table></div>` : `<p class="muted">None.</p>`}</section>`;
      if (sub === "finished") html = tbl("Finished", list.sort((a, b) => (b.closed_at || "").localeCompare(a.closed_at || "")));
      else {
        const byDue = (a, b) => (a.deadline_at || "9").localeCompare(b.deadline_at || "9");
        html = tbl("Open now", list.filter(a => D.aState(a) === "open").sort(byDue)) + tbl("Upcoming", list.filter(a => D.aState(a) === "upcoming").sort((a, b) => a.opens_at.localeCompare(b.opens_at)));
      }
    }
    body.innerHTML = head + html;
    $("#grpF", body).onchange = e => { grp = e.target.value; try { sessionStorage.setItem("nuet-mocks-grp", grp); } catch (_) {} render(); };
    $$("details[data-series]", body).forEach(d => d.addEventListener("toggle", () => { try { sessionStorage.setItem("nuet-open-" + d.dataset.series, d.open ? "1" : "0"); } catch (_) {} }));
  }
  render();

  body.onclick = async e => {
    if (!adm) return;
    const t = e.target;
    const reload = () => showMocks(root, ctx, sub);
    try {
      if (t.closest("#newA")) { if (await assignDialog(D, { mock_id: null })) reload(); return; }
      const as = t.closest("[data-assign]");
      if (as) { if (await assignDialog(D, { mock_id: as.dataset.assign, groups: grp ? [grp] : [] })) reload(); return; }
      const ed = t.closest("[data-aedit]");
      if (ed) {
        const a = D.assigns.find(x => x.id === ed.dataset.aedit), ts = D.tOf(a);
        if (await assignDialog(D, { ...a, groups: ts.filter(x => x.group_code).map(x => x.group_code), users: ts.filter(x => x.user_id).map(x => x.user_id) })) reload();
        return;
      }
      const cl = t.closest("[data-aclose]");
      if (cl) {
        const a = D.assigns.find(x => x.id === cl.dataset.aclose);
        const r = await modal({ title: "Close this assignment now?", body: "<p>Nobody can start it any more. Students who are in the middle of it can finish.</p>",
          buttons: [{ label: "Cancel", value: null }, { label: "Close", value: "close" }, { label: "Close and show answers", value: "release", kind: "primary" }] });
        if (!r) return;
        await api.closeAssignment(a.id, r === "release"); toast("Closed", "good"); return reload();
      }
      const rl = t.closest("[data-release]");
      if (rl) { await api.releaseAssignment(rl.dataset.release); toast("Answers released", "good"); return reload(); }
      const dl = t.closest("[data-adel]");
      if (dl) {
        if (!(await modal({ title: "Delete this assignment?", body: "<p>Students' attempts and results are kept. The mock stays in the library; it just isn't assigned any more.</p>", buttons: [{ label: "Cancel", value: false }, { label: "Delete", value: true, kind: "danger" }] }))) return;
        await api.deleteAssignment(dl.dataset.adel); toast("Deleted", "good"); return reload();
      }
    } catch (err) { toast(err.message, "error"); }
  };
}

export async function showMockEdit(root, id, ctx) {
  const body = frame(root, "mocks", ctx);
  const { groups, questions, qById } = await base(true);
  const L = ctx.labels;
  const active = questions.filter(q => q.active);
  const exams = [...new Set(active.map(q => q.exam_code))].sort();
  const existing = id !== "new" ? (await api.mocks()).find(m => m.id === id) : null;
  const m = existing ? { ...existing } : { title: "", description: "", time_limit_sec: 3600, question_ids: [], group_codes: null, published: false, show_review: true, reserve_questions: true, max_attempts: 1, series_id: null, seq: null };
  const ser = m.series_id ? (await api.series()).find(x => x.id === m.series_id) : null;
  let list = [...m.question_ids];

  body.innerHTML = `
    <p class="crumbs"><a href="#/admin/mocks/${m.series_id ? "library" : "custom"}">Mocks</a> › ${existing ? "Edit" : "New mock"}</p>
    ${ser ? `<p class="note">Library mock: <b>${esc(ser.title)}</b> #${m.seq}. Students open it in order and only if their tier includes it; to give it to someone directly, use <b>Assign</b>.</p>` : ""}
    <div class="two-col">
      <form class="card form" id="mf">
        <label>Title<input name="title" required maxlength="120" value="${esc(m.title)}" placeholder="e.g. Mock 3 — October"></label>
        <label>Description (optional)<input name="description" value="${esc(m.description)}"></label>
        <label>Time limit (minutes)<input name="minutes" type="number" min="1" max="240" value="${Math.round(m.time_limit_sec / 60)}" required></label>
        <fieldset ${ser ? "hidden" : ""}><legend>Who can take it without an assignment</legend>
          <label class="check"><input type="checkbox" name="everyone" ${m.group_codes ? "" : "checked"}> Everyone with full access <span class="muted small">(not free sign-ups)</span></label>
          ${groups.map(g => `<label class="check"><input type="checkbox" name="grp" value="${esc(g.code)}" ${m.group_codes?.includes(g.code) ? "checked" : ""}> ${esc(g.code)}</label>`).join("")}
        </fieldset>
        <label>Attempts allowed per student<input name="max_attempts" type="number" min="1" max="20" value="${m.max_attempts}"></label>
        <label class="check"><input type="checkbox" name="show_review" ${m.show_review ? "checked" : ""}> Show correct answers after submitting</label>
        <label class="check"><input type="checkbox" name="reserve_questions" ${m.reserve_questions ? "checked" : ""}> Keep these questions out of Practice (so the mock stays unseen)</label>
        <label class="check"><input type="checkbox" name="published" ${m.published ? "checked" : ""}> ${ser ? "Shown in the library" : "Published (visible to the groups above)"}</label>
        <div class="btn-row"><button class="btn btn-primary" type="submit">Save</button>
          ${existing ? `<button class="btn btn-ghost danger" type="button" id="delMock">Delete mock</button>` : ""}</div>
      </form>
      <div class="card"><h2>Questions <span class="muted small" id="qcount"></span></h2>
        <div class="builder">
          <div><b>Whole paper</b><div class="inline-form"><select id="bExam">${exams.map(x => `<option>${esc(x)}</option>`).join("")}</select><button class="btn btn-sm" type="button" id="bExamGo">Use this paper</button></div></div>
          <div><b>Balanced random mix</b><div class="inline-form"><input id="bN" type="number" min="1" max="100" value="30" title="How many"> questions, <input id="bP" type="number" min="0" max="100" value="50" title="% Problem Solving">% Problem Solving
            <button class="btn btn-sm" type="button" id="bMix">Generate</button></div>
            <label class="check small"><input type="checkbox" id="bUnused" checked> avoid questions already used in other mocks</label></div>
          <div><b>Pick by hand</b><div class="inline-form"><select id="bFilterExam"><option value="">Any paper</option>${exams.map(x => `<option>${esc(x)}</option>`).join("")}</select>
            <select id="bFilterSub"><option value="">Any type</option>${[...new Set(active.map(q => q.subcategory).filter(Boolean))].sort().map(s => `<option value="${esc(s)}">${esc(L[s] || s)}</option>`).join("")}</select></div>
            <div class="picker" id="picker"></div></div>
        </div>
        <h3>Selected, in order</h3>
        <ol class="qlist" id="qlist"></ol>
      </div>
    </div>`;

  const allMocks = await api.mocks();
  const usedElsewhere = new Set(allMocks.filter(x => x.id !== m.id).flatMap(x => x.question_ids));
  const drawList = () => {
    $("#qcount", body).textContent = `(${list.length}${list.length ? `, ${list.filter(q => qById[q]?.category === "P").length} P / ${list.filter(q => qById[q]?.category === "R").length} R` : ""})`;
    $("#qlist", body).innerHTML = list.map((qid, i) => { const q = qById[qid] || {}; return `<li><a href="#" data-prev="${esc(qid)}">${esc(qid)}</a> <span class="cat cat-${esc(q.category)}">${esc(q.category || "?")}</span> <span class="small muted">${esc(L[q.subcategory] || q.subcategory || "")}</span>
      <span class="grow"></span><button type="button" class="btn btn-ghost btn-sm" data-up="${i}" ${i ? "" : "disabled"}>↑</button><button type="button" class="btn btn-ghost btn-sm" data-rm="${i}">✕</button></li>`; }).join("") || `<li class="muted">None yet — use one of the options above.</li>`;
    drawPicker();
  };
  const drawPicker = () => {
    const ex = $("#bFilterExam", body).value, sub = $("#bFilterSub", body).value;
    const cand = active.filter(q => (!ex || q.exam_code === ex) && (!sub || q.subcategory === sub));
    $("#picker", body).innerHTML = cand.slice(0, 300).map(q => `<label class="check small"><input type="checkbox" data-pick="${esc(q.id)}" ${list.includes(q.id) ? "checked" : ""}> ${esc(q.id)} <span class="cat cat-${esc(q.category)}">${esc(q.category || "?")}</span> ${esc(q.subcategory || "")}${usedElsewhere.has(q.id) ? ' <span class="muted">(in another mock)</span>' : ""}</label>`).join("");
  };
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  $("#bExamGo", body).onclick = () => { list = active.filter(q => q.exam_code === $("#bExam", body).value).sort((a, b) => a.qnum - b.qnum).map(q => q.id); drawList(); };
  $("#bMix", body).onclick = () => {
    const n = +$("#bN", body).value, nP = Math.round(n * +$("#bP", body).value / 100);
    const pool = active.filter(q => !$("#bUnused", body).checked || !usedElsewhere.has(q.id));
    const take = (cat, k) => {
      const bySub = [...groupBy(shuffle(pool.filter(q => q.category === cat)), q => q.subcategory || "?").values()];
      const out = []; while (out.length < k && bySub.some(g => g.length)) for (const g of shuffle(bySub)) { if (g.length && out.length < k) out.push(g.pop()); }
      return out;
    };
    const picked = [...take("P", nP), ...take("R", n - nP)];
    if (picked.length < n) toast(`Only ${picked.length} questions available with these settings.`, "warn");
    list = shuffle(picked).map(q => q.id); drawList();
  };
  $("#bFilterExam", body).onchange = drawPicker; $("#bFilterSub", body).onchange = drawPicker;
  body.addEventListener("change", e => {
    const p = e.target.closest("[data-pick]"); if (!p) return;
    if (p.checked && !list.includes(p.dataset.pick)) list.push(p.dataset.pick);
    if (!p.checked) list = list.filter(x => x !== p.dataset.pick);
    drawList();
  });
  body.addEventListener("click", e => {
    const up = e.target.closest("[data-up]"), rm = e.target.closest("[data-rm]"), pv = e.target.closest("[data-prev]");
    if (up) { const i = +up.dataset.up; [list[i - 1], list[i]] = [list[i], list[i - 1]]; drawList(); }
    if (rm) { list.splice(+rm.dataset.rm, 1); drawList(); }
    if (pv) { e.preventDefault(); previewQuestion(pv.dataset.prev); }
  });
  const f = $("#mf", body);
  f.everyone.onchange = () => { if (f.everyone.checked) $$('[name="grp"]', f).forEach(x => (x.checked = false)); };
  $$('[name="grp"]', f).forEach(x => (x.onchange = () => { if (x.checked) f.everyone.checked = false; }));
  f.onsubmit = async e => {
    e.preventDefault();
    if (!list.length) return toast("Add at least one question.", "error");
    const grps = $$('[name="grp"]:checked', f).map(x => x.value);
    const row = { id: m.id, series_id: m.series_id, seq: m.seq, title: f.title.value.trim(), description: f.description.value.trim(), time_limit_sec: Math.round(+f.minutes.value * 60),
      question_ids: list, group_codes: f.everyone.checked || !grps.length ? null : grps, published: f.published.checked,
      show_review: f.show_review.checked, reserve_questions: f.reserve_questions.checked, max_attempts: +f.max_attempts.value || 1 };
    try { await api.saveMock(row); toast("Saved", "good"); ctx.go(`#/admin/mocks/${m.series_id ? "library" : "custom"}`); } catch (err) { toast(err.message, "error"); }
  };
  $("#delMock", body)?.addEventListener("click", async () => {
    if (await modal({ title: "Delete this mock?", body: "<p>Students' past attempts and statistics are kept; the mock itself disappears.</p>", buttons: [{ label: "Cancel", value: false }, { label: "Delete", value: true, kind: "danger" }] })) {
      await api.deleteMock(m.id); ctx.go(`#/admin/mocks/${m.series_id ? "library" : "custom"}`);
    }
  });
  drawList();
}

export async function showQuestions(root, ctx) {
  const body = frame(root, "questions", ctx);
  const { questions, qById } = await base(true);
  const { attempts, items } = await api.statsData("*");
  const keys = await api.answerKeys(null);
  const ds = deriveItems(attempts, items.map(i => ({ ...i, correct_answer: i.correct_answer || keys[i.question_id] })), qById);
  const st = Object.fromEntries(questionStats(ds).map(x => [x.qid, x]));
  const reports = (await api.reports()).filter(r => r.status === "open");
  const repN = qid => reports.filter(r => r.question_id === qid).length;
  const keyDoubt = qid => { const x = st[qid], k = keys[qid]; if (!x || x.n < 4 || !k) return false;
    return lettersFor(qById[qid]).some(l => l !== k && x.dist[l] > x.dist[k] && x.dist[l] >= 3); };
  const mocks = await api.mocks();
  const inMock = qid => mocks.filter(m => m.question_ids.includes(qid)).map(m => m.title);
  const L = ctx.labels;
  const exams = [...new Set(questions.map(q => q.exam_code))].sort();
  let fx = "", fc = "", sort = "id";

  function render() {
    let qs = questions.filter(q => (!fx || q.exam_code === fx) && (!fc || q.category === fc || q.subcategory === fc));
    if (sort === "acc") qs = qs.sort((a, b) => (st[a.id]?.acc ?? 101) - (st[b.id]?.acc ?? 101));
    if (sort === "doubt") qs = qs.sort((a, b) => (keyDoubt(b.id) * 10 + repN(b.id)) - (keyDoubt(a.id) * 10 + repN(a.id)));
    if (sort === "time") qs = qs.sort((a, b) => (st[b.id]?.avgMs ?? -1) - (st[a.id]?.avgMs ?? -1));
    $("#qb", body).innerHTML = qs.map(q => { const x = st[q.id]; const ms = inMock(q.id);
      return `<tr><td><a href="#" data-prev="${esc(q.id)}">${esc(q.id)}</a>${q.active ? "" : ' <span class="pill">inactive</span>'}${keyDoubt(q.id) ? ' <span class="pill pill-bad" title="A wrong option is chosen more often than the key — check the answer key">check key?</span>' : ""}${repN(q.id) ? ` <a class="pill pill-warn" href="#/admin/cleanup">${repN(q.id)} report(s)</a>` : ""}</td><td><span class="cat cat-${esc(q.category)}">${esc(q.category || "?")}</span> <span class="small">${esc(L[q.subcategory] || q.subcategory || "")}</span></td>
        <td class="small">${esc((q.skills || []).join(", "))}</td><td>${keys[q.id] || ""}</td><td>${x ? x.n : ""}</td><td>${x ? accBar(x.acc) : ""}</td><td>${x ? fmtDur(x.avgMs) : ""}</td>
        <td class="small muted">${esc(ms.join(", "))}</td></tr>`; }).join("");
    $("#qn", body).textContent = `${qs.length} questions`;
  }
  body.innerHTML = `<div class="toolbar">
      <select id="fx"><option value="">All papers</option>${exams.map(x => `<option>${esc(x)}</option>`).join("")}</select>
      <select id="fc"><option value="">All types</option><option value="P">P — Problem Solving</option><option value="R">R — Critical Thinking</option>
        ${[...new Set(questions.map(q => q.subcategory).filter(Boolean))].sort().map(s => `<option value="${esc(s)}">${esc(L[s] || s)}</option>`).join("")}</select>
      <select id="fs"><option value="id">Sort by ID</option><option value="acc">Hardest first</option><option value="time">Slowest first</option><option value="doubt">Problems first</option></select>
      <span class="muted small" id="qn"></span></div>
    <p class="muted small">Questions are added and edited in tsa-app, then uploaded with the importer. Only verified questions are uploaded.</p>
    <section class="card"><div class="scroll-x"><table class="tbl"><thead><tr><th>ID</th><th>Type</th><th>Skills</th><th>Key</th><th>Answered</th><th>Correct</th><th>Avg time</th><th>In mocks</th></tr></thead><tbody id="qb"></tbody></table></div></section>`;
  $("#fx", body).onchange = e => { fx = e.target.value; render(); };
  $("#fc", body).onchange = e => { fc = e.target.value; render(); };
  $("#fs", body).onchange = e => { sort = e.target.value; render(); };
  body.onclick = e => { const p = e.target.closest("[data-prev]"); if (p) { e.preventDefault();
    const x = st[p.dataset.prev];
    previewQuestion(p.dataset.prev, x ? `<p class="small muted">Answered ${x.n}× · ${x.acc}% correct · avg ${fmtDur(x.avgMs)} · answers ${lettersFor(qById[p.dataset.prev]).map(l => `${l}:${x.dist[l]}`).join(" ")} blank:${x.dist.blank}</p>` : "");
  } };
  render();
}

const INSTANT_MS = 3000;
const LONG_FACTOR = 4;
const AWAY_MS = 60000;

function awayMs(events) {
  let t = 0, h = null;
  for (const e of events || []) { if (e.e === "hide") h = e.t; else if (e.e === "show" && h != null) { t += e.t - h; h = null; } }
  return t;
}

export async function showCleanup(root, ctx) {
  const body = frame(root, "cleanup", ctx);
  const { profiles, qById } = await base(true);
  const pBy = Object.fromEntries(profiles.map(p => [p.id, p]));
  const [{ attempts, items }, allAtt, reports] = await Promise.all([api.statsData("*"), api.allAttempts(), api.reports()]);
  const aBy = Object.fromEntries(attempts.map(a => [a.id, a]));
  const L = ctx.labels;
  let who = "", showHandled = false, showReports = "open";

  const flagged = [];
  for (const it of items) {
    const a = aBy[it.attempt_id]; if (!a || a.paper || (a.mode === "practice" && !it.locked)) continue;
    const tgt = targetMs(a), reasons = [];
    let suggest = "exclude";
    if (it.answer && it.time_ms < INSTANT_MS) reasons.push(`answered after only ${(it.time_ms / 1000).toFixed(1)} s — misclick?`);
    if (it.time_ms > tgt * LONG_FACTOR) { reasons.push(`very long: ${fmtDur(it.time_ms)} (target ${fmtDur(tgt)}) — left open?`); suggest = "cap"; }
    const aw = awayMs(it.events);
    if (aw > AWAY_MS) reasons.push(`was on another tab/app for ${fmtDur(aw)} during this question`);
    if (!reasons.length) continue;
    flagged.push({ it, a, tgt, reasons, suggest, handled: it.reviewed || it.excluded || it.time_override_ms != null || a.excluded });
  }
  flagged.sort((x, y) => y.a.started_at.localeCompare(x.a.started_at) || x.it.position - y.it.position);
  const stale = allAtt.filter(a => a.status === "in_progress" && Date.now() - Date.parse(a.started_at) > 12 * 3600000);

  function render() {
    const rows = flagged.filter(f => (!who || f.a.user_id === who) && (showHandled || !f.handled));
    const reps = reports.filter(r => showReports === "all" || r.status === "open");
    body.innerHTML = `
      <p class="muted small">Nothing here is deleted: “don't count” and corrected times only change the statistics, and can be undone any time from the attempt's page (Edit).</p>
      <section class="card"><div class="card-head"><h2>Problem reports from students (${reports.filter(r => r.status === "open").length} open)</h2>
        <select id="repF"><option value="open" ${showReports === "open" ? "selected" : ""}>Open</option><option value="all" ${showReports === "all" ? "selected" : ""}>All</option></select></div>
        ${reps.length ? `<table class="tbl"><thead><tr><th>Date</th><th>Student</th><th>Question</th><th>Message</th><th>Status</th><th></th></tr></thead><tbody>
        ${reps.map(r => `<tr><td class="small">${fmtDate(r.created_at)}</td><td>${esc(pBy[r.user_id]?.display_name || "?")}</td>
          <td><a href="#" data-prev="${esc(r.question_id)}">${esc(r.question_id)}</a></td><td>${esc(r.message)}</td><td><span class="pill ${r.status === "open" ? "pill-warn" : ""}">${r.status}</span></td>
          <td class="actions">${r.status === "open" ? `<button class="btn btn-sm" data-rep="${r.id}" data-st="resolved">Fixed</button> <button class="btn btn-ghost btn-sm" data-rep="${r.id}" data-st="dismissed">Dismiss</button>` : `<button class="btn btn-ghost btn-sm" data-rep="${r.id}" data-st="open">Reopen</button>`}</td></tr>`).join("")}
        </tbody></table><p class="muted small">Fix the question in tsa-app, run the importer, then mark the report as fixed.</p>` : `<p class="muted">No reports.</p>`}
      </section>

      <section class="card"><div class="card-head"><h2>Suspicious answers (${rows.length})</h2>
        <div class="filters"><select id="who"><option value="">All students</option>${profiles.filter(p => p.role === "student").map(p => `<option value="${p.id}" ${p.id === who ? "selected" : ""}>${esc(p.display_name)}</option>`).join("")}</select>
        <label class="check small"><input type="checkbox" id="handled" ${showHandled ? "checked" : ""}> show already handled</label></div></div>
        <p class="muted small">Found automatically: answered in under ${INSTANT_MS / 1000} s, took over ${LONG_FACTOR}× the target time, or the student switched away for over a minute. Time with no activity for ${ctx.idleSec || 180} s is already left out automatically.</p>
        ${rows.length ? `<div class="toolbar">
          <label class="check small"><input type="checkbox" id="all"> select all</label>
          <button class="btn btn-sm" data-bulk="exclude">Don't count selected</button>
          <button class="btn btn-sm" data-bulk="cap">Cap time at 2× target</button>
          <button class="btn btn-sm" data-bulk="ok">Looks fine — hide</button></div>
        <div class="scroll-x"><table class="tbl"><thead><tr><th></th><th>Student</th><th>Date</th><th>Session</th><th>Q</th><th>Type</th><th>Result</th><th>Time</th><th>Why flagged</th><th></th></tr></thead><tbody>
        ${rows.map((f, i) => { const q = qById[f.it.question_id] || {}; const st = f.it.is_correct ? "correct" : f.it.answer ? "wrong" : "blank";
          return `<tr class="${f.it.excluded || f.a.excluded ? "is-excluded" : ""}"><td><input type="checkbox" data-i="${flagged.indexOf(f)}"></td>
          <td>${esc(pBy[f.a.user_id]?.display_name || "?")}</td><td class="small">${fmtDate(f.a.started_at)}</td>
          <td class="small"><a href="#/attempt/${f.a.id}">${esc(f.a.title)}</a></td><td>${f.it.position}</td>
          <td class="small">${esc(L[q.subcategory] || q.subcategory || q.category || "")}</td><td><span class="ans ans-${st}">${esc(f.it.answer || "—")}</span></td>
          <td>${fmtDur(f.it.time_ms)}${f.it.time_override_ms != null ? ` → ${fmtDur(f.it.time_override_ms)}` : ""}</td>
          <td class="small">${f.reasons.map(esc).join("<br>")}${f.it.excluded ? ' <span class="pill">not counted</span>' : ""}</td>
          <td><button class="btn btn-ghost btn-sm" data-one="${flagged.indexOf(f)}">Edit</button></td></tr>`; }).join("")}
        </tbody></table></div>` : `<p class="muted">Nothing suspicious${showHandled ? "" : " left to review"}.</p>`}
      </section>

      <section class="card"><h2>Unfinished sessions older than 12 hours (${stale.length})</h2>
        <p class="muted small">Started but never finished. They are not counted in statistics. Practice sessions can simply be deleted.</p>
        ${stale.length ? `<table class="tbl"><tbody>${stale.map(a => `<tr><td>${esc(pBy[a.user_id]?.display_name || "?")}</td><td>${a.mode}</td><td>${esc(a.title)}</td><td class="small">${fmtDate(a.started_at)}</td>
          <td class="actions">${a.mode === "mock" ? `<button class="btn btn-sm" data-close="${a.id}">Close &amp; grade</button> ` : ""}<button class="btn btn-ghost btn-sm danger" data-del="${a.id}">Delete</button></td></tr>`).join("")}</tbody></table>
          ${stale.some(a => a.mode === "practice") ? `<button class="btn btn-sm" id="delAllPractice">Delete all unfinished practice sessions</button>` : ""}` : `<p class="muted">None.</p>`}
      </section>`;

    $("#who", body)?.addEventListener("change", e => { who = e.target.value; render(); });
    $("#handled", body)?.addEventListener("change", e => { showHandled = e.target.checked; render(); });
    $("#repF", body)?.addEventListener("change", e => { showReports = e.target.value; render(); });
    $("#all", body)?.addEventListener("change", e => $$("[data-i]", body).forEach(c => (c.checked = e.target.checked)));
  }

  body.onclick = async e => {
    const t = e.target;
    const prev = t.closest("[data-prev]");
    if (prev) { e.preventDefault(); return previewQuestion(prev.dataset.prev); }
    const rp = t.closest("[data-rep]");
    if (rp) { await api.setReportStatus(+rp.dataset.rep, rp.dataset.st); reports.find(r => r.id === +rp.dataset.rep).status = rp.dataset.st; return render(); }
    const one = t.closest("[data-one]");
    if (one) {
      const f = flagged[+one.dataset.one];
      const d = { ...f.it, raw_time_ms: f.it.time_ms, time_ms: f.it.time_override_ms ?? f.it.time_ms, isExcluded: f.it.excluded, note: f.it.admin_note, overridden: f.it.time_override_ms != null };
      if (await (await import("./results.js")).editItemDialog(d, f.tgt)) return showCleanup(root, ctx);
      return;
    }
    const bulk = t.closest("[data-bulk]");
    if (bulk) {
      const sel = $$("[data-i]:checked", body).map(c => flagged[+c.dataset.i]);
      if (!sel.length) return toast("Select some rows first", "warn");
      const kind = bulk.dataset.bulk;
      const list = sel.map(f => ({ attempt_id: f.a.id, question_id: f.it.question_id, reviewed: true,
        ...(kind === "exclude" ? { excluded: true, note: "not counted: " + f.reasons[0].split(" —")[0] } : {}),
        ...(kind === "cap" ? { time_override_ms: Math.round(Math.min(f.it.time_ms, 2 * f.tgt)), note: "time capped (left open)" } : {}) }));
      await api.adminUpdateItems(list); toast(`Updated ${list.length}`, "good"); return showCleanup(root, ctx);
    }
    const del = t.closest("[data-del]"), cl = t.closest("[data-close]");
    if (cl) { await api.adminFinalize(cl.dataset.close); return showCleanup(root, ctx); }
    if (del) { await api.deleteAttempt(del.dataset.del); return showCleanup(root, ctx); }
    if (t.id === "delAllPractice") {
      const ps = stale.filter(a => a.mode === "practice");
      if (!(await modal({ title: `Delete ${ps.length} unfinished practice sessions?`, body: "<p>They were never finished and aren't in any statistics.</p>", buttons: [{ label: "Cancel", value: false }, { label: "Delete", value: true, kind: "danger" }] }))) return;
      for (const a of ps) await api.deleteAttempt(a.id);
      return showCleanup(root, ctx);
    }
  };
  render();
}

export async function showAccess(root, ctx) {
  const body = frame(root, "access", ctx);
  const [{ profiles, groups }, tiers, levels, series, mocks] = await Promise.all([base(true), api.tiers(), api.skillLevels(), api.series(), api.mocks()]);
  const studs = profiles.filter(p => p.role === "student");
  const count = (s) => mocks.filter(m => m.series_id === s.id).length;
  body.innerHTML = `
    <section class="card"><h2>Access tiers</h2>
      <p class="muted small">A plan (tier) decides how many mocks of each library series a student can open: the first N, in order. Mocks you assign directly don't count. “Unlimited” opens everything. Students see the name and description at the top of every page; people who sign up themselves get the plan marked under “Sign-ups”.</p>
      <div class="scroll-x"><table class="tbl tier-tbl"><thead><tr><th>Code</th><th>Name &amp; description <span class="muted">(students see these)</span></th><th title="People who sign up themselves get this plan">Sign-ups</th><th>Unlimited</th>${series.map(s => `<th>${esc(s.title)} <span class="muted">/ ${count(s)}</span></th>`).join("")}<th>Students</th><th></th></tr></thead><tbody>
      ${tiers.map(t => `<tr data-tier="${esc(t.code)}"><td><code>${esc(t.code)}</code></td><td><input name="label" value="${esc(t.label)}" maxlength="60"><textarea name="desc" rows="2" maxlength="400" placeholder="What this plan includes">${esc(t.description || "")}</textarea></td>
        <td><input type="radio" name="signupDefault" value="${esc(t.code)}" ${t.signup_default ? "checked" : ""}></td>
        <td><input type="checkbox" name="unlimited" ${t.unlimited ? "checked" : ""}></td>
        ${series.map(s => `<td><input type="number" min="0" max="${count(s)}" name="lim" data-s="${esc(s.id)}" value="${t.unlimited ? "" : Number(t.limits?.[s.id] ?? 0)}" placeholder="all" ${t.unlimited ? "disabled" : ""}></td>`).join("")}
        <td>${studs.filter(x => x.tier === t.code).length}</td>
        <td class="actions"><button class="btn btn-sm" data-savetier>Save</button>${t.code === "full" ? "" : ` <button class="btn btn-ghost btn-sm danger" data-deltier>Delete</button>`}</td></tr>`).join("")}
      </tbody></table></div>
      <form id="newTier" class="inline-form"><input name="code" placeholder="code, e.g. basic" required pattern="[a-z0-9_\\-]{1,32}"><input name="label" placeholder="Name, e.g. Basic" required maxlength="60"><button class="btn btn-sm">Add tier</button></form>
    </section>
    <section class="card"><h2>Skill levels</h2>
      <p class="muted small">You set a student's level by hand (Students tab). Extra time is added to every mock and run they start; the home page suggests a next step that fits the level.</p>
      <table class="tbl"><thead><tr><th>Level</th><th>Name</th><th>Extra time</th><th>Students</th><th></th></tr></thead><tbody>
      ${levels.map(l => `<tr data-level="${l.level}"><td>${l.level}</td><td><input name="label" value="${esc(l.label)}" maxlength="40"></td>
        <td><input type="number" name="pct" min="0" max="100" value="${l.extra_time_pct}"> %</td><td>${studs.filter(x => x.skill_level === l.level).length}</td>
        <td class="actions"><button class="btn btn-sm" data-savelevel>Save</button></td></tr>`).join("")}</tbody></table>
    </section>
    <section class="card"><h2>Set for a whole group</h2>
      <form id="bulk" class="inline-form"><select name="g" required><option value="">Group…</option>${groups.map(g => `<option>${esc(g.code)}</option>`).join("")}</select>
        <select name="t"><option value="-">tier: keep</option>${tiers.map(t => `<option value="${esc(t.code)}">tier: ${esc(t.label)}</option>`).join("")}</select>
        <select name="l"><option value="-">level: keep</option><option value="">level: not set</option>${levels.map(l => `<option value="${l.level}">level: ${esc(l.label)}</option>`).join("")}</select>
        <button class="btn btn-sm">Apply</button></form>
    </section>`;

  body.addEventListener("change", e => {
    if (e.target.name === "signupDefault") {
      (async () => { try { for (const t of tiers.filter(x => x.signup_default && x.code !== e.target.value)) await api.updateTier(t.code, { signup_default: false });
        await api.updateTier(e.target.value, { signup_default: true }); ctx.tiers = await api.tiers(); toast("People who sign up now get this plan", "good"); } catch (err) { toast(err.message, "error"); } })();
    }
    if (e.target.name === "unlimited") e.target.closest("tr").querySelectorAll('[name="lim"]').forEach(x => { x.disabled = e.target.checked; if (!x.disabled && x.value === "") x.value = 0; });
  });
  body.onclick = async e => {
    const st = e.target.closest("[data-savetier]"), dt = e.target.closest("[data-deltier]"), sl = e.target.closest("[data-savelevel]");
    try {
      if (st) {
        const tr = st.closest("tr");
        const limits = Object.fromEntries($$('[name="lim"]', tr).map(x => [x.dataset.s, Math.max(0, Math.floor(+x.value || 0))]));
        await api.saveTier({ code: tr.dataset.tier, label: $('[name="label"]', tr).value.trim() || tr.dataset.tier, description: $('[name="desc"]', tr).value.trim(), unlimited: $('[name="unlimited"]', tr).checked, limits });
        ctx.tiers = await api.tiers();
        toast("Tier saved", "good");
      }
      if (dt) {
        const code = dt.closest("tr").dataset.tier, n = studs.filter(x => x.tier === code).length;
        if (!(await modal({ title: `Delete tier “${code}”?`, body: `<p>${n ? `${n} student(s) on this tier will have no library access until you give them another tier.` : "No students are on this tier."}</p>`, buttons: [{ label: "Cancel", value: false }, { label: "Delete", value: true, kind: "danger" }] }))) return;
        await api.deleteTier(code); return showAccess(root, ctx);
      }
      if (sl) {
        const tr = sl.closest("tr");
        await api.saveSkillLevel({ level: +tr.dataset.level, label: $('[name="label"]', tr).value.trim() || "Level " + tr.dataset.level, extra_time_pct: Math.max(0, Math.min(100, +$('[name="pct"]', tr).value || 0)) });
        ctx.levels = await api.skillLevels(); toast("Level saved", "good");
      }
    } catch (err) { toast(err.message, "error"); }
  };
  $("#newTier", body).onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    try { await api.saveTier({ code: f.code.value.trim(), label: f.label.value.trim(), unlimited: false, limits: {}, sort: tiers.length }); showAccess(root, ctx); } catch (err) { toast(err.message, "error"); }
  };
  $("#bulk", body).onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    const who = studs.filter(x => x.group_code === f.g.value);
    const patch = {};
    if (f.t.value !== "-") patch.tier = f.t.value;
    if (f.l.value !== "-") patch.skill_level = f.l.value ? +f.l.value : null;
    if (!Object.keys(patch).length) return toast("Choose a tier or a level to set.", "warn");
    if (!(await modal({ title: `Update ${who.length} student(s) in ${f.g.value}?`, body: "<p>New students added to the group later keep their own settings.</p>", buttons: [{ label: "Cancel", value: false }, { label: "Apply", value: true, kind: "primary" }] }))) return;
    try { for (const x of who) await api.updateProfile(x.id, patch); toast(`Updated ${who.length}`, "good"); showAccess(root, ctx); } catch (err) { toast(err.message, "error"); }
  };
}

export async function showPaper(root, ctx, mockId, assignmentId) {
  const body = frame(root, "mocks", ctx);
  const D = await mockData(ctx, true);
  const m = D.mocks.find(x => x.id === mockId);
  if (!m) { body.innerHTML = `<p>Mock not found.</p>`; return; }
  const asg = assignmentId ? D.assigns.find(a => a.id === assignmentId) : null;
  const qs = m.question_ids.map(id => D.qById[id]).filter(q => q && q.active);
  const n = qs.length;
  const keys = await api.answerKeys(qs.map(q => q.id));
  const paperAtts = D.atts.filter(a => a.mock_id === m.id && a.paper);
  const paperItems = paperAtts.length ? await api.itemsFor(paperAtts.map(a => a.id)) : [];
  const allowed = q => (q.n_options === 4 ? "ABCD" : "ABCDE");
  let grp = asg ? "" : sessionStorage.getItem("nuet-mocks-grp") ?? D.groups[0]?.code ?? "";
  let showKey = sessionStorage.getItem("nuet-paper-key") !== "0";
  let date = new Date().toISOString().slice(0, 10);
  const back = asg ? `#/admin/mock/${m.id}/${asg.id}` : `#/admin/mock/${m.id}`;

  const scopeStudents = () => (asg ? D.studentsOf(asg) : D.students.filter(s => s.active && (!grp || s.group_code === grp)))
    .sort((a, b) => (a.display_name || "").localeCompare(b.display_name || ""));
  const savedOf = sid => {
    const a = paperAtts.find(x => x.user_id === sid);
    if (!a) return null;
    const arr = Array(n).fill("");
    paperItems.filter(i => i.attempt_id === a.id).forEach(i => { if (i.position <= n) arr[i.position - 1] = i.answer || ""; });
    return { a, arr };
  };

  function rowHtml(s) {
    const online = D.atts.find(a => a.user_id === s.id && a.mock_id === m.id && !a.paper);
    const skip = D.skips.some(k => k.user_id === s.id && k.mock_id === m.id);
    const saved = savedOf(s.id);
    const name = `<td class="pg-name"><b>${esc(s.display_name || s.username)}</b><div class="small muted">${esc(s.group_code || "")}</div></td>`;
    if (online) return `<tr data-sid="${s.id}" class="pg-online">${name}<td colspan="${n}" class="muted small">took it online${online.status === "submitted" ? ` — ${online.score}/${online.total} · <a href="#/attempt/${online.id}">review</a>` : " (in progress)"}</td><td></td><td></td></tr>`;
    const vals = saved ? saved.arr : Array(n).fill("");
    return `<tr data-sid="${s.id}" data-saved="${esc(vals.join(","))}">${name}
      ${qs.map((q, i) => `<td class="pg-c"><input class="pc" data-i="${i}" maxlength="1" value="${esc(vals[i])}" aria-label="${esc(s.display_name)} question ${i + 1}" autocomplete="off" spellcheck="false"></td>`).join("")}
      <td class="pg-score"></td>
      <td class="pg-act">${saved ? `<span class="pill pill-good" title="${esc(fmtDate(saved.a.started_at, false))}">saved</span>` : skip ? '<span class="pill">marked done</span>' : ""}
        <button class="btn btn-sm" data-save hidden>Save</button>
        ${saved ? `<button class="btn btn-ghost btn-sm danger" data-delp="${saved.a.id}" title="Delete this paper result">✕</button>` : skip ? `<button class="btn btn-ghost btn-sm" data-unskip>Undo done</button>` : `<button class="btn btn-ghost btn-sm" data-skip title="Counts as done without a score">Mark done</button>`}</td></tr>`;
  }

  function render() {
    const studs = scopeStudents();
    body.innerHTML = `
      <p class="crumbs"><a href="${P(ctx)}/mocks/${asg ? "assignments" : m.series_id ? "library" : "custom"}">Mocks</a> › <a href="${back}">${esc(m.title)}</a> › paper results</p>
      <div class="toolbar"><h2 class="grow">Paper results: ${esc(m.title)} <span class="muted small">${n} questions</span></h2>
        ${asg ? `<span class="small">Assignment for ${D.who(asg)}</span>` : `<select id="pgGrp"><option value="">All students</option>${D.groups.map(g => `<option ${g.code === grp ? "selected" : ""}>${esc(g.code)}</option>`).join("")}</select>`}
        <label class="small inline-form">Date of the paper mock <input type="date" id="pgDate" value="${date}"></label>
        <label class="check small"><input type="checkbox" id="pgKey" ${showKey ? "checked" : ""}> show key</label></div>
      <p class="muted small">Type each student's letters: the cursor moves on by itself. <kbd>-</kbd> or <kbd>space</kbd> = left blank, <kbd>⌫</kbd> = back, arrows move, <kbd>return</kbd> = next student. You can paste a whole row (e.g. <code>ACBD-EA…</code>) into the first box. Paper results count in scores and question stats, never in timing. “Mark done” = did it on paper but you have no answers: it counts as done, with no score.</p>
      <section class="card pg-card"><div class="scroll-x"><table class="tbl pg-grid ${showKey ? "show-key" : ""}">
        <thead><tr><th>Student</th>${qs.map((q, i) => `<th class="pg-h" title="${esc(q.id)}">${i + 1}<div class="cat cat-${esc(q.category)}">${esc(q.category || "?")}</div></th>`).join("")}<th>Score</th><th></th></tr>
        ${showKey ? `<tr class="pg-keyrow"><td class="small muted">key</td>${qs.map(q => `<td>${esc(keys[q.id] || "?")}</td>`).join("")}<td></td><td></td></tr>` : ""}</thead>
        <tbody>${studs.map(rowHtml).join("") || `<tr><td colspan="${n + 3}" class="muted">No students here.</td></tr>`}</tbody></table></div>
        <div class="toolbar pg-foot"><button class="btn btn-primary" id="pgSaveAll" disabled>Save changed rows</button>
          <button class="btn" id="pgDoneRest">Mark everyone without a result as done</button><span class="grow"></span><span class="muted small" id="pgInfo"></span></div>
      </section>`;
    $$("tbody tr[data-saved]", body).forEach(refresh);
    updateInfo();
  }

  const cells = tr => $$(".pc", tr);
  function refresh(tr) {
    const vals = cells(tr).map(c => c.value.toUpperCase());
    let right = 0, typed = 0;
    cells(tr).forEach((c, i) => {
      const v = vals[i], k = keys[qs[i].id];
      c.classList.toggle("ok", showKey && !!v && v === k);
      c.classList.toggle("bad", showKey && !!v && !!k && v !== k);
      if (v) typed++; if (v && v === k) right++;
    });
    const dirty = vals.join(",") !== tr.dataset.saved;
    tr.classList.toggle("is-dirty", dirty);
    $("[data-save]", tr).hidden = !dirty;
    $(".pg-score", tr).innerHTML = typed ? `<b>${right}</b>/${n}` : "";
  }
  function updateInfo() {
    const d = $$("tbody tr.is-dirty", body).length;
    $("#pgSaveAll", body).disabled = !d;
    $("#pgInfo", body).textContent = d ? `${d} row${d === 1 ? "" : "s"} not saved yet` : "";
  }
  const focusCell = (tr, i) => { const c = tr && cells(tr)[Math.max(0, Math.min(n - 1, i))]; if (c) { c.focus(); c.select(); } };
  const rowsWithCells = () => $$("tbody tr[data-saved]", body);
  const nextRow = (tr, dir) => { const rs = rowsWithCells(); return rs[rs.indexOf(tr) + dir]; };

  body.addEventListener("keydown", e => {
    const c = e.target.closest(".pc"); if (!c || e.metaKey || e.ctrlKey || e.altKey) return;
    const tr = c.closest("tr"), i = +c.dataset.i, k = e.key;
    if (/^[a-z]$/i.test(k)) {
      e.preventDefault();
      const L = k.toUpperCase();
      if (!allowed(qs[i]).includes(L)) { c.classList.add("flash"); setTimeout(() => c.classList.remove("flash"), 300); return; }
      c.value = L; refresh(tr); updateInfo();
      if (i < n - 1) focusCell(tr, i + 1); else focusCell(nextRow(tr, 1), 0);
    } else if (k === "-" || k === " " || k === "." || k === "0") {
      e.preventDefault(); c.value = ""; refresh(tr); updateInfo(); if (i < n - 1) focusCell(tr, i + 1); else focusCell(nextRow(tr, 1), 0);
    } else if (k === "Backspace") {
      e.preventDefault();
      if (c.value) { c.value = ""; } else if (i > 0) { const p = cells(tr)[i - 1]; p.value = ""; p.focus(); }
      refresh(tr); updateInfo();
    } else if (k === "ArrowRight") { e.preventDefault(); focusCell(tr, i + 1); }
    else if (k === "ArrowLeft") { e.preventDefault(); focusCell(tr, i - 1); }
    else if (k === "ArrowDown") { e.preventDefault(); focusCell(nextRow(tr, 1), i); }
    else if (k === "ArrowUp") { e.preventDefault(); focusCell(nextRow(tr, -1), i); }
    else if (k === "Enter") { e.preventDefault(); focusCell(nextRow(tr, 1), 0); }
    else if (k.length === 1) e.preventDefault();
  });
  body.addEventListener("paste", e => {
    const c = e.target.closest(".pc"); if (!c) return;
    e.preventDefault();
    const tr = c.closest("tr");
    const toks = [...(e.clipboardData.getData("text") || "").toUpperCase()].filter(ch => /[A-E\-._0]/.test(ch)).map(ch => (/[A-E]/.test(ch) ? ch : ""));
    let i = +c.dataset.i;
    for (const t of toks) { if (i >= n) break; c.closest("tr").querySelectorAll(".pc")[i].value = t && allowed(qs[i]).includes(t) ? t : ""; i++; }
    refresh(tr); updateInfo(); focusCell(tr, i);
    if (toks.length > n - +c.dataset.i) toast(`Pasted ${n - +c.dataset.i} letters; ${toks.length - (n - +c.dataset.i)} extra ignored.`, "warn");
  });
  body.addEventListener("focusin", e => { const c = e.target.closest(".pc"); if (c) c.select(); });

  const takenAt = () => (date ? new Date(date + "T12:00:00").toISOString() : null);
  async function saveRow(tr) {
    const answers = cells(tr).map(c => c.value.toUpperCase() || null);
    if (!answers.some(Boolean)) {
      if (!(await modal({ title: "Save an empty sheet?", body: `<p>No letters typed for this student. Saving gives them 0/${n}. To record that they did it without a score, use “Mark done” instead.</p>`,
        buttons: [{ label: "Cancel", value: false }, { label: `Save 0/${n}`, value: true, kind: "primary" }] }))) return false;
    }
    await api.recordPaper(m.id, tr.dataset.sid, answers, takenAt());
    return true;
  }
  const reload = () => showPaper(root, ctx, mockId, assignmentId);

  body.addEventListener("change", e => {
    if (e.target.id === "pgGrp") {
      if ($$("tbody tr.is-dirty", body).length && !confirm("Leave unsaved rows?")) { e.target.value = grp; return; }
      grp = e.target.value; try { sessionStorage.setItem("nuet-mocks-grp", grp); } catch (_) {} render(); focusCell(rowsWithCells()[0], 0);
    }
    if (e.target.id === "pgDate") date = e.target.value;
    if (e.target.id === "pgKey") { showKey = e.target.checked; try { sessionStorage.setItem("nuet-paper-key", showKey ? "1" : "0"); } catch (_) {}
      const keep = $$("tbody tr.is-dirty", body).map(tr => [tr.dataset.sid, cells(tr).map(c => c.value)]);
      render(); keep.forEach(([sid, v]) => { const tr = $(`tr[data-sid="${sid}"]`, body); if (tr) { cells(tr).forEach((c, i) => (c.value = v[i])); refresh(tr); } }); updateInfo(); }
  });
  body.addEventListener("click", async e => {
    const t = e.target, tr = t.closest("tr[data-sid]");
    try {
      if (t.closest("[data-save]")) { if (await saveRow(tr)) { toast("Saved", "good"); reload(); } return; }
      if (t.closest("[data-skip]")) { await api.setSkips(m.id, [tr.dataset.sid], true); toast("Marked done", "good"); return reload(); }
      if (t.closest("[data-unskip]")) { await api.setSkips(m.id, [tr.dataset.sid], false); toast("Undone", "good"); return reload(); }
      const dp = t.closest("[data-delp]");
      if (dp) {
        if (!(await modal({ title: "Delete this paper result?", body: "<p>The student's typed answers for this mock are deleted. You can type them again.</p>", buttons: [{ label: "Cancel", value: false }, { label: "Delete", value: true, kind: "danger" }] }))) return;
        await api.deleteAttempt(dp.dataset.delp); toast("Deleted", "good"); return reload();
      }
      if (t.id === "pgSaveAll") {
        const rows = $$("tbody tr.is-dirty", body);
        t.disabled = true; let ok = 0;
        for (const r of rows) { if (await saveRow(r)) ok++; }
        toast(`Saved ${ok} row${ok === 1 ? "" : "s"}`, "good"); return reload();
      }
      if (t.id === "pgDoneRest") {
        const rest = $$("tbody tr[data-saved]", body).filter(r => !r.classList.contains("is-dirty") && !r.querySelector("[data-delp]") && !r.querySelector("[data-unskip]")).map(r => r.dataset.sid);
        if (!rest.length) return toast("Everyone here already has a result.", "warn");
        if (!(await modal({ title: `Mark ${rest.length} student${rest.length === 1 ? "" : "s"} as done?`, body: "<p>They count as having done this mock (next mock unlocks, its questions join their practice), with no score.</p>", buttons: [{ label: "Cancel", value: false }, { label: "Mark done", value: true, kind: "primary" }] }))) return;
        await api.setSkips(m.id, rest, true); toast("Marked done", "good"); return reload();
      }
    } catch (err) { toast(err.message, "error"); if (t.id === "pgSaveAll") reload(); }
  });
  render();
  focusCell(rowsWithCells()[0], 0);
}
