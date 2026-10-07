import { api } from "./api.js";
import { deriveItems, summarize, groupBy, questionStats, insights } from "./analytics.js";
import { accBar, ratioPill } from "./charts.js";
import { renderQuestion, mediaPaths, lettersFor } from "./render.js";
import { targetMs } from "./analytics.js";
import { $, $$, esc, h, fmtDur, fmtDate, pct, fmtPct, toast, modal, randomPassword, downloadCsv } from "./util.js";

const TABS = [["class", "Class"], ["cleanup", "Data clean-up"], ["students", "Students"], ["mocks", "Mocks"], ["questions", "Questions"]];

function frame(root, tab, inner) {
  root.innerHTML = `<div class="page wide">
    <div class="page-head"><h1>Teacher</h1>
      <nav class="tabs">${TABS.map(([k, l]) => `<a href="#/admin/${k}" class="${k === tab ? "on" : ""}">${l}</a>`).join("")}</nav></div>
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
  const body = frame(root, "class");
  const { profiles, groups, qById } = await base(true);
  const { attempts, items } = await api.statsData("*");
  const all = deriveItems(attempts, items, qById);
  const L = ctx.labels;
  const students = profiles.filter(p => p.role === "student");
  let grp = "";

  function render() {
    const studs = students.filter(s => !grp || s.group_code === grp);
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
        <select id="grp"><option value="">All groups</option>${groups.map(g => `<option ${g.code === grp ? "selected" : ""}>${esc(g.code)}</option>`).join("")}</select>
        <span class="muted small">${studs.length} students · ${cls.n} answers · ${fmtPct(cls.acc)} correct</span>
        <span class="grow"></span>
        <button class="btn btn-sm" id="csvSum">Download summary (CSV)</button>
        <button class="btn btn-sm" id="csvRaw">Download all answers (CSV)</button>
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

export async function showMockResults(root, mockId, ctx) {
  const body = frame(root, "mocks");
  const { profiles, qById } = await base(true);
  const mock = (await api.mocks()).find(m => m.id === mockId);
  if (!mock) { body.innerHTML = `<p>Mock not found.</p>`; return; }
  const allAtt = (await api.allAttempts()).filter(a => a.mock_id === mockId);
  const { attempts, items } = await api.statsData("*");
  const subAtt = attempts.filter(a => a.mock_id === mockId);
  const keys = await api.answerKeys(mock.question_ids);
  const its = items.filter(i => subAtt.some(a => a.id === i.attempt_id)).map(i => ({ ...i, correct_answer: i.correct_answer || keys[i.question_id] }));
  const ds = deriveItems(subAtt, its, qById);
  const pBy = Object.fromEntries(profiles.map(p => [p.id, p]));
  const inprog = allAtt.filter(a => a.status === "in_progress");
  const qst = Object.fromEntries(questionStats(ds).map(x => [x.qid, x]));
  const L = ctx.labels;

  body.innerHTML = `
    <p class="crumbs"><a href="#/admin/mocks">Mocks</a> › ${esc(mock.title)}</p>
    <div class="toolbar"><h2 class="grow">${esc(mock.title)} <span class="muted small">${mock.question_ids.length} Qs · ${fmtDur(mock.time_limit_sec * 1000, { sec: false })}</span></h2>
      ${mock.show_review ? "" : `<button class="btn btn-sm" id="release">Release answers to students</button>`}</div>
    ${inprog.length ? `<section class="card attention"><h2>In progress (${inprog.length})</h2>${inprog.map(a => `<div class="row-item"><div>${esc(pBy[a.user_id]?.display_name || "?")} <span class="muted small">started ${fmtDate(a.started_at)}</span></div>
      <button class="btn btn-sm" data-final="${a.id}">Close &amp; grade now</button></div>`).join("")}</section>` : ""}
    <section class="card"><h2>Results</h2>
    ${subAtt.length ? `<div class="scroll-x"><table class="tbl grid-res"><thead><tr><th>Student</th><th>Score</th><th>Time</th>${mock.question_ids.map((q, i) => `<th class="qc" title="${esc(q)}">${i + 1}</th>`).join("")}<th></th></tr></thead><tbody>
      ${subAtt.sort((a, b) => b.score - a.score).map(a => {
        const row = ds.filter(d => d.attempt_id === a.id);
        const used = row.reduce((s, d) => s + d.time_ms, 0);
        const adj = row.length !== a.total ? `<b>${row.filter(d => d.status === "correct").length}</b>/${row.length} <span class="muted small" title="Raw score ${a.score}/${a.total}; voided/excluded questions not counted">adj.</span>` : `<b>${a.score}</b>/${a.total}`;
        return `<tr class="${a.excluded ? "is-excluded" : ""}"><td><a href="#/attempt/${a.id}">${esc(pBy[a.user_id]?.display_name || "?")}</a>${a.excluded ? ' <span class="pill">not counted</span>' : ""}</td><td>${adj}</td>
          <td class="small">${fmtDur(used)}${a.auto_submitted ? " ⏱" : ""}</td>
          ${mock.question_ids.map(qid => { const d = row.find(x => x.question_id === qid); if (!d) return "<td></td>";
            return `<td class="qc st-${d.status}" title="Q${d.position}: ${d.answer || "blank"} · ${fmtDur(d.time_ms)}${d.changes ? ` · ${d.changes} change(s)` : ""}">${d.answer || "·"}</td>`; }).join("")}
          <td><button class="btn btn-ghost btn-sm" data-del="${a.id}" title="Delete this attempt (lets the student retake)">✕</button></td></tr>`;
      }).join("")}
      <tr class="total"><td>% correct</td><td></td><td></td>${mock.question_ids.map(qid => `<td class="qc">${qst[qid] ? qst[qid].acc : ""}</td>`).join("")}<td></td></tr>
      <tr class="total"><td>avg time</td><td></td><td></td>${mock.question_ids.map(qid => `<td class="qc small">${qst[qid] ? Math.round(qst[qid].avgMs / 1000) : ""}</td>`).join("")}<td></td></tr>
      </tbody></table></div>` : `<p class="muted">Nobody has submitted this mock yet.</p>`}
    </section>
    ${subAtt.length ? `<section class="card"><h2>Questions</h2><table class="tbl"><thead><tr><th>#</th><th>Question</th><th>Type</th><th>Correct</th><th>Avg time</th><th>Answers</th><th></th></tr></thead><tbody>
      ${mock.question_ids.map((qid, i) => { const q = qById[qid] || {};
        const mine = its.filter(it => it.question_id === qid); const voided = mine.length && mine.every(it => it.excluded);
        const x = qst[qid];
        const btn = `<button class="btn btn-ghost btn-sm" data-void="${esc(qid)}" data-on="${voided ? 0 : 1}" title="${voided ? "Count this question again" : "Stop counting this question for everyone (e.g. the question itself is wrong)"}">${voided ? "Un-void" : "Void"}</button>`;
        if (!x) return voided ? `<tr class="is-excluded"><td>${i + 1}</td><td>${esc(qid)}</td><td colspan="4"><span class="pill">voided — not counted for anyone</span></td><td>${btn}</td></tr>` : "";
        return `<tr><td>${i + 1}</td><td><a href="#" data-prev="${esc(qid)}">${esc(qid)}</a></td><td class="small">${esc(L[q.subcategory] || q.subcategory || "")}</td><td>${accBar(x.acc)}</td><td>${fmtDur(x.avgMs)}</td>
          <td class="dist">${lettersFor(q).map(Lt => `<span class="${Lt === keys[qid] ? "key" : ""}">${Lt}:${x.dist[Lt]}</span>`).join(" ")} <span class="muted">–:${x.dist.blank}</span></td><td>${btn}</td></tr>`; }).join("")}
      </tbody></table></section>` : ""}`;

  body.onclick = async e => {
    const vb = e.target.closest("[data-void]");
    if (vb) { await api.voidQuestion(mockId, vb.dataset.void, vb.dataset.on === "1"); toast(vb.dataset.on === "1" ? "Question voided" : "Question counted again", "good"); return showMockResults(root, mockId, ctx); }
    const f = e.target.closest("[data-final]"), d = e.target.closest("[data-del]"), p = e.target.closest("[data-prev]");
    if (f) { await api.adminFinalize(f.dataset.final); toast("Graded", "good"); showMockResults(root, mockId, ctx); }
    if (d) {
      if (await modal({ title: "Delete this attempt?", body: "<p>The student's answers for this attempt will be permanently deleted and they can take the mock again.</p>", buttons: [{ label: "Cancel", value: false }, { label: "Delete", value: true, kind: "danger" }] })) {
        await api.deleteAttempt(d.dataset.del); showMockResults(root, mockId, ctx);
      }
    }
    if (p) { e.preventDefault(); previewQuestion(p.dataset.prev); }
    if (e.target.id === "release") {
      if (await modal({ title: "Release answers?", body: "<p>Students who took this mock will see the correct answers in their review.</p>", buttons: [{ label: "Cancel", value: false }, { label: "Release", value: true, kind: "primary" }] })) {
        await api.releaseReview(mockId); toast("Answers released", "good"); showMockResults(root, mockId, ctx);
      }
    }
  };
}

export async function showStudents(root, ctx) {
  const body = frame(root, "students");
  const { profiles, groups } = await base(true);
  const studs = profiles.filter(p => p.id !== ctx.me.id);
  const grpOpts = sel => `<option value="">— none —</option>` + groups.map(g => `<option ${g.code === sel ? "selected" : ""}>${esc(g.code)}</option>`).join("");

  body.innerHTML = `
    <div class="two-col">
      <form class="card form" id="addForm"><h2>Add a student</h2>
        <label>Name shown in the app<input name="display_name" required maxlength="80" placeholder="e.g. Aruzhan K."></label>
        <label>Username <span class="muted small">(what they type to log in: a–z, 0–9, . _ -)</span><input name="username" required pattern="[a-z0-9._\\-]{3,32}" autocapitalize="none" spellcheck="false" placeholder="e.g. aruzhan.k"></label>
        <label>Group<select name="group_code">${grpOpts("")}</select></label>
        <label>Password <span class="muted small">(generated — you can change it)</span><input name="password" required minlength="8" value="${randomPassword()}"></label>
        <button class="btn btn-primary">Create account</button>
      </form>
      <div class="card"><h2>Groups</h2>
        <table class="tbl"><tbody>${groups.map(g => `<tr><td><b>${esc(g.code)}</b></td><td>${esc(g.label)}</td><td class="small muted">${studs.filter(s => s.group_code === g.code).length} students</td>
          <td><button class="btn btn-ghost btn-sm" data-delgroup="${esc(g.code)}">Delete</button></td></tr>`).join("")}</tbody></table>
        <form id="grpForm" class="inline-form"><input name="code" placeholder="Code, e.g. NC070" required pattern="[A-Za-z0-9_\\-]{1,32}"><input name="label" placeholder="Label (optional)"><button class="btn btn-sm">Add group</button></form>
      </div>
    </div>
    <section class="card"><h2>Accounts (${studs.length})</h2>
      <div class="scroll-x"><table class="tbl"><thead><tr><th>Name</th><th>Username</th><th>Group</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>
      ${studs.map(s => `<tr data-id="${s.id}"><td><b>${esc(s.display_name)}</b></td><td><code>${esc(s.username)}</code></td>
        <td><select data-setgroup="${s.id}">${grpOpts(s.group_code)}</select></td><td>${esc(s.role)}</td>
        <td>${s.active ? '<span class="pill pill-good">active</span>' : '<span class="pill">disabled</span>'}</td>
        <td class="actions"><a class="btn btn-ghost btn-sm" href="#/stats/${s.id}">Stats</a>
          <button class="btn btn-ghost btn-sm" data-act="rename">Rename</button>
          <button class="btn btn-ghost btn-sm" data-act="reset">New password</button>
          <button class="btn btn-ghost btn-sm" data-act="toggle">${s.active ? "Disable" : "Enable"}</button>
          <button class="btn btn-ghost btn-sm danger" data-act="delete">Delete</button></td></tr>`).join("")}
      </tbody></table></div></section>`;

  const showCreds = (name, username, password) => modal({ title: `Login details for ${name}`,
    body: `<p>Give these to the student (they can change the password under “Account”). <b>This password will not be shown again.</b></p>
      <div class="creds"><div>Website: <code>${esc(location.origin + location.pathname)}</code></div><div>Username: <code>${esc(username)}</code></div><div>Password: <code>${esc(password)}</code></div></div>`,
    buttons: [{ label: "Copy", value: () => { navigator.clipboard?.writeText(`${location.origin + location.pathname}\nUsername: ${username}\nPassword: ${password}`); return true; } }, { label: "Done", value: true, kind: "primary" }] });

  $("#addForm", body).onsubmit = async e => {
    e.preventDefault(); const f = e.target; const btn = f.querySelector("button"); btn.disabled = true;
    const p = { action: "create", display_name: f.display_name.value.trim(), username: f.username.value.trim().toLowerCase(), group_code: f.group_code.value || null, password: f.password.value };
    try { await api.adminUsers(p); await showCreds(p.display_name, p.username, p.password); showStudents(root, ctx); }
    catch (err) { toast(err.message, "error"); btn.disabled = false; }
  };
  $("#grpForm", body).onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    try { await api.saveGroup({ code: f.code.value.trim(), label: f.label.value.trim() || f.code.value.trim() }); showStudents(root, ctx); } catch (err) { toast(err.message, "error"); }
  };
  body.onchange = async e => {
    const s = e.target.closest("[data-setgroup]"); if (!s) return;
    try { await api.updateProfile(s.dataset.setgroup, { group_code: s.value || null }); toast("Group updated", "good"); } catch (err) { toast(err.message, "error"); }
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
      if (b.dataset.act === "reset") {
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

export async function showMocks(root, ctx) {
  const body = frame(root, "mocks");
  const mocks = await api.mocks();
  const atts = await api.allAttempts();
  body.innerHTML = `
    <div class="toolbar"><span class="grow"></span><a class="btn btn-primary" href="#/admin/mock-edit/new">New mock</a></div>
    <section class="card">${mocks.length ? `<table class="tbl"><thead><tr><th>Mock</th><th>Qs</th><th>Time</th><th>Groups</th><th>Status</th><th>Taken</th><th></th></tr></thead><tbody>
      ${mocks.map(m => `<tr><td><b>${esc(m.title)}</b><div class="small muted">${esc(m.description)}</div></td><td>${m.question_ids.length}</td><td>${fmtDur(m.time_limit_sec * 1000, { sec: false })}</td>
        <td class="small">${m.group_codes ? esc(m.group_codes.join(", ")) : "everyone"}</td>
        <td>${m.published ? '<span class="pill pill-good">published</span>' : '<span class="pill">draft</span>'}${m.reserve_questions ? ' <span class="pill" title="Questions are kept out of Practice">reserved</span>' : ""}</td>
        <td>${atts.filter(a => a.mock_id === m.id && a.status === "submitted").length}</td>
        <td class="actions"><a class="btn btn-sm" href="#/admin/mock/${m.id}">Results</a> <a class="btn btn-ghost btn-sm" href="#/admin/mock-edit/${m.id}">Edit</a></td></tr>`).join("")}
      </tbody></table>` : `<p class="muted">No mocks yet. Create one to give students a full timed test.</p>`}</section>`;
}

export async function showMockEdit(root, id, ctx) {
  const body = frame(root, "mocks");
  const { groups, questions, qById } = await base(true);
  const L = ctx.labels;
  const active = questions.filter(q => q.active);
  const exams = [...new Set(active.map(q => q.exam_code))].sort();
  const existing = id !== "new" ? (await api.mocks()).find(m => m.id === id) : null;
  const m = existing ? { ...existing } : { title: "", description: "", time_limit_sec: 3600, question_ids: [], group_codes: null, published: false, show_review: true, reserve_questions: true, max_attempts: 1 };
  let list = [...m.question_ids];

  body.innerHTML = `
    <p class="crumbs"><a href="#/admin/mocks">Mocks</a> › ${existing ? "Edit" : "New mock"}</p>
    <div class="two-col">
      <form class="card form" id="mf">
        <label>Title<input name="title" required maxlength="120" value="${esc(m.title)}" placeholder="e.g. Mock 3 — October"></label>
        <label>Description (optional)<input name="description" value="${esc(m.description)}"></label>
        <label>Time limit (minutes)<input name="minutes" type="number" min="1" max="240" value="${Math.round(m.time_limit_sec / 60)}" required></label>
        <fieldset><legend>Who can take it</legend>
          <label class="check"><input type="checkbox" name="everyone" ${m.group_codes ? "" : "checked"}> Everyone</label>
          ${groups.map(g => `<label class="check"><input type="checkbox" name="grp" value="${esc(g.code)}" ${m.group_codes?.includes(g.code) ? "checked" : ""}> ${esc(g.code)}</label>`).join("")}
        </fieldset>
        <label>Attempts allowed per student<input name="max_attempts" type="number" min="1" max="20" value="${m.max_attempts}"></label>
        <label class="check"><input type="checkbox" name="show_review" ${m.show_review ? "checked" : ""}> Show correct answers after submitting</label>
        <label class="check"><input type="checkbox" name="reserve_questions" ${m.reserve_questions ? "checked" : ""}> Keep these questions out of Practice (so the mock stays unseen)</label>
        <label class="check"><input type="checkbox" name="published" ${m.published ? "checked" : ""}> Published (visible to students)</label>
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
    const row = { id: m.id, title: f.title.value.trim(), description: f.description.value.trim(), time_limit_sec: Math.round(+f.minutes.value * 60),
      question_ids: list, group_codes: f.everyone.checked || !grps.length ? null : grps, published: f.published.checked,
      show_review: f.show_review.checked, reserve_questions: f.reserve_questions.checked, max_attempts: +f.max_attempts.value || 1 };
    try { await api.saveMock(row); toast("Saved", "good"); ctx.go("#/admin/mocks"); } catch (err) { toast(err.message, "error"); }
  };
  $("#delMock", body)?.addEventListener("click", async () => {
    if (await modal({ title: "Delete this mock?", body: "<p>Students' past attempts and statistics are kept; the mock itself disappears.</p>", buttons: [{ label: "Cancel", value: false }, { label: "Delete", value: true, kind: "danger" }] })) {
      await api.deleteMock(m.id); ctx.go("#/admin/mocks");
    }
  });
  drawList();
}

export async function showQuestions(root, ctx) {
  const body = frame(root, "questions");
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
  const body = frame(root, "cleanup");
  const { profiles, qById } = await base(true);
  const pBy = Object.fromEntries(profiles.map(p => [p.id, p]));
  const [{ attempts, items }, allAtt, reports] = await Promise.all([api.statsData("*"), api.allAttempts(), api.reports()]);
  const aBy = Object.fromEntries(attempts.map(a => [a.id, a]));
  const L = ctx.labels;
  let who = "", showHandled = false, showReports = "open";

  const flagged = [];
  for (const it of items) {
    const a = aBy[it.attempt_id]; if (!a || (a.mode === "practice" && !it.locked)) continue;
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
