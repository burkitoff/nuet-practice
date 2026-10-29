import { CONFIG } from "./config.js";

const T = {
  en: {
    title: "Try NUET Oqy free",
    "nav.login": "Log in",
    "hero.title": "Sit a real NUET-format mock. Free.",
    "hero.lead": "A free account gives you Mock 1, two problem-solving runs and a full analysis of every attempt: where your time went, which question types cost you points, and what to work on next.",
    "hero.note": "Free for good. No card, no trial countdown.",
    "cta.create": "Create a free account",
    "cta.login": "Log in",
    "what.title": "What your free account includes",
    "r1.title": "Mock 1, in exam conditions",
    "r1.text": "30 questions in 60 minutes, about half reading and half problem solving, like the NUET Critical Thinking section. One question at a time, a running timer, an answer sheet at the side, and you can cross out options you've ruled out.",
    "r2.title": "Two problem-solving runs",
    "r2.text": "15 problem-solving questions in 30 minutes, starting easy and getting harder, the way the real paper does. Good for speed: you see how long each step of a calculation takes you.",
    "r3.title": "See where your time and points went",
    "r3.text": "After every attempt: your score, time on each question against the target, the questions you rushed or got stuck on, and your weakest question types. Then practise them: questions from the mocks you've done join your untimed practice.",
    "cmp.title": "Free and full access",
    "cmp.what": "What you get",
    "cmp.free": "Free",
    "cmp.full": "Full access",
    "cmp.mocks": "Mocks in the NUET format",
    "cmp.mocksSub": "30 questions, 60 minutes",
    "cmp.mocksFree": "Mock 1",
    "cmp.mocksFull": "All 26",
    "cmp.runs": "Problem-solving runs",
    "cmp.runsSub": "15 questions, 30 minutes",
    "cmp.runsFree": "Runs 1 and 2",
    "cmp.runsFull": "All 22",
    "cmp.analysis": "Score, timing and question-type analysis",
    "cmp.practice": "Untimed practice",
    "cmp.practiceFree": "Questions from the mocks you've done",
    "cmp.practiceFull": "Every question",
    "cmp.yes": "Included",
    "cmp.ask": "Ask about full access on Telegram",
    "cmp.askText": "Hi! I'd like to know about full access to NUET Oqy.",
    "signup.text": "Hi! I'd like a free NUET Oqy account.",
    "final.title": "Your first mock takes an hour.",
    "final.lead": "Find a quiet hour, sit Mock 1, and see your analysis straight after.",
    "foot.tg": "Telegram channel",
    "foot.login": "Platform login"
  },
  ru: {
    title: "NUET Oqy бесплатно",
    "nav.login": "Войти",
    "hero.title": "Пробник в реальном формате NUET. Бесплатно.",
    "hero.lead": "Бесплатный аккаунт — это Пробник 1, два сета на Problem Solving и полный разбор каждой попытки: куда ушло время, на каких типах вопросов вы теряете баллы и что тренировать дальше.",
    "hero.note": "Бесплатно навсегда. Без карты и без пробного срока.",
    "cta.create": "Создать бесплатный аккаунт",
    "cta.login": "Войти",
    "what.title": "Что входит в бесплатный аккаунт",
    "r1.title": "Пробник 1 в условиях экзамена",
    "r1.text": "30 вопросов за 60 минут, примерно половина на чтение и половина на Problem Solving — как в разделе Critical Thinking на NUET. Один вопрос на экране, таймер, бланк ответов сбоку, и можно зачёркивать варианты, которые вы исключили.",
    "r2.title": "Два сета на Problem Solving",
    "r2.text": "15 вопросов на Problem Solving за 30 минут — от лёгких к сложным, как в настоящем тесте. Хорошо тренирует скорость: видно, сколько времени уходит на каждый шаг решения.",
    "r3.title": "Куда ушли время и баллы",
    "r3.text": "После каждой попытки: ваш балл, время на каждый вопрос в сравнении с целевым, вопросы, где вы спешили или застряли, и самые слабые типы вопросов. Их можно сразу тренировать: вопросы из пройденных пробников попадают в практику без таймера.",
    "cmp.title": "Бесплатно и полный доступ",
    "cmp.what": "Что входит",
    "cmp.free": "Бесплатно",
    "cmp.full": "Полный доступ",
    "cmp.mocks": "Пробники в формате NUET",
    "cmp.mocksSub": "30 вопросов, 60 минут",
    "cmp.mocksFree": "Пробник 1",
    "cmp.mocksFull": "Все 26",
    "cmp.runs": "Сеты на Problem Solving",
    "cmp.runsSub": "15 вопросов, 30 минут",
    "cmp.runsFree": "Сеты 1 и 2",
    "cmp.runsFull": "Все 22",
    "cmp.analysis": "Разбор балла, времени и типов вопросов",
    "cmp.practice": "Практика без таймера",
    "cmp.practiceFree": "Вопросы из пройденных пробников",
    "cmp.practiceFull": "Все вопросы",
    "cmp.yes": "Входит",
    "cmp.ask": "Узнать о полном доступе в Telegram",
    "cmp.askText": "Здравствуйте! Хочу узнать о полном доступе к NUET Oqy.",
    "signup.text": "Здравствуйте! Хочу бесплатный аккаунт NUET Oqy.",
    "final.title": "Первый пробник занимает час.",
    "final.lead": "Найдите спокойный час, пройдите Пробник 1 — и сразу увидите разбор.",
    "foot.tg": "Канал в Telegram",
    "foot.login": "Вход на платформу"
  }
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} }
};
const tg = CONFIG.TELEGRAM || "burkitoff";

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
  $$("[data-i18n-label]").forEach(el => el.setAttribute("aria-label", t(el.dataset.i18nLabel)));
  $$(".lang button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  $("#fullDm").href = `https://t.me/${encodeURIComponent(tg)}?text=${encodeURIComponent(t("cmp.askText"))}`;
  if (CONFIG.SIGNUP_ENABLED !== true) {
    $$("[data-signup]").forEach(a => { a.href = `https://t.me/${encodeURIComponent(tg)}?text=${encodeURIComponent(t("signup.text"))}`; a.rel = "noopener"; });
  }
}

$$(".lang button").forEach(b => b.addEventListener("click", () => { store.set("nuetoqy-lang", b.dataset.lang); applyLang(b.dataset.lang); }));
applyLang(lang);

const stage = $("#heroStage");
const settle = () => requestAnimationFrame(() => stage.classList.add("is-in"));
const img = stage.querySelector("img");
if (img.complete) settle(); else { img.addEventListener("load", settle, { once: true }); img.addEventListener("error", settle, { once: true }); setTimeout(settle, 1500); }
