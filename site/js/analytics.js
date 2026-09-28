import { CONFIG } from "./config.js";
import { mean, median, pct } from "./util.js";

export const RUSH_FRACTION = 0.4;
export const STUCK_FACTOR = 2;

export function targetMs(attempt) {
  if (attempt.mode === "mock" && attempt.time_limit_sec && attempt.total) return (attempt.time_limit_sec * 1000) / attempt.total;
  return CONFIG.PRACTICE_TARGET_SEC * 1000;
}

export function deriveItems(attempts, items, qmeta = {}) {
  const byId = Object.fromEntries(attempts.map(a => [a.id, a]));
  const out = [];
  for (let it of items) {
    const a = byId[it.attempt_id];
    if (!a) continue;
    if (a.mode === "practice" && !it.locked) continue;
    if (it.excluded || a.excluded) continue;
    const q = qmeta[it.question_id] || {};
    const target = targetMs(a);
    const answered = !!it.answer;
    const sels = (it.events || []).filter(e => e.e === "sel").map(e => e.v);
    const first = sels[0] ?? (answered ? it.answer : null);
    const key = it.correct_answer;
    let change = null;
    if (key && first && answered && it.changes > 0 && first !== it.answer) {
      const f = first === key, l = it.answer === key;
      change = f && !l ? "RW" : !f && l ? "WR" : "WW";
    }
    const ev = it.events || [];
    const firstOut = ev.findIndex(e => e.e === "out");
    const firstSel = ev.findIndex(e => e.e === "sel");
    const skippedFirst = answered && firstOut >= 0 && (firstSel < 0 || firstSel > firstOut);
    const status = it.is_correct ? "correct" : answered ? "wrong" : "blank";
    const rawMs = it.time_ms;
    it = { ...it, time_ms: it.time_override_ms ?? it.time_ms };
    out.push({
      ...it, raw_time_ms: rawMs, attempt: a, mode: a.mode, target, status,
      category: q.category || "?", subcategory: q.subcategory || (q.category ? q.category + ":untagged" : "untagged"), skills: q.skills || [], exam_code: q.exam_code,
      rushed: answered && !it.is_correct && it.time_ms < target * RUSH_FRACTION,
      stuck: it.time_ms > target * STUCK_FACTOR,
      overTarget: it.time_ms > target,
      change, skippedFirst,
      ratio: it.time_ms / target,
      decisionMs: it.first_answer_ms != null && it.first_seen_ms != null && it.first_answer_ms >= it.first_seen_ms ? it.first_answer_ms - it.first_seen_ms : null,
    });
  }
  return out;
}

export function summarize(ds) {
  const n = ds.length;
  const correct = ds.filter(d => d.status === "correct").length;
  const answered = ds.filter(d => d.status !== "blank").length;
  const wrong = ds.filter(d => d.status === "wrong");
  return {
    n, correct, answered, blanks: n - answered,
    acc: pct(correct, n),
    avgMs: mean(ds.map(d => d.time_ms)),
    medMs: median(ds.map(d => d.time_ms)),
    avgRatio: mean(ds.map(d => d.ratio)),
    avgCorrectMs: mean(ds.filter(d => d.status === "correct").map(d => d.time_ms)),
    avgWrongMs: mean(wrong.map(d => d.time_ms)),
    rushed: ds.filter(d => d.rushed).length,
    stuck: ds.filter(d => d.stuck).length,
    overTarget: ds.filter(d => d.overTarget).length,
    rw: ds.filter(d => d.change === "RW").length,
    wr: ds.filter(d => d.change === "WR").length,
    ww: ds.filter(d => d.change === "WW").length,
    changed: ds.filter(d => d.changes > 0).length,
    flagged: ds.filter(d => d.flagged).length,
    wastedMs: wrong.reduce((s, d) => s + d.time_ms, 0),
  };
}

export function groupBy(ds, keyFn) {
  const m = new Map();
  for (const d of ds) {
    const keys = [].concat(keyFn(d)).filter(k => k != null && k !== "");
    for (const k of keys) { if (!m.has(k)) m.set(k, []); m.get(k).push(d); }
  }
  return m;
}

export function timeline(items) {
  const segs = [], marks = [];
  for (let it of items) {
    let open = null;
    for (const e of it.events || []) {
      if (e.e === "in") open = e.t;
      else if (e.e === "out" && open != null) { segs.push({ pos: it.position, t0: open, t1: e.t }); open = null; }
      else if (e.e === "sel") marks.push({ pos: it.position, t: e.t, v: e.v, correct: it.correct_answer ? e.v === it.correct_answer : null });
    }
    if (open != null) segs.push({ pos: it.position, t0: open, t1: open });
  }
  segs.sort((a, b) => a.t0 - b.t0);
  return { segs, marks };
}

export function byThirds(ds) {
  const res = [[], [], []];
  for (const d of ds.filter(x => x.mode === "mock")) {
    const i = Math.min(2, Math.floor(((d.position - 1) / d.attempt.total) * 3));
    res[i].push(d);
  }
  return res.map((g, i) => ({ label: ["First third", "Middle third", "Last third"][i], ...summarize(g) }));
}

export function mockTrend(attempts, ds) {
  return attempts.filter(a => a.mode === "mock" && a.status === "submitted")
    .sort((a, b) => a.started_at.localeCompare(b.started_at))
    .map(a => {
      const its = ds.filter(d => d.attempt_id === a.id);
      const s = summarize(its);
      return { attempt: a, date: a.started_at, scorePct: pct(a.score, a.total), usedMs: its.reduce((x, d) => x + d.time_ms, 0), ...s };
    });
}

export function insights(ds, labels = {}) {
  const out = [];
  const s = summarize(ds);
  if (s.n < 5) return out;
  const name = c => labels[c] || c;
  const subs = [...groupBy(ds, d => d.subcategory)].map(([k, g]) => ({ k, ...summarize(g) })).filter(x => x.n >= 3);
  const weakest = [...subs].sort((a, b) => a.acc - b.acc)[0];
  if (weakest && weakest.acc < (s.acc ?? 100) - 10)
    out.push({ kind: "bad", text: `Weakest area: ${name(weakest.k)} — ${weakest.acc}% correct vs ${s.acc}% overall.` });
  const slowest = [...subs].sort((a, b) => b.avgRatio - a.avgRatio)[0];
  if (slowest && slowest.avgRatio > 1.25)
    out.push({ kind: "warn", text: `${name(slowest.k)} questions take you ${slowest.avgRatio.toFixed(1)}× the target time on average.` });
  if (s.rushed / s.n >= 0.1)
    out.push({ kind: "warn", text: `${s.rushed} answer${s.rushed > 1 ? "s" : ""} (${pct(s.rushed, s.n)}%) were wrong after very little time — slow down on the first read.` });
  if (s.stuck / s.n >= 0.1)
    out.push({ kind: "warn", text: `${s.stuck} question${s.stuck > 1 ? "s" : ""} (${pct(s.stuck, s.n)}%) took more than ${STUCK_FACTOR}× the target — practise moving on and coming back.` });
  if (s.rw + s.wr >= 3) {
    if (s.rw > s.wr) out.push({ kind: "bad", text: `Second-guessing costs you: ${s.rw} answers changed from right to wrong, only ${s.wr} from wrong to right.` });
    else out.push({ kind: "good", text: `Your answer changes help: ${s.wr} wrong→right vs ${s.rw} right→wrong.` });
  }
  const th = byThirds(ds);
  if (th[2].n >= 5 && th[0].n >= 5 && th[0].acc - th[2].acc >= 15)
    out.push({ kind: "bad", text: `Accuracy drops from ${th[0].acc}% in the first third of a mock to ${th[2].acc}% in the last third — likely time pressure.` });
  if (th[2].n >= 5 && th[2].blanks / th[2].n >= 0.1)
    out.push({ kind: "bad", text: `${th[2].blanks} questions left blank at the end of mocks — you are running out of time.` });
  if (s.avgCorrectMs && s.avgWrongMs && s.avgWrongMs > s.avgCorrectMs * 1.4)
    out.push({ kind: "warn", text: `You spend ${Math.round((s.avgWrongMs / s.avgCorrectMs - 1) * 100)}% longer on questions you get wrong — if a question drags on, guess and move on.` });
  if (!out.length) out.push({ kind: "good", text: "No major problems detected yet — keep going and more patterns will appear." });
  return out;
}

export function questionStats(ds) {
  return [...groupBy(ds, d => d.question_id)].map(([qid, g]) => {
    const dist = { A: 0, B: 0, C: 0, D: 0, E: 0, blank: 0 };
    g.forEach(d => { d.answer ? dist[d.answer]++ : dist.blank++; });
    return { qid, ...summarize(g), dist, category: g[0].category, subcategory: g[0].subcategory, key: g.find(d => d.correct_answer)?.correct_answer };
  });
}
