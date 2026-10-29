import { api } from "./api.js";
import { $, esc, fmtDur, fmtDate, pct, fmtPct, toast } from "./util.js";
import { loadLibrary, seriesProgress, assignedCard, startMockFlow, nextStepCard } from "./library.js";

export async function showHome(root, ctx) {
  root.innerHTML = `<div class="loading">Loading…</div>`;
  await api.finalizeExpired().catch(() => {});
  const teacher = ctx.me.role === "teacher";
  const [attempts, lib] = await Promise.all([api.myAttempts(), teacher ? null : loadLibrary()]);
  const open = attempts.filter(a => a.status === "in_progress" && a.mode === "mock");
  const done = attempts.filter(a => a.status === "submitted");
  const recentQs = done.reduce((s, a) => s + a.total, 0);
  const recentScore = done.reduce((s, a) => s + (a.score || 0), 0);
  const prog = lib ? seriesProgress(lib) : [];

  root.innerHTML = `<div class="page">
    <div class="page-head"><h1>Hello, ${esc(ctx.me.display_name || ctx.me.username)}</h1></div>
    ${open.length ? `<section class="card attention"><h2>Unfinished</h2>${open.map(a => `
      <div class="row-item"><div><b>${esc(a.title)}</b><div class="muted small">started ${fmtDate(a.started_at)}${a.time_limit_sec ? ` · timer keeps running (${fmtDur(a.time_limit_sec * 1000)} limit)` : ""}</div></div>
      <a class="btn btn-primary" href="#/run/${a.id}">Continue</a></div>`).join("")}</section>` : ""}
    ${teacher ? "" : `<div id="nextStep"></div>${assignedCard(lib)}`}

    <div class="home-grid">
      ${teacher ? `<section class="card">
        <h2>Your groups</h2>
        <p class="muted small">${ctx.myGroups.length ? `You can see the students and results of ${ctx.myGroups.map(esc).join(", ")}.` : "No groups are assigned to your account yet."}</p>
        <div class="quick"><a class="btn btn-primary" href="#/teach">Class overview</a><a class="btn" href="#/teach/mocks">Mocks</a></div>
      </section>` : `<section class="card">
        <div class="card-head"><h2>Mock library</h2><a href="#/mocks">All mocks →</a></div>
        <p class="muted small">Timed tests in exam conditions. Each series opens one mock at a time.</p>
        ${prog.length ? prog.map(({ s, done: d, inPlan }) => `<div class="prog-row"><span>${esc(s.title)}</span><span class="prog"><span style="width:${inPlan ? Math.round(100 * d / inPlan) : 0}%"></span></span><span class="muted small">${d}/${inPlan}</span></div>`).join("")
          : `<p class="muted">No mocks yet.</p>`}
      </section>`}
      <section class="card">
        <h2>Practice</h2>
        <p class="muted small">Short sets with no time limit. Answer them, press Finish, then see the correct answers. Questions from a mock join your practice after you've taken that mock.</p>
        <div class="quick">
          <button class="btn" data-quick="1">1 random question</button>
          <button class="btn" data-quick="5">5 random</button>
          <button class="btn" data-quick="10">10 random</button>
          <a class="btn btn-primary" href="#/practice">Choose topic…</a>
        </div>
      </section>
    </div>

    <section class="card">
      <div class="card-head"><h2>Recent</h2><a href="#/stats">All statistics →</a></div>
      ${done.length ? `<p class="muted small">${recentQs} questions so far · ${fmtPct(pct(recentScore, recentQs))} correct</p>
      <table class="tbl"><tbody>${done.slice(0, 8).map(a => `<tr><td>${fmtDate(a.started_at)}</td><td>${a.mode === "mock" ? (a.paper ? "Paper mock" : "Mock") : "Practice"}</td><td>${esc(a.title)}</td>
        <td><b>${a.score ?? 0}/${a.total}</b></td><td><a href="#/attempt/${a.id}">Review →</a></td></tr>`).join("")}</tbody></table>` : `<p class="muted">Nothing yet — start with a practice set or your first mock.</p>`}
    </section></div>`;

  root.onclick = async e => {
    const mb = e.target.closest("[data-start]"), qb = e.target.closest("[data-quick]");
    if (mb && !mb.closest("#nextStep")) {
      startMockFlow(lib.rows.find(r => r.mock.id === mb.dataset.start), ctx);
    } else if (qb) {
      qb.disabled = true;
      try { ctx.go(`#/run/${await api.startPractice({ count: +qb.dataset.quick })}`); } catch (err) { toast(/no questions/.test(err.message) ? "No practice questions left right now — take a mock to unlock more." : err.message, "error"); qb.disabled = false; }
    }
  };
  if (!teacher) nextStepCard($("#nextStep", root), lib, ctx);
}

export async function showPractice(root, ctx) {
  const tax = ctx.taxonomy;
  const exams = ctx.me.role === "student" ? [] : await api.exams();
  const cats = tax.filter(t => t.tier === "category");
  root.innerHTML = `<div class="page narrow">
    <p class="crumbs"><a href="#/">Home</a> › Practice</p>
    <h1>Practice set</h1>
    <form class="card form" id="pf">
      <label>Number of questions
        <select name="count">${[1, 3, 5, 10, 15, 20, 30].map(n => `<option ${n === 5 ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      <label>Section<select name="category"><option value="">Any</option>${cats.map(c => `<option value="${esc(c.code)}">${esc(c.label)}</option>`).join("")}</select></label>
      <label>Question type<select name="subcategory"><option value="">Any</option></select></label>
      <label>Skill<select name="skill"><option value="">Any</option></select></label>
      ${ctx.me.role === "student" ? "" : `<label>From paper<select name="exam"><option value="">Any</option>${exams.map(x => `<option>${esc(x)}</option>`).join("")}</select></label>`}
      <p class="muted small">Questions you have seen least are chosen first.</p>
      <button class="btn btn-primary" type="submit">Start</button>
    </form></div>`;
  const f = $("#pf", root);
  const fill = () => {
    const subs = tax.filter(t => t.tier === "subcategory" && (!f.category.value || t.parent === f.category.value));
    const cur = f.subcategory.value;
    f.subcategory.innerHTML = `<option value="">Any</option>` + subs.map(s => `<option value="${esc(s.code)}" ${s.code === cur ? "selected" : ""}>${esc(s.label)}</option>`).join("");
    const skills = tax.filter(t => t.tier === "skill" && (f.subcategory.value ? t.parent === f.subcategory.value : subs.some(s => s.code === t.parent)));
    f.skill.innerHTML = `<option value="">Any</option>` + skills.map(s => `<option value="${esc(s.code)}">${esc(s.label)}</option>`).join("");
  };
  f.category.onchange = fill; f.subcategory.onchange = fill; fill();
  f.onsubmit = async e => {
    e.preventDefault();
    const btn = f.querySelector("button"); btn.disabled = true;
    try {
      ctx.go(`#/run/${await api.startPractice({ count: +f.count.value, category: f.category.value, subcategory: f.subcategory.value, skill: f.skill.value, exam: f.exam ? f.exam.value : "" })}`);
    } catch (err) { toast(/no questions/.test(err.message) ? "No questions match — try a wider choice. Questions from mocks join Practice after you've taken that mock." : err.message, "error"); btn.disabled = false; }
  };
}

export function showAccount(root, ctx) {
  root.innerHTML = `<div class="page narrow">
    <p class="crumbs"><a href="#/">Home</a> › Account</p>
    <h1>Account</h1>
    <div class="card"><p><b>${esc(ctx.me.display_name)}</b><br><span class="muted">username: ${esc(ctx.me.username)}${ctx.me.group_code ? ` · group ${esc(ctx.me.group_code)}` : ""}${ctx.me.role === "student" && ctx.levels.find(l => l.level === ctx.me.skill_level) ? ` · level: ${esc(ctx.levels.find(l => l.level === ctx.me.skill_level).label)}` : ""}${ctx.me.role === "teacher" ? ` · teacher (${ctx.me.teacher_level === "full" ? "full access" : "results access"})${ctx.myGroups.length ? ` · groups ${ctx.myGroups.map(esc).join(", ")}` : ""}` : ""}</span></p></div>
    ${ctx.me.role === "student" ? (() => { const t = (ctx.tiers || []).find(x => x.code === ctx.me.tier); return `<div class="card"><h2>Your plan</h2><p><span class="plan-chip ${t && t.unlimited ? "is-full" : "is-limited"}">${esc(t ? t.label : "No plan")}</span></p><p class="muted small">${esc(t ? t.description : "Your account doesn't include library mocks yet.")}</p></div>`; })() : ""}
    <form class="card form" id="pw">
      <h2>Change password</h2>
      <label>New password<input name="p1" type="password" minlength="8" autocomplete="new-password" required></label>
      <label>Repeat<input name="p2" type="password" minlength="8" autocomplete="new-password" required></label>
      <button class="btn btn-primary">Save</button>
    </form>
    <div class="card"><h2>Your data</h2><p class="small muted">We store your name, username, group and your answers with their timing, so you and your teacher can see your progress. Nobody else can see them. Ask your teacher if you want your account and data deleted.</p></div>
  </div>`;
  $("#pw", root).onsubmit = async e => {
    e.preventDefault(); const f = e.target;
    if (f.p1.value !== f.p2.value) return toast("Passwords don't match", "error");
    try { await api.changePassword(f.p1.value); toast("Password changed", "good"); f.reset(); } catch (err) { toast(err.message, "error"); }
  };
}
