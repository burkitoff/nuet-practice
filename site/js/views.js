import { api } from "./api.js";
import { CONFIG } from "./config.js";
import { $, esc, fmtDur, fmtDate, pct, fmtPct, toast, modal } from "./util.js";

export function showLogin(root, { onLogin }) {
  root.innerHTML = `
  <div class="login-wrap"><form class="card login" id="loginForm" autocomplete="on">
    <h1 class="sr-only">${esc(CONFIG.APP_NAME)}</h1><img class="login-logo" src="img/logo-stacked.svg" alt="" width="150" height="153">
    <p class="tagline">Train your aim.</p>
    <p class="muted">Log in with the username and password your teacher gave you.</p>
    <label>Username<input name="u" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
    <label>Password<input name="p" type="password" autocomplete="current-password" required></label>
    <button class="btn btn-primary btn-block" type="submit">Log in</button>
    <p class="err" id="loginErr" role="alert"></p>
  </form></div>`;
  $("#loginForm", root).onsubmit = async e => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector("button");
    btn.disabled = true; $("#loginErr", root).textContent = "";
    try { await api.signIn(f.u.value, f.p.value); await onLogin(); }
    catch (err) {
      const m = err.message || String(err);
      $("#loginErr", root).textContent =
        /invalid login credentials/i.test(m) ? "Wrong username or password." :
        /ban|disabled/i.test(m) ? "This account is disabled. Ask your teacher." :
        /api key|apikey|secret/i.test(m) ? "Setup problem: the key in config.js is wrong (" + m + ")." :
        /fetch|network/i.test(m) ? "Can't reach the server — check the internet connection and SUPABASE_URL in config.js." :
        m;
      btn.disabled = false;
    }
  };
}

export async function showHome(root, ctx) {
  root.innerHTML = `<div class="loading">Loading…</div>`;
  await api.finalizeExpired().catch(() => {});
  const [mocks, attempts] = await Promise.all([api.mocks(), api.myAttempts()]);
  const open = attempts.filter(a => a.status === "in_progress");
  const done = attempts.filter(a => a.status === "submitted");
  const used = id => attempts.filter(a => a.mock_id === id).length;
  const visibleMocks = mocks.filter(m => m.published);
  const recentQs = done.reduce((s, a) => s + a.total, 0);
  const recentScore = done.reduce((s, a) => s + (a.score || 0), 0);

  root.innerHTML = `<div class="page">
    <div class="page-head"><h1>Hello, ${esc(ctx.me.display_name || ctx.me.username)}</h1></div>
    ${open.length ? `<section class="card attention"><h2>Unfinished</h2>${open.map(a => `
      <div class="row-item"><div><b>${esc(a.title)}</b><div class="muted small">started ${fmtDate(a.started_at)}${a.time_limit_sec ? ` · timer keeps running (${fmtDur(a.time_limit_sec * 1000)} limit)` : ""}</div></div>
      <a class="btn btn-primary" href="#/run/${a.id}">Continue</a></div>`).join("")}</section>` : ""}

    <div class="home-grid">
      <section class="card">
        <h2>Mock tests</h2>
        <p class="muted small">Full timed papers in exam conditions. No answers are shown until you submit.</p>
        ${visibleMocks.length ? visibleMocks.map(m => {
          const u = used(m.id), left = m.max_attempts - u, inprog = open.find(a => a.mock_id === m.id);
          return `<div class="row-item"><div><b>${esc(m.title)}</b>
            <div class="muted small">${m.question_ids.length} questions · ${fmtDur(m.time_limit_sec * 1000, { sec: false })}${m.description ? " · " + esc(m.description) : ""}${u ? ` · taken ${u}×` : ""}</div></div>
            ${inprog ? `<a class="btn" href="#/run/${inprog.id}">Continue</a>` : left > 0 ? `<button class="btn btn-primary" data-mock="${m.id}">Start</button>` : `<span class="muted small">done</span>`}</div>`;
        }).join("") : `<p class="muted">No mocks assigned yet.</p>`}
      </section>
      <section class="card">
        <h2>Practice</h2>
        <p class="muted small">Short sets with the answer shown after each question.</p>
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
      <table class="tbl"><tbody>${done.slice(0, 8).map(a => `<tr><td>${fmtDate(a.started_at)}</td><td>${a.mode === "mock" ? "Mock" : "Practice"}</td><td>${esc(a.title)}</td>
        <td><b>${a.score ?? 0}/${a.total}</b></td><td><a href="#/attempt/${a.id}">Review →</a></td></tr>`).join("")}</tbody></table>` : `<p class="muted">Nothing yet — start with a practice set.</p>`}
    </section></div>`;

  root.onclick = async e => {
    const mb = e.target.closest("[data-mock]"), qb = e.target.closest("[data-quick]");
    if (mb) {
      const m = mocks.find(x => x.id === mb.dataset.mock);
      const ok = await modal({ title: `Start “${m.title}”?`, body: `<p>${m.question_ids.length} questions, <b>${fmtDur(m.time_limit_sec * 1000, { sec: false })}</b>.</p>
        <p>The timer starts now and keeps running even if you close the page. Find a quiet place and make sure you have time to finish.</p>
        <p class="muted small">Tip: you can hide the timer by clicking it; you'll still get warnings at 10, 5 and 1 minutes.</p>`,
        buttons: [{ label: "Not now", value: false }, { label: "Start the test", value: true, kind: "primary" }] });
      if (!ok) return;
      try { ctx.go(`#/run/${await api.startMock(m.id)}`); } catch (err) { toast(err.message, "error"); }
    } else if (qb) {
      qb.disabled = true;
      try { ctx.go(`#/run/${await api.startPractice({ count: +qb.dataset.quick })}`); } catch (err) { toast(err.message, "error"); qb.disabled = false; }
    }
  };
}

export async function showPractice(root, ctx) {
  const tax = ctx.taxonomy;
  const exams = await api.exams();
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
      <label>From paper<select name="exam"><option value="">Any</option>${exams.map(x => `<option>${esc(x)}</option>`).join("")}</select></label>
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
      ctx.go(`#/run/${await api.startPractice({ count: +f.count.value, category: f.category.value, subcategory: f.subcategory.value, skill: f.skill.value, exam: f.exam.value })}`);
    } catch (err) { toast(/no questions/.test(err.message) ? "No questions match — try a wider choice." : err.message, "error"); btn.disabled = false; }
  };
}

export function showAccount(root, ctx) {
  root.innerHTML = `<div class="page narrow">
    <p class="crumbs"><a href="#/">Home</a> › Account</p>
    <h1>Account</h1>
    <div class="card"><p><b>${esc(ctx.me.display_name)}</b><br><span class="muted">username: ${esc(ctx.me.username)}${ctx.me.group_code ? ` · group ${esc(ctx.me.group_code)}` : ""}</span></p></div>
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
