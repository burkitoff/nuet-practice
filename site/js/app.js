import { api } from "./api.js";
import { CONFIG } from "./config.js";
import { $, esc, toast } from "./util.js";
import { showLogin, showHome, showPractice, showAccount } from "./views.js";
import { runAttempt } from "./runner.js";
import { showAttempt } from "./results.js";
import { showStats } from "./stats.js";
import { showClass, showStudents, showMocks, showMockEdit, showMockResults, showQuestions, showCleanup, clearAdminCache } from "./admin.js";

const app = $("#app");
const ctx = { me: null, taxonomy: [], labels: {}, go, idleSec: CONFIG.IDLE_AFTER_SEC };
let current = null;
let shownHash = location.hash, restoring = false;

function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }

function shell(active) {
  const admin = ctx.me.role === "admin";
  app.innerHTML = `
  <header class="topbar">
    <a class="brand" href="#/" aria-label="${esc(CONFIG.APP_NAME)} home"><img src="img/logo.svg" alt="${esc(CONFIG.APP_NAME)}" width="125" height="36"></a>
    <nav>
      <a href="#/" class="${active === "home" ? "on" : ""}">Home</a>
      <a href="#/practice" class="${active === "practice" ? "on" : ""}">Practice</a>
      <a href="#/stats" class="${active === "stats" ? "on" : ""}">My stats</a>
      ${admin ? `<a href="#/admin/class" class="${active === "admin" ? "on" : ""}">Teacher</a>` : ""}
    </nav>
    <div class="who"><a href="#/account" title="Account">${esc(ctx.me.display_name || ctx.me.username)}</a>
      <button class="btn btn-ghost btn-sm" id="logout">Log out</button></div>
  </header>
  <main id="view"></main>`;
  $("#logout").onclick = async () => { await current?.destroy?.(); current = null; await api.signOut(); ctx.me = null; clearAdminCache(); location.hash = "#/"; boot(); };
  return $("#view");
}

async function route() {
  if (!ctx.me) return;
  if (restoring && location.hash === shownHash) { restoring = false; return; }
  // A page can refuse to be left (e.g. a practice asks "leave without saving?").
  if (current?.confirmLeave && location.hash !== shownHash && !(await current.confirmLeave())) {
    if (location.hash !== shownHash) { restoring = true; location.hash = shownHash; }
    return;
  }
  shownHash = location.hash;
  if (current?.destroy) { try { await current.destroy(); } catch (_) {} }
  current = null;
  const parts = (location.hash.replace(/^#\/?/, "") || "").split("/");
  const [p0, p1, p2] = parts;
  const admin = ctx.me.role === "admin";
  try {
    if (p0 === "run" && p1) {
      app.innerHTML = `<div id="view" class="fullscreen"></div>`;
      current = await runAttempt($("#view"), p1, ctx);
      return;
    }
    const tab = p0 === "admin" ? "admin" : p0 === "practice" ? "practice" : p0 === "stats" ? "stats" : p0 === "" ? "home" : "";
    const view = shell(tab);
    if (!p0) await showHome(view, ctx);
    else if (p0 === "practice") await showPractice(view, ctx);
    else if (p0 === "attempt" && p1) await showAttempt(view, p1, ctx);
    else if (p0 === "stats") await showStats(view, p1 && admin ? p1 : ctx.me.id, ctx);
    else if (p0 === "account") showAccount(view, ctx);
    else if (p0 === "admin" && admin) {
      if (!p1 || p1 === "class") await showClass(view, ctx);
      else if (p1 === "students") await showStudents(view, ctx);
      else if (p1 === "mocks") await showMocks(view, ctx);
      else if (p1 === "mock" && p2) await showMockResults(view, p2, ctx);
      else if (p1 === "mock-edit" && p2) await showMockEdit(view, p2, ctx);
      else if (p1 === "questions") await showQuestions(view, ctx);
      else if (p1 === "cleanup") await showCleanup(view, ctx);
    } else view.innerHTML = `<div class="page"><h1>Not found</h1><p><a href="#/">Go home</a></p></div>`;
  } catch (e) {
    console.error(e);
    if (/JWT|not logged in|session/i.test(e.message)) { ctx.me = null; return boot(); }
    const v = $("#view") || app;
    v.innerHTML = `<div class="page"><div class="card"><h2>Something went wrong</h2><p class="err">${esc(e.message)}</p><p><a href="#/">Back to home</a></p></div></div>`;
  }
}

async function afterLogin() {
  ctx.me = await api.me(true);
  if (!ctx.me) throw new Error("Your account has no profile yet. Ask your teacher.");
  if (!ctx.me.active) { await api.signOut(); throw new Error("This account is disabled. Ask your teacher."); }
  ctx.taxonomy = await api.taxonomy();
  ctx.labels = Object.fromEntries(ctx.taxonomy.map(t => [t.code, t.label]));
  Object.assign(ctx.labels, { "P:untagged": "Problem Solving (type not tagged yet)", "R:untagged": "Critical Thinking (type not tagged yet)", untagged: "Not tagged yet" });
  route();
}

async function boot() {
  try {
    if (await api.session()) return await afterLogin();
  } catch (e) { toast(e.message, "error"); }
  app.innerHTML = `<main id="view"></main>`;
  showLogin($("#view"), { onLogin: afterLogin });
}

window.addEventListener("hashchange", route);
boot();
