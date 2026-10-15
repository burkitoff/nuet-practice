import { REVIEWS } from "./reviews.js";

const T = {
  en: {
    title: "NUET Oqy — NUET preparation",
    "nav.login": "Log in",
    "gate.tag": "Train your aim.",
    "gate.sub": "The NUET preparation platform",
    "gate.login": "Log in to the platform",
    "gate.continue": "Go to the platform",
    "gate.note": "Your teacher gives you your account.",
    "gate.noteIn": "You're already signed in.",
    "gate.discover": "New here? Discover NUET Oqy",
    "how.title": "How do you get a high score on the NUET?",
    "how.lead": "Three things. We do all of them with every student.",
    "p1.t": "Know exactly where you lose points",
    "p1.d": "A diagnostic shows your weak question types and where your minutes go.",
    "p2.t": "A method for every question type",
    "p2.d": "How to think through each one — not just more practice.",
    "p3.t": "Progress you can see",
    "p3.d": "Every mistake is reviewed and tracked on the platform.",
    "how.cta": "Get a free diagnostic",
    "rev.title": "Our students' results",
    "rev.sub": "About 90% of our students get into NU. The other 10%? They chose to study abroad.",
    "rev.prev": "Previous review",
    "rev.next": "Next review",
    "rev.ct": "Critical Thinking",
    "rev.nuet": "NUET result",
    "rev.ctOnly": "Prepared with us: Critical Thinking only",
    "rev.admitted": "Admitted to NU",
    "rev.admittedSub": "Foundation Year · grant",
    "rev.official": "Official result",
    "rev.open": "Open screenshot",
    "rev.close": "Close",
    "join.title": "Sign up for a <mark>free</mark> diagnostic",
    "join.lead": "We'll find where you lose points and what to work on first.",
    "join.tg": "Message us on Telegram",
    "join.tgnote": "Opens a chat with the teacher.",
    "join.tgtext": "Hi! I'd like to sign up for a free diagnostic.",
    "foot.tg": "Telegram channel",
    "foot.login": "Platform login"
  },
  ru: {
    title: "NUET Oqy — подготовка к NUET",
    "nav.login": "Войти",
    "gate.tag": "Тренируй точность.",
    "gate.sub": "Платформа для подготовки к NUET",
    "gate.login": "Войти на платформу",
    "gate.continue": "Перейти на платформу",
    "gate.note": "Аккаунт выдаёт преподаватель.",
    "gate.noteIn": "Вы уже вошли в аккаунт.",
    "gate.discover": "Впервые здесь? Узнайте о NUET Oqy",
    "how.title": "Как получить высокий балл на NUET?",
    "how.lead": "Три вещи — и мы делаем их с каждым учеником.",
    "p1.t": "Узнайте, где именно вы теряете баллы",
    "p1.d": "Диагностика покажет слабые типы вопросов и то, куда уходят ваши минуты.",
    "p2.t": "Метод для каждого типа вопросов",
    "p2.d": "Как рассуждать в каждом из них — а не просто больше практики.",
    "p3.t": "Прогресс, который видно",
    "p3.d": "Каждую ошибку разбираем и отслеживаем на платформе.",
    "how.cta": "Пройти бесплатную диагностику",
    "rev.title": "Результаты наших учеников",
    "rev.sub": "Около 90% наших учеников поступают в NU. Остальные 10%? Они выбрали учёбу за границей.",
    "rev.prev": "Предыдущий отзыв",
    "rev.next": "Следующий отзыв",
    "rev.ct": "Critical Thinking",
    "rev.nuet": "Результат NUET",
    "rev.ctOnly": "Подготовка с нами: только Critical Thinking",
    "rev.admitted": "Поступление в NU",
    "rev.admittedSub": "Foundation Year · грант",
    "rev.official": "Официальный результат",
    "rev.open": "Открыть скриншот",
    "rev.close": "Закрыть",
    "join.title": "Запишитесь на <mark>бесплатную</mark> диагностику",
    "join.lead": "Мы найдём, где вы теряете баллы, и с чего начать работу.",
    "join.tg": "Написать в Telegram",
    "join.tgnote": "Откроется чат с преподавателем.",
    "join.tgtext": "Здравствуйте! Хочу записаться на бесплатную диагностику.",
    "foot.tg": "Канал в Telegram",
    "foot.login": "Вход на платформу"
  }
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} }
};

const signedIn = (() => {
  try { return Object.keys(localStorage).some(k => /^sb-.+-auth-token$/.test(k) && localStorage.getItem(k)); }
  catch { return false; }
})();

function pickLang() {
  const q = new URLSearchParams(location.search).get("lang");
  if (q === "en" || q === "ru") return q;
  const saved = store.get("nuetoqy-lang");
  if (saved === "en" || saved === "ru") return saved;
  return (navigator.languages || [navigator.language || "en"]).some(l => /^(ru|kk)/i.test(l)) ? "ru" : "en";
}

let lang = pickLang();
const t = k => T[lang][k] ?? T.en[k] ?? k;

function applyLang(next) {
  lang = next;
  document.documentElement.lang = lang;
  document.title = t("title");
  $$("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$("[data-i18n-html]").forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  $$("[data-i18n-label]").forEach(el => el.setAttribute("aria-label", t(el.dataset.i18nLabel)));
  $$(".lang button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  if (signedIn) { $("#enter").textContent = t("gate.continue"); $("#enterNote").textContent = t("gate.noteIn"); }
  $("#tgDm").href = "https://t.me/burkitoff?text=" + encodeURIComponent(t("join.tgtext"));
}

$$(".lang button").forEach(b => b.addEventListener("click", () => { store.set("nuetoqy-lang", b.dataset.lang); applyLang(b.dataset.lang); }));

const bar = $("#bar");
new IntersectionObserver(([e]) => bar.classList.toggle("solid", !e.isIntersecting), { rootMargin: "-40% 0px 0px 0px" }).observe($(".gate-in"));

$$('a[href^="#"]').forEach(a => a.addEventListener("click", e => {
  const id = a.getAttribute("href");
  const el = id === "#top" ? document.body : $(id);
  if (!el) return;
  e.preventDefault();
  if (id === "#top") window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  else el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  history.replaceState(null, "", location.pathname + location.search);
}));

function buildRain() {
  const box = $(".rain");
  const n = innerWidth < 700 ? 9 : 16;
  let html = "";
  for (let i = 0; i < n; i++) {
    const x = ((i + .5) / n) * 100 + (Math.sin(i * 12.9898) * 43758.5453 % 1) * 6;
    const s = .55 + (Math.abs(Math.sin(i * 4.1)) * .6);
    const d = 6 + Math.abs(Math.sin(i * 7.7)) * 4;
    html += `<i style="--x:${x.toFixed(1)}%;--s:${s.toFixed(2)};--d:${d.toFixed(1)}s;--delay:${(-d * ((i * .37) % 1)).toFixed(1)}s"><svg viewBox="0 0 120 24"><use href="#i-arrow"/></svg></i>`;
  }
  box.innerHTML = html;
  new IntersectionObserver(([e]) => box.classList.toggle("on", e.isIntersecting && !reduce)).observe($("#reviews"));
}

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function card(r, clone) {
  const tab = clone ? ' tabindex="-1"' : "";
  const chip = r.score && r.image ? `<span class="rv-chip" data-i18n="rev.official"></span>` : "";
  const shot = r.image ? `<button type="button" class="rv-shot"${tab} data-src="${esc(r.image)}" data-i18n-label="rev.open"><img src="${esc(r.thumb || r.image)}" alt="" loading="lazy" decoding="async">${chip}</button>` : "";
  const ring = r.image ? "" : `<svg class="rv-ring" aria-hidden="true"><use href="#i-hit"/></svg>`;
  const score = r.score ? `<p class="rv-score" data-v="${Number(r.score) || 0}">${esc(r.score)}</p><p class="rv-label" data-i18n="rev.ct"></p>` : "";
  const sub = r.score && !r.image ? `<p class="rv-sub" data-i18n="rev.nuet"></p>` : "";
  const note = r.ctOnly ? `<p class="rv-sub" data-i18n="rev.ctOnly"></p>` : "";
  const tag = r.tag === "admission" ? `<p class="rv-label big" data-i18n="rev.admitted"></p><p class="rv-sub" data-i18n="rev.admittedSub"></p>` : "";
  const text = r.text ? `<blockquote class="rv-text">${esc(r.text)}</blockquote>` : "";
  const who = r.name || r.detail ? `<p class="rv-who">${r.name ? `<b>${esc(r.name)}</b>` : ""}${r.detail ? `<span>${esc(r.detail)}</span>` : ""}</p>` : "";
  const kind = r.tag === "admission" ? "win" : r.image ? "img" : r.score ? "num" : "quote";
  return `<li class="rv rv-${kind}"${clone ? ' aria-hidden="true"' : ""}>${shot}${ring}<div class="rv-body">${score}${sub}${note}${tag}${text}${who}</div></li>`;
}

function buildCarousel() {
  if (!REVIEWS.length) return;
  const car = $("#carousel"), track = $("#track"), lb = $("#lightbox");
  car.hidden = false;
  const loop = !reduce && REVIEWS.length > 2;
  track.innerHTML = REVIEWS.map(r => card(r, false)).join("") + (loop ? REVIEWS.map(r => card(r, true)).join("") : "");
  if (!loop) car.classList.add("static");

  const SPEED = 38;
  let half = 0, pos = 0, last = 0, visible = false, hover = false, holdUntil = 0, raf = 0;
  const items = $$(".rv", track);
  let centers = [], vw = 1, tiltRaf = 0, counted = false;
  const zs = [];
  const measure = () => {
    half = track.scrollWidth / 2; vw = track.clientWidth;
    centers = items.map(it => it.offsetLeft + it.offsetWidth / 2);
  };
  const tilt = x => {
    const mid = x + vw / 2, span = Math.max(vw * .6, 320);
    for (let i = 0; i < items.length; i++) {
      const d = (centers[i] - mid) / span;
      if (d < -2.2 || d > 2.2) continue;
      const a = Math.max(-1.6, Math.min(1.6, d)), m = Math.abs(a);
      items[i].style.transform = `translate3d(0,0,${(-m * 90).toFixed(1)}px) rotateY(${(-a * 18).toFixed(2)}deg) scale(${(1.05 - Math.min(m, 1) * .1).toFixed(3)})`;
      const z = 100 - Math.round(m * 24);
      if (zs[i] !== z) { zs[i] = z; items[i].style.zIndex = z; }
    }
  };
  const hold = ms => { holdUntil = performance.now() + ms; };
  const step = now => {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min(50, now - (last || now)); last = now;
    if (hover || now < holdUntil || lb.open) pos = track.scrollLeft;
    else {
      if (Math.abs(track.scrollLeft - pos) > 3) pos = track.scrollLeft;
      pos += SPEED * dt / 1000;
      if (pos >= half) pos -= half;
      if (pos < 1) pos += half;
      track.scrollLeft = pos;
    }
    tilt(pos);
    raf = requestAnimationFrame(step);
  };
  const countUp = () => {
    if (counted || reduce) return;
    counted = true;
    const els = $$(".rv-score", track), vals = els.map(e => +e.dataset.v), t0 = performance.now();
    const f = now => {
      const k = Math.min(1, (now - t0) / 1400), e = 1 - Math.pow(1 - k, 3);
      els.forEach((el, i) => { el.textContent = Math.round(vals[i] * e); });
      if (k < 1) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  };
  new IntersectionObserver(([e]) => { if (e.isIntersecting) countUp(); }, { threshold: .35 }).observe(car);
  const run = () => { if (loop && !raf && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(step); } };

  measure();
  tilt(track.scrollLeft);
  addEventListener("resize", () => { measure(); tilt(track.scrollLeft); });
  track.addEventListener("scroll", () => { if (!raf && !tiltRaf) tiltRaf = requestAnimationFrame(() => { tiltRaf = 0; tilt(track.scrollLeft); }); }, { passive: true });
  addEventListener("load", () => { measure(); tilt(track.scrollLeft); });
  if (loop) {
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; run(); }, { threshold: .2 }).observe(car);
    document.addEventListener("visibilitychange", run);
    car.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") hover = true; });
    car.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") hover = false; });
    track.addEventListener("touchstart", () => hold(2500), { passive: true });
    track.addEventListener("touchend", () => hold(1800), { passive: true });
    track.addEventListener("wheel", e => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) hold(2000); }, { passive: true });
    car.addEventListener("focusin", () => hold(6000));
  }
  const nudge = dir => {
    const it = $(".rv", track);
    hold(2600);
    track.scrollBy({ left: dir * (it.offsetWidth + 18), behavior: reduce ? "auto" : "smooth" });
  };
  $("#prev").onclick = () => nudge(-1);
  $("#next").onclick = () => nudge(1);

  track.addEventListener("click", e => {
    const b = e.target.closest(".rv-shot");
    if (!b) return;
    $("img", lb).src = b.dataset.src;
    lb.showModal();
  });
  lb.addEventListener("click", () => lb.close());
  lb.addEventListener("close", () => hold(1500));
}

buildRain();
buildCarousel();
applyLang(lang);
