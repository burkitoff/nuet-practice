import { api } from "./api.js";
import { CONFIG } from "./config.js";
import { $, esc, toast } from "./util.js";

const T = {
  en: {
    tagline: "Train your aim.",
    login_hint: "Log in with your email, or with the username and password your teacher gave you.",
    login_user: "Email or username", password: "Password", login: "Log in",
    forgot: "Forgot password?", no_account: "No account yet?", create_free: "Create a free account",
    have_account: "Already have an account?", back_login: "Log in",
    wrong: "Wrong email/username or password.", disabled: "This account is disabled. Ask your teacher.",
    not_confirmed: "Please confirm your email first: open the link we sent you (check spam too).", resend: "Send the link again",
    resent: "Sent. Check your inbox and spam folder.", setup: "Setup problem: ", network: "Can't reach the server. Check your internet connection.",
    captcha_wait: "Please wait a moment for the security check, then try again.",
    su_title: "Create a free account",
    su_lead: "The free plan includes <b>Mock 1</b> (NUET format: 30 questions, 60 minutes) and <b>2 problem-solving runs</b>, with your full results and timing analysis. Full access opens all mocks and runs.",
    name: "Your name", email: "Email", pw_new: "Password (at least 8 characters)", pw_repeat: "Repeat password",
    telegram: "Telegram username", optional: "optional", city: "City", school: "School", grade: "Grade",
    consent: "By creating an account you agree that we store your name, email, the details above and your answers with their timing, to show your progress. We don't share them. Write to us to delete your account.",
    create: "Create account", pw_mismatch: "The passwords don't match.", pw_short: "The password must be at least 8 characters.",
    sent_title: "Check your email", sent_body: e => `We sent a link to <b>${esc(e)}</b>. Open it to activate your account. If it's not there in a few minutes, check the spam folder.`,
    fg_title: "Reset your password", fg_lead: "Enter the email you signed up with. We'll send you a link to set a new password.",
    fg_teacher: "Got your login from your teacher? Ask them for a new password.", fg_send: "Send link",
    fg_sent: "If an account exists for this email, we've sent a link. Check your inbox and spam folder.",
    fg_username: "That looks like a username. Accounts made by your teacher can't reset by email: ask your teacher for a new password.",
    np_title: "Set a new password", np_save: "Save and log in", np_done: "Password changed.",
    confirmed: "Email confirmed, welcome!", link_bad: "This link has expired or was already used. Log in, or ask for a new link.",
    closed: "Sign-up isn't open yet.",
  },
  ru: {
    tagline: "Тренируй точность.",
    login_hint: "Войдите по email или по логину и паролю, которые дал преподаватель.",
    login_user: "Email или логин", password: "Пароль", login: "Войти",
    forgot: "Забыли пароль?", no_account: "Нет аккаунта?", create_free: "Создать бесплатный аккаунт",
    have_account: "Уже есть аккаунт?", back_login: "Войти",
    wrong: "Неверный email/логин или пароль.", disabled: "Аккаунт отключён. Обратитесь к преподавателю.",
    not_confirmed: "Сначала подтвердите email: откройте ссылку из письма (проверьте и «Спам»).", resend: "Отправить ссылку ещё раз",
    resent: "Отправили. Проверьте входящие и «Спам».", setup: "Ошибка настройки: ", network: "Нет связи с сервером. Проверьте интернет.",
    captcha_wait: "Подождите пару секунд, пока пройдёт проверка безопасности, и попробуйте снова.",
    su_title: "Бесплатный аккаунт",
    su_lead: "Бесплатный план: <b>Пробник 1</b> (формат NUET: 30 вопросов, 60 минут) и <b>2 сета на Problem Solving</b>, с полными результатами и анализом времени. Полный доступ открывает все пробники и сеты.",
    name: "Ваше имя", email: "Email", pw_new: "Пароль (минимум 8 символов)", pw_repeat: "Повторите пароль",
    telegram: "Ник в Telegram", optional: "необязательно", city: "Город", school: "Школа", grade: "Класс",
    consent: "Создавая аккаунт, вы соглашаетесь, что мы храним ваше имя, email, данные выше и ваши ответы со временем, чтобы показывать прогресс. Мы их никому не передаём. Чтобы удалить аккаунт, напишите нам.",
    create: "Создать аккаунт", pw_mismatch: "Пароли не совпадают.", pw_short: "Пароль должен быть не короче 8 символов.",
    sent_title: "Проверьте почту", sent_body: e => `Мы отправили ссылку на <b>${esc(e)}</b>. Откройте её, чтобы активировать аккаунт. Если письма нет через пару минут, проверьте «Спам».`,
    fg_title: "Сброс пароля", fg_lead: "Введите email, с которым регистрировались. Мы пришлём ссылку для нового пароля.",
    fg_teacher: "Логин выдал преподаватель? Попросите у него новый пароль.", fg_send: "Отправить ссылку",
    fg_sent: "Если такой аккаунт есть, мы отправили ссылку. Проверьте входящие и «Спам».",
    fg_username: "Похоже, это логин. Аккаунты от преподавателя нельзя сбросить по email: попросите новый пароль у преподавателя.",
    np_title: "Новый пароль", np_save: "Сохранить и войти", np_done: "Пароль изменён.",
    confirmed: "Email подтверждён, добро пожаловать!", link_bad: "Ссылка устарела или уже использована. Войдите или запросите новую ссылку.",
    closed: "Регистрация пока закрыта.",
  },
};

export function lang() {
  try { const v = localStorage.getItem("nuetoqy-lang"); if (v === "ru" || v === "en") return v; } catch (_) {}
  return /^(ru|kk)/i.test(navigator.language || "") ? "ru" : "en";
}
const t = k => T[lang()][k] ?? T.en[k];
const signupOpen = () => CONFIG.SIGNUP_ENABLED === true;

let tsLoad = null;
function loadTurnstile() {
  if (tsLoad) return tsLoad;
  tsLoad = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true; s.onload = () => res(window.turnstile); s.onerror = () => { tsLoad = null; rej(new Error("captcha failed to load")); };
    document.head.append(s);
  });
  return tsLoad;
}
function captcha(el) {
  const key = CONFIG.TURNSTILE_SITE_KEY;
  if (!key) return { token: async () => null, reset() {} };
  let token = null, id = null, waiters = [];
  loadTurnstile().then(ts => {
    id = ts.render(el, { sitekey: key, language: lang(), appearance: "interaction-only",
      callback: v => { token = v; waiters.splice(0).forEach(f => f(v)); }, "expired-callback": () => { token = null; } });
  }).catch(() => {});
  return {
    token: () => (token ? Promise.resolve(token) : new Promise((res, rej) => { waiters.push(res); setTimeout(() => rej(new Error(t("captcha_wait"))), 15000); })),
    reset() { token = null; if (id != null && window.turnstile) window.turnstile.reset(id); },
  };
}

let rerender = null;
function frame(root, inner) {
  const l = lang();
  root.innerHTML = `<div class="login-wrap"><div class="card login">
    <div class="lang-switch"><button type="button" data-lang="en" class="${l === "en" ? "on" : ""}">EN</button><button type="button" data-lang="ru" class="${l === "ru" ? "on" : ""}">RU</button></div>
    <h1 class="sr-only">${esc(CONFIG.APP_NAME)}</h1><img class="login-logo" src="/img/logo-stacked.svg" alt="" width="150" height="153">
    <p class="tagline">${t("tagline")}</p>${inner}</div></div>`;
  root.querySelector(".lang-switch").onclick = e => {
    const b = e.target.closest("[data-lang]"); if (!b) return;
    try { localStorage.setItem("nuetoqy-lang", b.dataset.lang); } catch (_) {}
    if (rerender) rerender();
  };
}

function errText(m) {
  return /invalid login credentials/i.test(m) ? t("wrong") :
    /email not confirmed/i.test(m) ? t("not_confirmed") :
    /ban|disabled/i.test(m) ? t("disabled") :
    /captcha/i.test(m) ? t("captcha_wait") :
    /api key|apikey|secret/i.test(m) ? t("setup") + m :
    /fetch|network/i.test(m) ? t("network") : m;
}

export function showAuth(root, opts) {
  const h = location.hash;
  if (h.startsWith("#/signup")) return showSignup(root, opts);
  if (h.startsWith("#/forgot")) return showForgot(root, opts);
  return showLogin(root, opts);
}

export function showLogin(root, { onLogin, notice }) {
  rerender = () => showLogin(root, { onLogin, notice });
  frame(root, `<p class="muted">${t("login_hint")}</p>
    ${notice ? `<p class="note">${esc(notice)}</p>` : ""}
    <form id="loginForm" autocomplete="on">
      <label>${t("login_user")}<input name="u" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
      <label>${t("password")}<input name="p" type="password" autocomplete="current-password" required></label>
      <div class="cf" id="cf"></div>
      <button class="btn btn-primary btn-block" type="submit">${t("login")}</button>
      <p class="err" id="loginErr" role="alert"></p>
    </form>
    <p class="auth-links"><a href="#/forgot">${t("forgot")}</a>${signupOpen() ? `<span>${t("no_account")} <a href="#/signup">${t("create_free")}</a></span>` : ""}</p>`);
  const cf = captcha($("#cf", root));
  $("#loginForm", root).onsubmit = async e => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector("button");
    btn.disabled = true; $("#loginErr", root).textContent = "";
    try { await api.signIn(f.u.value, f.p.value, await cf.token()); await onLogin(); }
    catch (err) {
      const m = err.message || String(err);
      const el = $("#loginErr", root);
      el.textContent = errText(m);
      if (/email not confirmed/i.test(m) && f.u.value.includes("@")) {
        const b = document.createElement("button"); b.type = "button"; b.className = "btn btn-ghost btn-sm"; b.textContent = t("resend");
        b.onclick = async () => { b.disabled = true; try { await api.resendSignup(f.u.value.trim(), await cf.token()); toast(t("resent"), "good"); } catch (e2) { toast(errText(e2.message), "error"); } cf.reset(); };
        el.append(document.createElement("br"), b);
      }
      cf.reset(); btn.disabled = false;
    }
  };
}

function showSignup(root, opts) {
  rerender = () => showSignup(root, opts);
  if (!signupOpen()) { frame(root, `<p>${t("closed")}</p><p class="auth-links"><a href="#/">${t("back_login")}</a></p>`); return; }
  frame(root, `<h2>${t("su_title")}</h2><p class="small">${t("su_lead")}</p>
    <form id="suForm" autocomplete="on">
      <label>${t("name")}<input name="name" required maxlength="80" autocomplete="name"></label>
      <label>${t("email")}<input name="email" type="email" required maxlength="200" autocomplete="email" autocapitalize="none" spellcheck="false"></label>
      <label>${t("pw_new")}<input name="p1" type="password" required minlength="8" autocomplete="new-password"></label>
      <label>${t("pw_repeat")}<input name="p2" type="password" required minlength="8" autocomplete="new-password"></label>
      <label><span>${t("telegram")} <span class="muted small">(${t("optional")})</span></span><input name="telegram" maxlength="64" placeholder="@username" autocapitalize="none" spellcheck="false"></label>
      <div class="su-row">
        <label><span>${t("city")} <span class="muted small">(${t("optional")})</span></span><input name="city" maxlength="80"></label>
        <label><span>${t("grade")} <span class="muted small">(${t("optional")})</span></span><input name="grade" maxlength="20" inputmode="numeric"></label>
      </div>
      <label><span>${t("school")} <span class="muted small">(${t("optional")})</span></span><input name="school" maxlength="120"></label>
      <p class="muted small">${t("consent")}</p>
      <div class="cf" id="cf"></div>
      <button class="btn btn-primary btn-block" type="submit">${t("create")}</button>
      <p class="err" id="suErr" role="alert"></p>
    </form>
    <p class="auth-links"><span>${t("have_account")} <a href="#/">${t("back_login")}</a></span></p>`);
  const cf = captcha($("#cf", root));
  $("#suForm", root).onsubmit = async e => {
    e.preventDefault();
    const f = e.target, btn = f.querySelector("button[type=submit]"), err = $("#suErr", root);
    err.textContent = "";
    if (f.p1.value.length < 8) return (err.textContent = t("pw_short"));
    if (f.p1.value !== f.p2.value) return (err.textContent = t("pw_mismatch"));
    btn.disabled = true;
    const email = f.email.value.trim().toLowerCase();
    try {
      await api.signUp({ email, password: f.p1.value, name: f.name.value.trim(), telegram: f.telegram.value.trim(),
        city: f.city.value.trim(), school: f.school.value.trim(), grade: f.grade.value.trim() }, await cf.token());
      frame(root, `<h2>${t("sent_title")}</h2><p>${t("sent_body")(email)}</p>
        <p><button class="btn btn-ghost btn-sm" id="again">${t("resend")}</button></p><div class="cf" id="cf2"></div>
        <p class="auth-links"><a href="#/">${t("back_login")}</a></p>`);
      const cf2 = captcha($("#cf2", root));
      $("#again", root).onclick = async ev => { ev.target.disabled = true; try { await api.resendSignup(email, await cf2.token()); toast(t("resent"), "good"); } catch (e2) { toast(errText(e2.message), "error"); ev.target.disabled = false; } cf2.reset(); };
    } catch (e2) { err.textContent = errText(e2.message || String(e2)); cf.reset(); btn.disabled = false; }
  };
}

function showForgot(root) {
  rerender = () => showForgot(root);
  frame(root, `<h2>${t("fg_title")}</h2><p class="small">${t("fg_lead")}</p><p class="muted small">${t("fg_teacher")}</p>
    <form id="fgForm"><label>${t("email")}<input name="email" required autocapitalize="none" spellcheck="false" autocomplete="email"></label>
      <div class="cf" id="cf"></div>
      <button class="btn btn-primary btn-block" type="submit">${t("fg_send")}</button><p class="err" id="fgErr" role="alert"></p></form>
    <p class="auth-links"><a href="#/">${t("back_login")}</a></p>`);
  const cf = captcha($("#cf", root));
  $("#fgForm", root).onsubmit = async e => {
    e.preventDefault();
    const f = e.target, v = f.email.value.trim().toLowerCase(), err = $("#fgErr", root);
    if (!v.includes("@") || v.endsWith("@" + (CONFIG.USERNAME_DOMAIN || "students.invalid"))) return (err.textContent = t("fg_username"));
    f.querySelector("button").disabled = true;
    try { await api.resetPassword(v, await cf.token()); f.outerHTML = `<p class="note">${t("fg_sent")}</p>`; }
    catch (e2) { err.textContent = errText(e2.message || String(e2)); cf.reset(); f.querySelector("button").disabled = false; }
  };
}

export function showNewPassword(root, { onDone }) {
  rerender = () => showNewPassword(root, { onDone });
  frame(root, `<h2>${t("np_title")}</h2>
    <form id="npForm"><label>${t("pw_new")}<input name="p1" type="password" required minlength="8" autocomplete="new-password"></label>
      <label>${t("pw_repeat")}<input name="p2" type="password" required minlength="8" autocomplete="new-password"></label>
      <button class="btn btn-primary btn-block" type="submit">${t("np_save")}</button><p class="err" id="npErr" role="alert"></p></form>`);
  $("#npForm", root).onsubmit = async e => {
    e.preventDefault();
    const f = e.target, err = $("#npErr", root);
    if (f.p1.value.length < 8) return (err.textContent = t("pw_short"));
    if (f.p1.value !== f.p2.value) return (err.textContent = t("pw_mismatch"));
    f.querySelector("button").disabled = true;
    try { await api.changePassword(f.p1.value); toast(t("np_done"), "good"); await onDone(); }
    catch (e2) { err.textContent = errText(e2.message || String(e2)); f.querySelector("button").disabled = false; }
  };
}

export const authText = t;
