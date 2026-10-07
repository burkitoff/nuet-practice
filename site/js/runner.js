import { api } from "./api.js";
import { renderQuestion, mediaPaths, LETTERS, lettersFor } from "./render.js";
import { $, $$, esc, fmtDur, modal, toast, h } from "./util.js";
import { CONFIG } from "./config.js";

const SAVE_EVERY_MS = 15000;
const BACKUP_KEY = id => `nuet-attempt-${id}`;

function readBackup(id) { try { return JSON.parse(localStorage.getItem(BACKUP_KEY(id))); } catch (_) { return null; } }
function writeBackup(id, data) { try { localStorage.setItem(BACKUP_KEY(id), JSON.stringify(data)); } catch (_) {} }
function dropBackup(id) { try { localStorage.removeItem(BACKUP_KEY(id)); } catch (_) {} }
function pref(k, v) {
  try { if (v === undefined) return JSON.parse(localStorage.getItem("nuet-pref-" + k)); localStorage.setItem("nuet-pref-" + k, JSON.stringify(v)); } catch (_) { return null; }
}

export async function runAttempt(root, attemptId, { go }) {
  root.innerHTML = `<div class="loading">Loading…</div>`;
  const { attempt, items: rows } = await api.attempt(attemptId);
  if (attempt.status !== "in_progress") { go(`#/attempt/${attemptId}`); return {}; }

  const qs = await api.questions(attempt.question_ids);
  const qById = Object.fromEntries(qs.map(q => [q.id, q]));
  const urls = await api.mediaUrls(qs.flatMap(mediaPaths));
  const serverNow = await api.serverNow();
  const skew = serverNow - Date.now();
  const startedMs = Date.parse(attempt.started_at);
  const clock = () => Date.now() + skew - startedMs;
  const isMock = attempt.mode === "mock";
  const limitMs = attempt.time_limit_sec ? attempt.time_limit_sec * 1000 : null;
  const targetMs = isMock && limitMs ? limitMs / attempt.total : CONFIG.PRACTICE_TARGET_SEC * 1000;

  const backup = readBackup(attemptId);
  const S = rows.filter(r => qById[r.question_id]).map(r => {
    let b = backup?.items?.find(x => x.question_id === r.question_id);
    if (b && !r.locked && (b.events?.length || 0) > (r.events?.length || 0)) r = { ...r, ...b };
    return {
      question_id: r.question_id, position: r.position, answer: r.answer, locked: r.locked,
      correct_answer: r.correct_answer, is_correct: r.is_correct,
      time_ms: r.time_ms || 0, first_seen_ms: r.first_seen_ms, first_answer_ms: r.first_answer_ms, last_answer_ms: r.last_answer_ms,
      visits: r.visits || 0, changes: r.changes || 0, flagged: !!r.flagged, crossed: new Set(r.crossed || []), events: [...(r.events || [])],
    };
  });
  let hiddenMs = Math.max(attempt.hidden_ms || 0, backup?.hidden_ms || 0);
  let cur = -1, markAt = null, hiddenAt = null, finished = false, saving = false;
  const dirty = new Set();
  let fontScale = pref("font") || 1;
  let timerHidden = !!pref("timerHidden");
  const warned = new Set();
  let lastAuto = 0;

  const payload = it => ({
    question_id: it.question_id, answer: it.answer, time_ms: Math.round(it.time_ms),
    first_seen_ms: it.first_seen_ms, first_answer_ms: it.first_answer_ms, last_answer_ms: it.last_answer_ms,
    visits: it.visits, changes: it.changes, flagged: it.flagged, crossed: [...it.crossed], events: it.events,
  });
  const ev = (it, e, v) => { const x = { t: Math.round(clock()), e }; if (v !== undefined) x.v = v; it.events.push(x); dirty.add(it); backupNow(); };
  const backupNow = () => writeBackup(attemptId, { items: S.map(payload), hidden_ms: hiddenMs });

  const IDLE_MS = (CONFIG.IDLE_AFTER_SEC || 180) * 1000;
  let lastAct = clock(), idle = false;
  function accrue() {
    if (cur < 0 || markAt == null || hiddenAt != null || idle) return;
    const n = clock();
    S[cur].time_ms += Math.max(0, Math.min(n, lastAct + IDLE_MS) - markAt);
    markAt = n;
    if (n - lastAct > IDLE_MS) {
      idle = true;
      S[cur].events.push({ t: Math.round(lastAct + IDLE_MS), e: "idle" }); dirty.add(S[cur]);
    }
  }
  function activity() {
    lastAct = clock();
    if (idle && cur >= 0 && hiddenAt == null && !finished) { idle = false; markAt = clock(); ev(S[cur], "active"); }
  }
  function enter(i) {
    if (i === cur) return;
    if (cur >= 0) { accrue(); ev(S[cur], "out"); }
    cur = i; const it = S[cur]; idle = false; lastAct = clock();
    it.visits++; if (it.first_seen_ms == null) it.first_seen_ms = Math.round(clock());
    ev(it, "in"); markAt = clock();
    draw();
  }

  root.innerHTML = `
  <div class="exam ${isMock ? "is-mock" : "is-practice"}">
    <header class="exam-bar">
      <div class="eb-left"><span class="eb-title">${esc(attempt.title || (isMock ? "Mock" : "Practice"))}</span>
        <span class="eb-pos" id="ebPos"></span></div>
      <div class="eb-mid"><button class="timer" id="timer" title="Click to hide/show the timer"></button></div>
      <div class="eb-right">
        <button class="btn btn-ghost btn-sm" id="fontDown" title="Smaller text">A−</button>
        <button class="btn btn-ghost btn-sm" id="fontUp" title="Larger text">A+</button>
        <button class="btn btn-ghost btn-sm sheet-toggle" id="sheetToggle">Answer sheet</button>
        <button class="btn btn-primary btn-sm" id="finish">${isMock ? "Finish test" : "Finish"}</button>
      </div>
    </header>
    <div class="exam-main">
      <div class="desk">
        <div class="paper" id="paper"></div>
        <div class="paper-nav">
          <button class="btn" id="prev">← Previous</button>
          <button class="btn btn-ghost" id="flag">⚑ Flag</button>
          <button class="btn btn-ghost btn-sm muted" id="report" title="Tell your teacher something is wrong with this question">Report a problem</button>
          <span class="nav-mid" id="navMid"></span>
          <button class="btn" id="next">Next →</button>
        </div>
        <p class="hint">Keys: <kbd>A</kbd>–<kbd>${S.some(it => lettersFor(qById[it.question_id]).includes("E")) ? "E" : "D"}</kbd> choose · <kbd>Shift</kbd>+letter cross out · <kbd>←</kbd><kbd>→</kbd> move · <kbd>F</kbd> flag</p>
      </div>
      <aside class="sheet" id="sheet">
        <div class="sheet-head">Answer sheet</div>
        <div class="sheet-grid" id="sheetGrid"></div>
        <div class="sheet-legend"><span><i class="lg lg-ans"></i>answered</span><span><i class="lg lg-flag">⚑</i>flagged</span></div>
      </aside>
    </div>
  </div>`;

  const paper = $("#paper", root), grid = $("#sheetGrid", root);

  function drawSheet() {
    grid.innerHTML = S.map((it, i) => `
      <div class="sheet-row ${i === cur ? "is-cur" : ""} ${it.locked && !isMock ? (it.is_correct ? "is-right" : "is-wrongrow") : ""}" data-row="${i}">
        <button class="sheet-num" data-go="${i}" aria-label="Go to question ${i + 1}">${i + 1}</button>
        ${lettersFor(qById[it.question_id]).map(L => `<button class="bubble ${it.answer === L ? "is-on" : ""}" data-bub="${i}:${L}" aria-label="Q${i + 1} ${L}" ${it.locked ? "disabled" : ""}>${L}</button>`).join("")}
        <span class="sheet-flag">${it.flagged ? "⚑" : ""}</span>
      </div>`).join("");
  }

  function draw() {
    const it = S[cur], q = qById[it.question_id];
    paper.style.setProperty("--fs", fontScale);
    paper.innerHTML = renderQuestion(q, urls, {
      number: it.position, answer: it.answer, crossed: it.crossed, interactive: !it.locked,
      correct: it.locked && !isMock ? it.correct_answer : null,
    });
    $("#ebPos", root).innerHTML = `<span class="wide-only">Question </span>${cur + 1}<span class="wide-only"> of </span><span class="narrow-only">/</span>${S.length}`;
    $("#prev", root).disabled = cur === 0;
    $("#next", root).disabled = cur === S.length - 1;
    const fb = $("#flag", root); fb.classList.toggle("is-on", it.flagged); fb.textContent = it.flagged ? "⚑ Flagged" : "⚑ Flag";
    const mid = $("#navMid", root);
    if (!isMock) {
      if (it.locked) {
        mid.innerHTML = it.is_correct
          ? `<span class="result ok">✓ Correct · ${fmtDur(it.time_ms)}</span>`
          : `<span class="result bad">✗ Answer: ${esc(it.correct_answer)} · ${fmtDur(it.time_ms)}</span>`;
      } else {
        mid.innerHTML = `<button class="btn btn-primary" id="check" ${it.answer ? "" : "disabled"}>Check answer</button>`;
        $("#check", root).onclick = check;
      }
    } else mid.textContent = "";
    drawSheet();
    paper.scrollTop = 0; window.scrollTo({ top: 0 });
  }

  function select(i, L) {
    const it = S[i]; if (it.locked || finished || !lettersFor(qById[it.question_id]).includes(L)) return;
    if (it.answer === L) { it.answer = null; ev(it, "clr"); }
    else {
      if (it.answer) it.changes++;
      it.answer = L;
      const t = Math.round(clock());
      if (it.first_answer_ms == null) it.first_answer_ms = t;
      it.last_answer_ms = t;
      if (it.crossed.has(L)) { it.crossed.delete(L); ev(it, "ux", L); }
      ev(it, "sel", L);
      if (i !== cur) it.events[it.events.length - 1].src = "sheet";
    }
    if (i === cur) draw(); else drawSheet();
    scheduleSave();
  }
  function cross(L) {
    const it = S[cur]; if (it.locked || !lettersFor(qById[it.question_id]).includes(L)) return;
    if (it.crossed.has(L)) { it.crossed.delete(L); ev(it, "ux", L); } else { it.crossed.add(L); ev(it, "x", L); }
    draw();
  }
  function flag() { const it = S[cur]; it.flagged = !it.flagged; ev(it, it.flagged ? "flag" : "unflag"); draw(); }

  async function check() {
    const it = S[cur]; if (!it.answer || it.locked) return;
    accrue();
    try {
      const r = await api.checkPractice(attemptId, payload(it));
      it.locked = true; it.correct_answer = r.correct_answer; it.is_correct = r.is_correct;
      dirty.delete(it); draw();
    } catch (e) { toast(e.message, "error"); }
  }

  let saveTimer = null;
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 2500); }
  async function save() {
    if (saving || finished || !dirty.size) return;
    saving = true; accrue();
    const batch = [...dirty]; dirty.clear();
    try {
      const st = await api.saveProgress(attemptId, batch.map(payload), Math.round(clock()), Math.round(hiddenMs));
      $("#timer", root)?.classList.remove("offline");
      if (st === "submitted") { finished = true; cleanup(); toast("Time is up — your test was submitted.", "info"); go(`#/attempt/${attemptId}`); }
    } catch (e) {
      batch.forEach(x => dirty.add(x));
      $("#timer", root)?.classList.add("offline");
    } finally { saving = false; }
  }

  async function finish(auto = false) {
    if (finished) return;
    if (!auto) {
      const blanks = S.filter(x => !x.answer).map(x => x.position);
      const flags = S.filter(x => x.flagged).map(x => x.position);
      const unchecked = S.filter(x => x.answer && !x.locked).length;
      const body = isMock
        ? `<p>You answered <b>${S.length - blanks.length}</b> of ${S.length} questions.</p>
           ${blanks.length ? `<p>Unanswered: ${blanks.join(", ")}</p>` : ""}
           ${flags.length ? `<p>Flagged: ${flags.join(", ")}</p>` : ""}
           <p>Once submitted you can't change your answers.</p>`
        : `<p>${S.filter(x => x.locked).length} checked question(s) will be scored.${unchecked ? ` ${unchecked} answered but not checked will be ignored.` : ""}</p>`;
      const ok = await modal({ title: isMock ? "Submit your test?" : "Finish practice?", body,
        buttons: [{ label: "Keep working", value: false }, { label: "Submit", value: true, kind: "primary" }] });
      if (!ok) return;
    }
    finished = true; accrue();
    if (cur >= 0) ev(S[cur], "out");
    try {
      await api.submit(attemptId, S.filter(x => !x.locked).map(payload), Math.round(clock()), Math.round(hiddenMs), auto);
      dropBackup(attemptId); cleanup();
      go(`#/attempt/${attemptId}`);
    } catch (e) {
      finished = false; toast("Could not submit (" + e.message + "). Your answers are kept — check your connection and try again.", "error");
    }
  }

  const timerEl = $("#timer", root);
  function tick() {
    if (finished) return;
    accrue();
    const now = clock();
    if (isMock && limitMs) {
      const left = limitMs - now;
      timerEl.classList.toggle("low", left < 5 * 60000);
      timerEl.textContent = timerHidden ? "Show timer" : `${fmtDur(Math.max(0, left))} left`;
      for (const m of [10, 5, 1]) if (left < m * 60000 && left > (m - 0.5) * 60000 && !warned.has(m)) { warned.add(m); toast(`${m} minute${m > 1 ? "s" : ""} left`, "warn"); }
      if (left <= 0 && Date.now() - lastAuto > 5000) { lastAuto = Date.now(); finish(true); }
    } else {
      accrue();
      const it = S[cur];
      timerEl.classList.toggle("low", it && !it.locked && it.time_ms > targetMs);
      timerEl.textContent = timerHidden ? "Show timer" : `This question ${fmtDur(it?.time_ms || 0)} · target ${fmtDur(targetMs)}`;
    }
  }
  timerEl.onclick = () => { timerHidden = !timerHidden; pref("timerHidden", timerHidden); tick(); };

  root.addEventListener("click", e => {
    const t = e.target.closest("[data-pick],[data-cross],[data-go],[data-bub]");
    if (!t) return;
    if (t.dataset.pick) select(cur, t.dataset.pick);
    else if (t.dataset.cross) cross(t.dataset.cross);
    else if (t.dataset.go) { enter(+t.dataset.go); root.querySelector(".exam").classList.remove("sheet-open"); }
    else if (t.dataset.bub) { const [i, L] = t.dataset.bub.split(":"); select(+i, L); }
  });
  root.addEventListener("contextmenu", e => {
    const t = e.target.closest("[data-pick]");
    if (t && !S[cur].locked) { e.preventDefault(); cross(t.dataset.pick); }
  });
  $("#prev", root).onclick = () => cur > 0 && enter(cur - 1);
  $("#next", root).onclick = () => cur < S.length - 1 && enter(cur + 1);
  $("#flag", root).onclick = flag;
  $("#report", root).onclick = () => reportProblem(S[cur].question_id, attemptId);
  $("#finish", root).onclick = () => finish(false);
  $("#sheetToggle", root).onclick = () => root.querySelector(".exam").classList.toggle("sheet-open");
  $("#fontUp", root).onclick = () => { fontScale = Math.min(1.4, +(fontScale + 0.1).toFixed(2)); pref("font", fontScale); draw(); };
  $("#fontDown", root).onclick = () => { fontScale = Math.max(0.8, +(fontScale - 0.1).toFixed(2)); pref("font", fontScale); draw(); };

  const onKey = e => {
    if (finished || document.querySelector(".modal-back") || e.target.closest("input,textarea,select")) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toUpperCase();
    const map = { 1: "A", 2: "B", 3: "C", 4: "D", 5: "E" };
    const L = LETTERS.includes(k) ? k : map[e.key];
    if (L) { e.preventDefault(); e.shiftKey ? cross(L) : select(cur, L); }
    else if (e.key === "ArrowRight" && cur < S.length - 1) { e.preventDefault(); enter(cur + 1); }
    else if (e.key === "ArrowLeft" && cur > 0) { e.preventDefault(); enter(cur - 1); }
    else if (k === "F") flag();
    else if (e.key === "Enter" && !isMock) check();
  };
  const onVis = () => {
    if (finished || cur < 0) return;
    if (document.hidden) { accrue(); hiddenAt = clock(); ev(S[cur], "hide"); save(); }
    else if (hiddenAt != null) { hiddenMs += clock() - hiddenAt; hiddenAt = null; markAt = clock(); lastAct = clock(); idle = false; ev(S[cur], "show"); }
  };
  const onUnload = () => { accrue(); backupNow(); };
  document.addEventListener("keydown", onKey);
  const ACT_EVENTS = ["mousemove", "mousedown", "keydown", "wheel", "scroll", "touchstart"];
  ACT_EVENTS.forEach(t => document.addEventListener(t, activity, { passive: true, capture: true }));
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("beforeunload", onUnload);
  const tickTimer = setInterval(tick, 500);
  const saveTimerI = setInterval(save, SAVE_EVERY_MS);

  function cleanup() {
    clearInterval(tickTimer); clearInterval(saveTimerI); clearTimeout(saveTimer);
    document.removeEventListener("keydown", onKey);
    ACT_EVENTS.forEach(t => document.removeEventListener(t, activity, { capture: true }));
    document.removeEventListener("visibilitychange", onVis);
    window.removeEventListener("beforeunload", onUnload);
  }

  let start = S.findIndex(x => !x.answer && !x.locked); if (start < 0) start = 0;
  enter(start); tick();

  return {
    async destroy() { if (!finished) { accrue(); if (cur >= 0) ev(S[cur], "out"); cur = -1; await save(); } cleanup(); },
  };
}

export async function reportProblem(qid, attemptId) {
  const msg = await modal({
    title: "Report a problem with this question",
    body: `<p class="small muted">E.g. a typo, a missing word or number, a broken picture, or you think the answer is wrong. Your timer keeps running.</p>
      <label>What's wrong?<textarea id="rp" rows="4" maxlength="1000" style="width:100%"></textarea></label>`,
    buttons: [{ label: "Cancel", value: null }, { label: "Send", value: box => $("#rp", box).value.trim(), kind: "primary" }],
  });
  if (!msg) return;
  try { await api.reportQuestion(qid, attemptId, msg); toast("Thanks — your teacher will check it.", "good"); }
  catch (e) { toast(e.message, "error"); }
}
