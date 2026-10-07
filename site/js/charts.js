import { esc, fmtDur } from "./util.js";

const C = { correct: "var(--good)", wrong: "var(--bad)", blank: "var(--muted-2)", line: "var(--accent)", grid: "var(--grid)", ink: "var(--ink-2)" };

const STEPS = [5e3, 1e4, 15e3, 3e4, 6e4, 12e4, 3e5, 6e5, 9e5, 18e5, 36e5, 72e5, 108e5, 216e5, 432e5, 864e5, 1728e5, 6048e5];
const stepFor = (span, max) => STEPS.find(s => span / s <= max) || Math.ceil(span / max / 864e5) * 864e5;

export function fmtAxis(ms) {
  const s = Math.round(ms / 1000), m = Math.floor(s / 60), hr = Math.floor(m / 60), d = Math.floor(hr / 24);
  if (s % 60 && s < 600) return `${m}:${String(s % 60).padStart(2, "0")}`;
  if (m < 60) return `${m}m`;
  if (hr < 24) return m % 60 ? `${hr}h${String(m % 60).padStart(2, "0")}` : `${hr}h`;
  return hr % 24 ? `${d}d ${hr % 24}h` : `${d}d`;
}

function fmtAway(ms) {
  const m = Math.round(ms / 60000), hr = Math.floor(m / 60), d = Math.floor(hr / 24);
  if (hr < 1) return `${m}m`;
  if (d < 1) return m % 60 ? `${hr}h ${m % 60}m` : `${hr}h`;
  return hr % 24 ? `${d}d ${hr % 24}h` : `${d}d`;
}

export function timelineChart({ segs, marks, gaps = [] }, { total, limitMs, width = 760 }) {
  const H = Math.max(180, Math.min(520, total * 14 + 50));
  const pad = { l: 38, r: 12, t: 12, b: 30 };
  const end = Math.max(limitMs || 0, ...segs.map(s => s.t1), ...marks.map(m => m.t), 60000);
  const breaks = limitMs ? [] : gaps.filter(g => g.b <= end);
  const awayMs = breaks.reduce((s, g) => s + g.b - g.a, 0);
  const B = breaks.length ? Math.max(5000, (end - awayMs) * 0.05) : 0;
  const shown = t => {
    let off = 0;
    for (const g of breaks) {
      if (t >= g.b) off += g.b - g.a - B;
      else if (t > g.a) return g.a - off + ((t - g.a) / (g.b - g.a)) * B;
      else break;
    }
    return t - off;
  };
  const span = shown(end);
  const active = t => shown(t) - B * breaks.filter(k => k.b <= t).length;
  const x = t => pad.l + (shown(t) / span) * (width - pad.l - pad.r);
  const y = p => pad.t + ((p - 0.5) / total) * (H - pad.t - pad.b);
  let g = "";
  const step = stepFor(span - B * breaks.length, 8);
  const ranges = [];
  let from = 0;
  for (const k of breaks) { ranges.push([from, k.a]); from = k.b; }
  ranges.push([from, end]);
  let lastX = -1e9;
  for (const [r0, r1] of ranges) {
    const a0 = active(r0);
    for (let ta = Math.ceil(a0 / step) * step; ta <= a0 + r1 - r0; ta += step) {
      const px = x(r0 + ta - a0);
      if (px - lastX < 40) continue;
      lastX = px;
      g += `<line x1="${px}" x2="${px}" y1="${pad.t}" y2="${H - pad.b}" stroke="${C.grid}"/>` +
        `<text x="${px}" y="${H - 10}" text-anchor="middle" class="ax">${fmtAxis(ta)}</text>`;
    }
  }
  const yStep = total > 30 ? 10 : 5;
  for (let p = 1; p <= total; p += p === 1 ? yStep - 1 : yStep)
    g += `<text x="${pad.l - 6}" y="${y(p) + 4}" text-anchor="end" class="ax">${p}</text>`;
  if (limitMs) {
    g += `<line x1="${x(0)}" y1="${y(1)}" x2="${x(limitMs)}" y2="${y(total)}" stroke="var(--muted-2)" stroke-dasharray="5 4"><title>Even pace</title></line>`;
    g += `<line x1="${x(limitMs)}" x2="${x(limitMs)}" y1="${pad.t}" y2="${H - pad.b}" stroke="var(--bad)" stroke-dasharray="2 3"/>`;
  }
  let d = "";
  segs.forEach((s, i) => { d += `${i ? "L" : "M"}${x(s.t0).toFixed(1)},${y(s.pos).toFixed(1)} L${x(s.t1).toFixed(1)},${y(s.pos).toFixed(1)} `; });
  g += `<path d="${d}" fill="none" stroke="${C.line}" stroke-width="2" stroke-linejoin="round"/>`;
  segs.forEach(s => {
    g += `<line x1="${x(s.t0)}" x2="${Math.max(x(s.t1), x(s.t0) + 1.5)}" y1="${y(s.pos)}" y2="${y(s.pos)}" stroke="${C.line}" stroke-width="5" stroke-linecap="round"><title>Q${s.pos}: ${fmtDur(active(s.t0))}–${fmtDur(active(s.t1))}</title></line>`;
  });
  breaks.forEach(k => {
    const x0 = x(k.a), x1 = x(k.b), cx = (x0 + x1) / 2, cy = (pad.t + H - pad.b) / 2, z = 4;
    const label = `away ${fmtAway(k.b - k.a)}`;
    g += `<g class="gap"><title>Away for ${fmtAway(k.b - k.a)} (not counted)</title>` +
      `<rect x="${x0}" y="${pad.t - 4}" width="${x1 - x0}" height="${H - pad.b - pad.t + 8}" fill="var(--surface)"/>` +
      `<path d="M${x0},${pad.t - 4} l${-z},${z * 2} l${z * 2},${z * 2} l${-z * 2},${z * 2}" fill="none" stroke="var(--line-2)"/>` +
      `<line x1="${x0}" x2="${x0}" y1="${pad.t}" y2="${H - pad.b}" stroke="var(--line-2)" stroke-dasharray="3 3"/>` +
      `<line x1="${x1}" x2="${x1}" y1="${pad.t}" y2="${H - pad.b}" stroke="var(--line-2)" stroke-dasharray="3 3"/>` +
      `<text x="${cx}" y="${cy}" transform="rotate(-90 ${cx} ${cy})" text-anchor="middle" dominant-baseline="central" class="ax">${esc(label)}</text></g>`;
  });
  marks.forEach(m => {
    const col = m.correct == null ? C.ink : m.correct ? C.correct : C.wrong;
    g += `<circle cx="${x(m.t)}" cy="${y(m.pos)}" r="4" fill="${col}" stroke="var(--surface)" stroke-width="1.5"><title>Q${m.pos}: chose ${esc(m.v)} at ${fmtDur(active(m.t))}</title></circle>`;
  });
  return `<svg class="chart" viewBox="0 0 ${width} ${H}" role="img" aria-label="Timeline of the attempt">${g}</svg>`;
}

export function timeBars(items, { targetMs, width = 760, height = 200, onLabel = i => i.position }) {
  const pad = { l: 38, r: 8, t: 10, b: 26 };
  const n = items.length || 1;
  const maxT = Math.max(targetMs * 2.2, ...items.map(i => i.time_ms), 1);
  const bw = (width - pad.l - pad.r) / n;
  const y = v => height - pad.b - (v / maxT) * (height - pad.t - pad.b);
  let g = "";
  const step = stepFor(maxT, 6);
  for (let t = 0; t <= maxT; t += step)
    g += `<line x1="${pad.l}" x2="${width - pad.r}" y1="${y(t)}" y2="${y(t)}" stroke="${C.grid}"/><text x="${pad.l - 6}" y="${y(t) + 4}" text-anchor="end" class="ax">${fmtAxis(t)}</text>`;
  items.forEach((it, i) => {
    const col = it.status === "correct" ? C.correct : it.status === "wrong" ? C.wrong : C.blank;
    const x0 = pad.l + i * bw + bw * 0.15, w = Math.max(1, bw * 0.7);
    g += `<rect x="${x0}" y="${y(it.time_ms)}" width="${w}" height="${Math.max(0, height - pad.b - y(it.time_ms))}" rx="2" fill="${col}"><title>Q${onLabel(it)}: ${fmtDur(it.time_ms)} — ${it.status}</title></rect>`;
    if (n <= 30 || i % 5 === 4) g += `<text x="${x0 + w / 2}" y="${height - 8}" text-anchor="middle" class="ax">${onLabel(it)}</text>`;
  });
  g += `<line x1="${pad.l}" x2="${width - pad.r}" y1="${y(targetMs)}" y2="${y(targetMs)}" stroke="var(--ink)" stroke-dasharray="5 4"><title>Target ${fmtDur(targetMs)}</title></line>`;
  g += `<text x="${width - pad.r}" y="${y(targetMs) - 5}" text-anchor="end" class="ax">target ${fmtDur(targetMs)}</text>`;
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Time per question">${g}</svg>`;
}

export function lineChart(points, { width = 760, height = 180, label = v => v + "%" } = {}) {
  if (!points.length) return `<p class="muted">No data yet.</p>`;
  const pad = { l: 38, r: 16, t: 14, b: 28 };
  const x = i => pad.l + (points.length === 1 ? (width - pad.l - pad.r) / 2 : (i / (points.length - 1)) * (width - pad.l - pad.r));
  const y = v => height - pad.b - (v / 100) * (height - pad.t - pad.b);
  let g = "";
  for (const v of [0, 25, 50, 75, 100])
    g += `<line x1="${pad.l}" x2="${width - pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="${C.grid}"/><text x="${pad.l - 6}" y="${y(v) + 4}" text-anchor="end" class="ax">${v}</text>`;
  g += `<polyline points="${points.map((p, i) => `${x(i)},${y(p.v)}`).join(" ")}" fill="none" stroke="${C.line}" stroke-width="2.5"/>`;
  points.forEach((p, i) => {
    g += `<circle cx="${x(i)}" cy="${y(p.v)}" r="4.5" fill="${C.line}" stroke="var(--surface)" stroke-width="2"><title>${esc(p.title || "")}: ${label(p.v)}</title></circle>`;
    if (points.length <= 12) g += `<text x="${x(i)}" y="${height - 8}" text-anchor="middle" class="ax">${esc(p.x)}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Trend">${g}</svg>`;
}

export function accBar(acc) {
  if (acc == null) return "–";
  const col = acc >= 70 ? "var(--good)" : acc >= 45 ? "var(--warn)" : "var(--bad)";
  return `<span class="accbar"><span style="width:${acc}%;background:${col}"></span></span><span class="accnum">${acc}%</span>`;
}

export function ratioPill(r) {
  if (r == null) return "–";
  const cls = r > 1.5 ? "pill-bad" : r > 1.1 ? "pill-warn" : r < 0.5 ? "pill-warn" : "pill-good";
  return `<span class="pill ${cls}">${r.toFixed(2)}×</span>`;
}
