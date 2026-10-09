import { CONFIG } from "./config.js";

function toEmail(login) {
  const s = login.trim().toLowerCase();
  return s.includes("@") ? s : `${s}@${CONFIG.USERNAME_DOMAIN}`;
}

function must({ data, error }) {
  if (error) throw new Error(error.message || String(error));
  return data;
}

function createSupabaseApi() {
  const sb = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  const urlCache = new Map();
  let profile = null;

  const api = {

    async session() {
      const { data } = await sb.auth.getSession();
      return data.session;
    },
    async signIn(login, password) {
      must(await sb.auth.signInWithPassword({ email: toEmail(login), password }));
      profile = null;
    },
    async signOut() { await sb.auth.signOut(); profile = null; urlCache.clear(); },
    async changePassword(pw) { must(await sb.auth.updateUser({ password: pw })); },
    async me(force = false) {
      if (profile && !force) return profile;
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return null;
      profile = must(await sb.from("profiles").select("*").eq("id", user.id).single());
      return profile;
    },
    async serverNow() { return new Date(must(await sb.rpc("server_now"))).getTime(); },

    async taxonomy() { return must(await sb.from("taxonomy").select("*").order("sort")); },
    async groups() { return must(await sb.from("groups").select("*").order("code")); },
    async exams() {
      const rows = must(await sb.from("questions").select("exam_code").eq("active", true));
      return [...new Set(rows.map(r => r.exam_code))].sort();
    },
    async questions(ids) {
      if (!ids.length) return [];
      const out = [];
      for (let i = 0; i < ids.length; i += 100) {
        out.push(...must(await sb.from("questions").select("*").in("id", ids.slice(i, i + 100))));
      }
      return out;
    },
    async mediaUrls(paths) {
      const now = Date.now(), res = {}, need = [];
      for (const p of new Set(paths)) {
        const c = urlCache.get(p);
        if (c && c.exp > now + 60000) res[p] = c.url; else need.push(p);
      }
      if (need.length) {
        const data = must(await sb.storage.from("media").createSignedUrls(need, 3600));
        for (const d of data) {
          if (d.signedUrl) { urlCache.set(d.path, { url: d.signedUrl, exp: now + 3600000 }); res[d.path] = d.signedUrl; }
        }
      }
      return res;
    },

    async mocks() { return must(await sb.from("mocks").select("*").order("created_at", { ascending: false })); },
    async myAttempts() {
      const me = await api.me();
      return must(await sb.from("attempts").select("*").eq("user_id", me.id).order("started_at", { ascending: false }));
    },
    async startPractice(o) {
      return must(await sb.rpc("start_practice", {
        p_count: o.count, p_category: o.category || null, p_subcategory: o.subcategory || null,
        p_skill: o.skill || null, p_exam: o.exam || null,
      }));
    },
    async startMock(id) { return must(await sb.rpc("start_mock", { p_mock: id })); },
    async finalizeExpired() { return must(await sb.rpc("finalize_my_expired")); },
    async attempt(id) {
      const attempt = must(await sb.from("attempts").select("*").eq("id", id).single());
      const items = must(await sb.from("attempt_items").select("*").eq("attempt_id", id).order("position"));
      return { attempt, items };
    },
    async saveProgress(id, items, elapsed, hidden) {
      return must(await sb.rpc("save_progress", { p_attempt: id, p_items: items, p_elapsed_ms: elapsed, p_hidden_ms: hidden }));
    },
    async discardPractice(id) { must(await sb.rpc("discard_practice", { p_attempt: id })); },
    async submit(id, items, elapsed, hidden, auto) {
      return must(await sb.rpc("submit_attempt", { p_attempt: id, p_items: items, p_elapsed_ms: elapsed, p_hidden_ms: hidden, p_auto: !!auto }));
    },
    async statsData(userId) {
      const cols = "attempt_id,user_id,question_id,position,answer,correct_answer,is_correct,locked,time_ms,first_seen_ms,first_answer_ms,last_answer_ms,visits,changes,flagged,crossed,events,excluded,time_override_ms,reviewed,admin_note";
      const scope = q => (userId === "*" ? q : q.eq("user_id", userId));
      const attempts = must(await scope(sb.from("attempts").select("*").eq("status", "submitted")).order("started_at"));
      const ids = new Set(attempts.map(a => a.id));
      const items = [];
      for (let from = 0; ; from += 1000) {
        const page = must(await scope(sb.from("attempt_items").select(cols)).order("attempt_id").order("position").range(from, from + 999));
        items.push(...page.filter(i => ids.has(i.attempt_id)));
        if (page.length < 1000) break;
      }
      return { attempts, items };
    },

    async profiles() { return must(await sb.from("profiles").select("*").order("display_name")); },
    async adminUsers(payload) {
      const { data, error } = await sb.functions.invoke("admin-users", { body: payload });
      if (error) {
        let msg = error.message;
        try { const j = await error.context.json(); if (j.error) msg = j.error; } catch (_) {}
        throw new Error(msg);
      }
      if (data && data.error) throw new Error(data.error);
      return data;
    },
    async updateProfile(id, fields) { must(await sb.from("profiles").update(fields).eq("id", id)); },
    async saveGroup(g) { must(await sb.from("groups").upsert(g)); },
    async deleteGroup(code) { must(await sb.from("groups").delete().eq("code", code)); },
    async allQuestions() {
      const out = [];
      for (let from = 0; ; from += 1000) {
        const page = must(await sb.from("questions").select("*").order("id").range(from, from + 999));
        out.push(...page);
        if (page.length < 1000) break;
      }
      return out;
    },
    async answerKeys(ids) {
      const rows = must(await sb.rpc("admin_answer_keys", { p_ids: ids || null }));
      return Object.fromEntries(rows.map(r => [r.question_id, r.answer]));
    },
    async saveMock(m) {
      const row = { ...m };
      if (!row.id) delete row.id;
      return must(await sb.from("mocks").upsert(row).select().single());
    },
    async deleteMock(id) { must(await sb.from("mocks").delete().eq("id", id)); },
    async releaseReview(id) { return must(await sb.rpc("admin_release_review", { p_mock: id })); },
    async adminFinalize(id) { must(await sb.rpc("admin_finalize", { p_attempt: id })); },
    async deleteAttempt(id) { must(await sb.from("attempts").delete().eq("id", id)); },
    async adminUpdateItems(list) { return must(await sb.rpc("admin_update_items", { p: list })); },
    async adminUpdateAttempt(id, excluded, note) { must(await sb.rpc("admin_update_attempt", { p_attempt: id, p_excluded: excluded, p_note: note ?? null })); },
    async voidQuestion(mockId, qid, excluded) { return must(await sb.rpc("admin_void_question", { p_mock: mockId, p_question: qid, p_excluded: excluded })); },
    async reportQuestion(qid, attemptId, message) {
      must(await sb.from("question_reports").insert({ question_id: qid, attempt_id: attemptId || null, message }));
    },
    async reports() { return must(await sb.from("question_reports").select("*").order("created_at", { ascending: false })); },
    async setReportStatus(id, status) { must(await sb.from("question_reports").update({ status }).eq("id", id)); },
    async allAttempts() { return must(await sb.from("attempts").select("*").order("started_at", { ascending: false })); },
  };
  return api;
}

export const api = createSupabaseApi();
