export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function html(strings, ...vals) {
  return strings.reduce((out, s, i) => {
    let v = i < vals.length ? vals[i] : "";
    if (Array.isArray(v)) v = v.map(x => (x && x.__raw !== undefined ? x.__raw : esc(x))).join("");
    else if (v && v.__raw !== undefined) v = v.__raw;
    else v = esc(v);
    return out + s + v;
  }, "");
}
export const raw = s => ({ __raw: String(s) });

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v;
    else if (k === "class") el.className = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(k));
  return el;
}

export function fmtDur(ms, { sec = true } = {}) {
  if (ms == null || isNaN(ms)) return "–";
  const neg = ms < 0; ms = Math.abs(ms);
  const s = Math.round(ms / 1000), m = Math.floor(s / 60), hr = Math.floor(m / 60);
  let out = hr ? `${hr}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : `${m}:${String(s % 60).padStart(2, "0")}`;
  if (!sec) out = hr ? `${hr}h ${m % 60}m` : `${m}m`;
  return (neg ? "−" : "") + out;
}
export const fmtSec = ms => (ms == null ? "–" : `${Math.round(ms / 1000)}s`);
export const pct = (a, b) => (b ? Math.round((100 * a) / b) : null);
export const fmtPct = v => (v == null ? "–" : `${v}%`);
export function fmtDate(iso, withTime = true) {
  if (!iso) return "–";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) +
    (withTime ? " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "");
}
export const median = arr => {
  const a = arr.filter(x => x != null).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
export const mean = arr => { const a = arr.filter(x => x != null); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };

export function toast(msg, kind = "info") {
  const t = h("div", { class: `toast toast-${kind}`, role: "status" }, msg);
  document.body.append(t);
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, kind === "error" ? 6000 : 3000);
}

export function modal({ title, body, buttons = [{ label: "OK", value: true, kind: "primary" }], wide = false, onOpen = null }) {
  return new Promise(resolve => {
    const back = h("div", { class: "modal-back" });
    const box = h("div", { class: "modal" + (wide ? " modal-wide" : ""), role: "dialog", "aria-modal": "true" });
    box.append(h("h2", {}, title));
    const b = h("div", { class: "modal-body" }); typeof body === "string" ? (b.innerHTML = body) : b.append(body);
    box.append(b);
    const close = v => { back.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
    const row = h("div", { class: "modal-buttons" },
      buttons.map(bt => h("button", { class: `btn ${bt.kind ? "btn-" + bt.kind : ""}`, onclick: () => close(typeof bt.value === "function" ? bt.value(box) : bt.value) }, bt.label)));
    box.append(row); back.append(box); document.body.append(back);
    const onKey = e => { if (e.key === "Escape") close(null); };
    document.addEventListener("keydown", onKey);
    if (onOpen) onOpen(box);
    (box.querySelector("input,select,textarea") || row.lastChild)?.focus();
  });
}

export function randomPassword(n = 10) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const a = new Uint32Array(n); crypto.getRandomValues(a);
  return [...a].map(x => chars[x % chars.length]).join("");
}

export function downloadCsv(name, rows) {
  const csv = rows.map(r => r.map(v => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(",")).join("\n");
  const a = h("a", { href: URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" })), download: name });
  document.body.append(a); a.click(); a.remove();
}
