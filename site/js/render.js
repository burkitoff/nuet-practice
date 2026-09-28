import { esc } from "./util.js";
import { CONFIG } from "./config.js";

const SCALE = CONFIG.IMAGE_SCALE || 0.35;
const sizeStyle = m => (m && m.w ? ` style="--w:${Math.round(m.w * SCALE)}px"` : "");

if (typeof document !== "undefined") {
  document.addEventListener("load", e => {
    const img = e.target;
    if (img.tagName === "IMG" && img.dataset.fit === "1" && !img.style.getPropertyValue("--w") && img.naturalWidth)
      img.style.setProperty("--w", Math.round(img.naturalWidth * SCALE) + "px");
  }, true);
}

export const LETTERS = ["A", "B", "C", "D", "E"];

const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

export function mediaPaths(q) {
  const p = (q.media || []).map(m => m.path);
  if (q.snapshot_path) p.push(q.snapshot_path);
  return p;
}

export function hasParsedContent(q) {
  const anyOpt = LETTERS.some(L => (q.options || {})[L]);
  const optPics = (q.media || []).filter(m => m.position === "options" && m.letter).length;
  return (q.stem || "").trim() && (anyOpt || optPics >= 2);
}

export function renderQuestion(q, urls, o = {}) {
  const crossed = o.crossed || new Set();
  const media = q.media || [];
  const img = (m, cls) => `<img class="${cls}" data-fit="1"${sizeStyle(m)} src="${esc(urls[m.path] || "")}" alt="${m.kind === "table" ? "table" : "diagram"}">`;

  let stemHtml;
  if (!hasParsedContent(q) && q.snapshot_path) {
    const snap = (q.media || []).find(m => m.position === "snapshot") || { path: q.snapshot_path };
    stemHtml = `<div class="q-snapshot">${img(snap, "")}</div>`;
  } else {
    const paras = (q.stem || "").split("\n").filter(p => p.trim());
    const byIdx = {};
    media.filter(m => m.position === "stem").sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).forEach(m => {
      let i = m.line_index; if (i == null || i > paras.length) i = paras.length;
      (byIdx[i] = byIdx[i] || []).push(m);
    });
    const blocks = [];
    const addMedia = i => (byIdx[i] || []).forEach(m => blocks.push(`<figure class="q-media ${m.kind === "table" ? "is-table" : ""}">${img(m, "")}</figure>`));
    paras.forEach((p, i) => { addMedia(i); blocks.push(`<p>${inline(p)}</p>`); });
    addMedia(paras.length);
    stemHtml = blocks.join("");
  }

  const optMedia = Object.fromEntries(media.filter(m => m.position === "options" && m.letter).map(m => [m.letter, m]));
  const pictures = !LETTERS.some(L => (q.options || {})[L]) && Object.keys(optMedia).length > 0;
  const snapshotOnly = !hasParsedContent(q) && q.snapshot_path;

  const opts = LETTERS.map(L => {
    const text = (q.options || {})[L];
    const m = optMedia[L];
    const cls = ["opt"];
    if (o.answer === L) cls.push("is-chosen");
    if (crossed.has(L)) cls.push("is-crossed");
    if (o.correct) {
      if (L === o.correct) cls.push("is-correct");
      else if (L === o.answer) cls.push("is-wrong");
    }
    const body = snapshotOnly ? "" :
      `${text ? `<span class="opt-text">${inline(text)}</span>` : ""}${m ? `<span class="opt-pic">${img(m, "")}</span>` : ""}`;
    const cross = o.interactive ? `<button type="button" class="opt-cross" data-cross="${L}" title="Cross out ${L} (Shift+${L})" aria-label="Cross out option ${L}">✕</button>` : "";
    return `<li class="${cls.join(" ")}" data-letter="${L}">
      <button type="button" class="opt-main" data-pick="${L}" ${o.interactive ? "" : "disabled"} aria-pressed="${o.answer === L}">
        <span class="opt-letter">${L}</span>${body}
      </button>${cross}</li>`;
  }).join("");

  return `<article class="paper-q">
    <div class="q-num">${o.number ?? ""}</div>
    <div class="q-body">
      <div class="q-stem">${stemHtml}</div>
      <ol class="opts ${pictures ? "opts-pictures" : ""} ${snapshotOnly ? "opts-compact" : ""}">${opts}</ol>
    </div>
  </article>`;
}
