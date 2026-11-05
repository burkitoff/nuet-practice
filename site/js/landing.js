import { CONFIG } from "./config.js";

const T = {
  en: {
    title: "NUET Oqy — NUET preparation",
    "nav.results": "Results",
    "nav.method": "Method",
    "nav.free": "Free plan",
    "nav.login": "Log in",
    "nav.platform": "Go to the platform",
    "hero.t1": "The lights are on.",
    "hero.t2": "Are you coming?",
    "hero.lead": "About 90% of our students get into Nazarbayev University. Find out where you stand today, with a free mock in Critical Thinking and in Math.",
    "hero.cta": "Take a free mock",
    "hero.tg": "Or message the teacher",
    "hero.s1": "top Critical Thinking score",
    "hero.s2": "points or more, for 30+ students",
    "hero.s3n": "3 years",
    "hero.s3": "of teaching the NUET",
    "alt.night": "Nazarbayev University building lit up at night",
    "alt.dusk": "Nazarbayev University main building at dusk",
    "alt.day": "A column of Nazarbayev University against the sky",
    "story.cap": "Nazarbayev University, Astana",
    "story.k": "One student's year",
    "story.t": "From the answer sheet to the front door.",
    "story.a": "First full mock, out of 240",
    "story.b": "Real NUET, out of 240",
    "story.c": "Studying there today",
    "story.note": "Fifty-one points did not come from luck. They came from a plan: find where the points are lost, fix one question type at a time, and practise against the clock.",
    "rec.k": "The record",
    "rec.t": "Three years of students. Here is how it went.",
    "rec.note": "Names are hidden for privacy.",
    "rec.r1": "of our students get into NU. The other one in ten chose to study abroad.",
    "rec.r2": "points or more between the first mock and the real NUET, for over 30 students.",
    "rec.r3": "the usual Critical Thinking score of our students, out of 120.",
    "rec.r4": "the highest Critical Thinking score so far. Others: 102, 96, 83, 71.",
    "rec.r5": "another student, first mock to real NUET, Critical Thinking.",
    "rec.papers": "Official NUET results and an admission letter. Tap to open.",
    "p.result": "Thinking Skills, official result",
    "p.ctOnly": "Prepared with us: Critical Thinking",
    "p.letter": "Admitted to NU",
    "p.letterSub": "Foundation Year, grant",
    "p.open": "Open",
    "m.k": "How we teach",
    "m.t": "Six steps between your first mock and the exam hall.",
    "m.1t": "Diagnostic mock",
    "m.1d": "A full mock in exam conditions shows where you start.",
    "m.2t": "Read the analysis",
    "m.2d": "Where the time went and which question types cost points.",
    "m.3t": "Technique by question type",
    "m.3d": "One type at a time: how to read it, and where the trap is.",
    "m.4t": "Practice against the clock",
    "m.4d": "Speed comes after accuracy, not before.",
    "m.5t": "Review every mistake",
    "m.5d": "Why the wrong answer looked right, so it stops working on you.",
    "m.6t": "Mock season",
    "m.6d": "Full timed mocks until the score holds steady.",
    "m.foot": "Each step is a column you stand on for the next one.",
    "f.k": "Step one is free",
    "f.t": "See where you stand, in both sections.",
    "f.lead": "No card and no trial countdown. The free plan stays free.",
    "f.cta": "Create a free account",
    "f.more": "See the free plan in detail",
    "f.ct": "Critical Thinking",
    "f.math": "Math",
    "f.both": "Both sections",
    "f.1t": "Mock 1",
    "f.1d": "30 questions, 60 minutes, in exam conditions",
    "f.2t": "Math Mock 1",
    "f.2d": "30 questions, 60 minutes, no calculator",
    "f.3t": "Two problem-solving runs",
    "f.3d": "15 questions, 30 minutes, easy to hard",
    "f.4t": "600+ practice questions",
    "f.4d": "By topic, with worked solutions",
    "f.5t": "Analysis after every attempt",
    "f.5d": "Where your time went, which topics cost you points, and what to work on next",
    "l.t": "Your first mock takes an hour.",
    "l.lead": "Find a quiet hour, sit Mock 1, and read your analysis straight after. If you want a plan from there, message us.",
    "l.cta": "Take a free mock",
    "l.tg": "Message us on Telegram",
    "tg.text": "Hi! I'd like to know about NUET preparation.",
    "signup.text": "Hi! I'd like a free NUET Oqy account.",
    "foot.tg": "Telegram channel",
    "foot.login": "Platform login",
    "foot.nu": "Not affiliated with Nazarbayev University.",
    "lb.close": "Close"
  },
  ru: {
    title: "NUET Oqy — подготовка к NUET",
    "nav.results": "Результаты",
    "nav.method": "Метод",
    "nav.free": "Бесплатно",
    "nav.login": "Войти",
    "nav.platform": "Перейти на платформу",
    "hero.t1": "Свет горит.",
    "hero.t2": "Вы идёте?",
    "hero.lead": "Около 90% наших учеников поступают в Назарбаев Университет. Узнайте свой уровень уже сегодня: бесплатный пробник по Critical Thinking и по математике.",
    "hero.cta": "Пройти пробник бесплатно",
    "hero.tg": "Или написать преподавателю",
    "hero.s1": "лучший балл по Critical Thinking",
    "hero.s2": "балла и больше у 30+ учеников",
    "hero.s3n": "3 года",
    "hero.s3": "готовим к NUET",
    "alt.night": "Здание Назарбаев Университета ночью, в подсветке",
    "alt.dusk": "Главное здание Назарбаев Университета на закате",
    "alt.day": "Колонна Назарбаев Университета на фоне неба",
    "story.cap": "Назарбаев Университет, Астана",
    "story.k": "Год одного ученика",
    "story.t": "От бланка ответов до дверей университета.",
    "story.a": "Первый полный пробник, из 240",
    "story.b": "Настоящий NUET, из 240",
    "story.c": "Сейчас учится там",
    "story.note": "Пятьдесят один балл — это не удача. Это план: найти, где теряются баллы, разобрать типы вопросов по одному и тренироваться на время.",
    "rec.k": "Как это было",
    "rec.t": "Три года учеников. Вот результаты.",
    "rec.note": "Имена скрыты ради конфиденциальности.",
    "rec.r1": "наших учеников поступают в NU. Остальные выбрали учёбу за границей.",
    "rec.r2": "балла и больше между первым пробником и настоящим NUET — у более чем 30 учеников.",
    "rec.r3": "обычный балл наших учеников по Critical Thinking, из 120.",
    "rec.r4": "лучший балл по Critical Thinking на сегодня. Другие: 102, 96, 83, 71.",
    "rec.r5": "ещё один ученик: первый пробник и настоящий NUET, Critical Thinking.",
    "rec.papers": "Официальные результаты NUET и письмо о зачислении. Нажмите, чтобы открыть.",
    "p.result": "Thinking Skills, официальный результат",
    "p.ctOnly": "Готовился с нами: Critical Thinking",
    "p.letter": "Поступление в NU",
    "p.letterSub": "Foundation Year, грант",
    "p.open": "Открыть",
    "m.k": "Как мы учим",
    "m.t": "Шесть шагов от первого пробника до экзамена.",
    "m.1t": "Диагностический пробник",
    "m.1d": "Полный пробник в условиях экзамена показывает, с чего вы начинаете.",
    "m.2t": "Разбор результата",
    "m.2d": "Куда ушло время и на каких типах вопросов теряются баллы.",
    "m.3t": "Техника по типам вопросов",
    "m.3d": "Один тип за раз: как его читать и где ловушка.",
    "m.4t": "Тренировка на время",
    "m.4d": "Сначала точность, потом скорость.",
    "m.5t": "Разбор каждой ошибки",
    "m.5d": "Почему неверный ответ казался верным — чтобы ловушка больше не срабатывала.",
    "m.6t": "Сезон пробников",
    "m.6d": "Полные пробники на время, пока балл не станет стабильным.",
    "m.foot": "Каждый шаг — колонна, на которую вы опираетесь для следующего.",
    "f.k": "Первый шаг — бесплатно",
    "f.t": "Узнайте свой уровень в обоих разделах.",
    "f.lead": "Без карты и без пробного срока. Бесплатный доступ остаётся бесплатным.",
    "f.cta": "Создать бесплатный аккаунт",
    "f.more": "Подробнее о бесплатном доступе",
    "f.ct": "Critical Thinking",
    "f.math": "Математика",
    "f.both": "Оба раздела",
    "f.1t": "Пробник 1",
    "f.1d": "30 вопросов, 60 минут, как на экзамене",
    "f.2t": "Пробник 1 по математике",
    "f.2d": "30 вопросов, 60 минут, без калькулятора",
    "f.3t": "Два сета на Problem Solving",
    "f.3d": "15 вопросов, 30 минут, от лёгких к сложным",
    "f.4t": "600+ задач по математике",
    "f.4d": "По темам, с решениями",
    "f.5t": "Разбор каждой попытки",
    "f.5d": "Куда ушло время, на каких темах теряются баллы и что тренировать дальше",
    "l.t": "Первый пробник занимает час.",
    "l.lead": "Найдите спокойный час, пройдите Пробник 1 и сразу посмотрите разбор. Если нужен план дальше — напишите нам.",
    "l.cta": "Пройти пробник бесплатно",
    "l.tg": "Написать в Telegram",
    "tg.text": "Здравствуйте! Хочу узнать о подготовке к NUET.",
    "signup.text": "Здравствуйте! Хочу бесплатный аккаунт NUET Oqy.",
    "foot.tg": "Канал в Telegram",
    "foot.login": "Вход на платформу",
    "foot.nu": "Не связан с Назарбаев Университетом.",
    "lb.close": "Закрыть"
  }
};

const PAPERS = [
  { src: "img/reviews/result-2.jpg", score: 86, kind: "result" },
  { src: "img/reviews/result-3.jpg", score: 81, kind: "result" },
  { src: "img/reviews/admission-letter.jpg", kind: "letter" },
  { src: "img/reviews/result-5.jpg", score: 76, kind: "result" },
  { src: "img/reviews/result-1.jpg", score: 81, kind: "result" },
  { src: "img/reviews/result-4.jpg", score: 75, kind: "result" }
];

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} }
};
const signedIn = (() => {
  try { return Object.keys(localStorage).some(k => /^sb-.+-auth-token$/.test(k) && localStorage.getItem(k)); }
  catch { return false; }
})();
const tg = CONFIG.TELEGRAM || "burkitoff";
const dm = text => `https://t.me/${encodeURIComponent(tg)}?text=${encodeURIComponent(text)}`;

function pickLang() {
  const q = new URLSearchParams(location.search).get("lang");
  if (q === "en" || q === "ru") return q;
  const saved = store.get("nuetoqy-lang");
  if (saved === "en" || saved === "ru") return saved;
  return (navigator.languages || [navigator.language || "en"]).some(l => /^(ru|kk)/i.test(l)) ? "ru" : "en";
}

let lang = pickLang();
const t = k => T[lang][k] ?? T.en[k] ?? k;

function buildPapers() {
  $("#papers").innerHTML = PAPERS.map((p, i) =>
    `<li><button type="button" data-i="${i}"><img src="${p.src}" alt="" loading="lazy" decoding="async">` +
    (p.kind === "letter"
      ? `<b data-i18n="p.letter"></b><small data-i18n="p.letterSub"></small>`
      : `<b>${p.score}</b><small data-i18n="p.result"></small><small data-i18n="p.ctOnly"></small>`) +
    `</button></li>`).join("");
  const lb = $("#lightbox");
  $("#papers").addEventListener("click", e => {
    const b = e.target.closest("button[data-i]");
    if (!b) return;
    $("img", lb).src = PAPERS[+b.dataset.i].src;
    lb.showModal();
  });
  lb.addEventListener("click", e => { if (e.target !== $("img", lb)) lb.close(); });
}

function applyLang(next) {
  lang = next;
  document.documentElement.lang = lang;
  document.title = t("title");
  $$("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  $$("[data-i18n-label]").forEach(el => el.setAttribute("aria-label", t(el.dataset.i18nLabel)));
  $$("[data-i18n-alt]").forEach(el => el.setAttribute("alt", t(el.dataset.i18nAlt)));
  $$("#papers button").forEach((b, i) => {
    const p = PAPERS[i];
    b.setAttribute("aria-label", `${t("p.open")}: ${p.kind === "letter" ? t("p.letter") : `${p.score}, ${t("p.result")}`}`);
  });
  $$(".lang button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
  $("#heroTg").href = dm(t("tg.text"));
  $("#lastTg").href = dm(t("tg.text"));
  if (signedIn) {
    $("#login").textContent = t("nav.platform");
    ["#heroCta", "#lastCta", "#freeCta"].forEach(s => { $(s).href = "/app/"; $(s).textContent = t("nav.platform"); });
  } else if (CONFIG.SIGNUP_ENABLED !== true) {
    $("#freeCta").href = dm(t("signup.text"));
    $("#freeCta").rel = "noopener";
  }
}

$$(".lang button").forEach(b => b.addEventListener("click", () => { store.set("nuetoqy-lang", b.dataset.lang); applyLang(b.dataset.lang); }));
buildPapers();
applyLang(lang);
