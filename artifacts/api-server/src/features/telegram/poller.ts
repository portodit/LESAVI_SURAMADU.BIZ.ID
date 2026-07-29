import { db, accountManagersTable, appSettingsTable, telegramBotUsersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  sendToTelegram, answerCallbackQuery, greetingByTime,
  buildTelegramMessages, getAvailablePerfPeriods,
  getActiveAMs, getActiveAMsCount, searchAMs,
} from "./service";
import { chatWithGemini } from "./ai";
import { parseExcelBuffer, getWorkbookSheetNames } from "../import/excel";
import { importPerformance, importFunnel, importActivity } from "../gdrive/importer";
import { logger } from "../../shared/logger";

let lastUpdateId = 0;
let pollerTimer: ReturnType<typeof setTimeout> | null = null;

// ── Bot user tracking ───────────────────────────────────────────────────────

export interface BotUser {
  chatId: string;
  firstName: string;
  lastName: string;
  username: string;
  lastMessage: string;
  lastSeen: string;
}
const botUsersMap = new Map<string, BotUser>();

// ── Linked AM cache (chatId → AM, 5-min TTL) ────────────────────────────────
const amCacheByChat = new Map<string, { am: (typeof accountManagersTable)["$inferSelect"]; cachedAt: number }>();
const AM_CACHE_TTL_MS = 5 * 60 * 1000;

async function getLinkedAmByChatId(chatId: string): Promise<(typeof accountManagersTable)["$inferSelect"] | null> {
  const hit = amCacheByChat.get(chatId);
  if (hit && Date.now() - hit.cachedAt < AM_CACHE_TTL_MS) return hit.am;
  const [am] = await db.select().from(accountManagersTable)
    .where(eq(accountManagersTable.telegramChatId, chatId));
  if (am) amCacheByChat.set(chatId, { am, cachedAt: Date.now() });
  else amCacheByChat.delete(chatId);
  return am ?? null;
}

function invalidateAmCache(chatId: string) {
  amCacheByChat.delete(chatId);
}

// ── Bot token cache (1-min TTL) ──────────────────────────────────────────────
let cachedBotToken: string | null = null;
let tokenCachedAt = 0;
const TOKEN_CACHE_TTL_MS = 60_000;

async function getBotToken(): Promise<string | null> {
  if (cachedBotToken && Date.now() - tokenCachedAt < TOKEN_CACHE_TTL_MS) return cachedBotToken;
  const [settings] = await db.select().from(appSettingsTable);
  cachedBotToken = settings?.telegramBotToken ?? null;
  tokenCachedAt = Date.now();
  return cachedBotToken;
}

export function invalidateBotTokenCache() {
  cachedBotToken = null;
  tokenCachedAt = 0;
}

export function getBotUsers(): BotUser[] {
  return [...botUsersMap.values()].sort(
    (a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
  );
}

async function upsertBotUser(user: BotUser) {
  botUsersMap.set(user.chatId, user);
  try {
    await db.insert(telegramBotUsersTable).values({
      chatId: user.chatId, firstName: user.firstName, lastName: user.lastName,
      username: user.username, lastMessage: user.lastMessage, lastSeen: new Date(user.lastSeen),
    }).onConflictDoUpdate({
      target: telegramBotUsersTable.chatId,
      set: {
        firstName: user.firstName, lastName: user.lastName, username: user.username,
        lastMessage: user.lastMessage, lastSeen: new Date(user.lastSeen)
      },
    });
  } catch (err) {
    logger.debug({ err }, "Failed to persist bot user (non-fatal)");
  }
}

// ── Chat state management (in-memory, per chat) ────────────────────────────

interface ChatState {
  mode?: string;
  importType?: "performance" | "funnel" | "activity";
  selectedNik?: string;
  selectedNama?: string;
}
const chatStateMap = new Map<string, ChatState>();

function getChatState(chatId: string): ChatState {
  if (!chatStateMap.has(chatId)) chatStateMap.set(chatId, {});
  return chatStateMap.get(chatId)!;
}

function clearChatState(chatId: string) {
  chatStateMap.delete(chatId);
}

// ── Keyboard constants ──────────────────────────────────────────────────────

// AM keyboards (existing, unchanged)
const AM_MAIN_KEYBOARD = {
  inline_keyboard: [
    [
      { text: "📋 Funneling", callback_data: "/funneling" },
      { text: "📅 Activity", callback_data: "/activity" },
    ],
    [
      { text: "📊 Performansi", callback_data: "/performansi" },
    ],
  ],
};

const PERF_NAV_KEYBOARD = {
  inline_keyboard: [
    [
      { text: "◀️ Pilih Bulan Lain", callback_data: "perf:menu" },
      { text: "🏠 Menu Utama", callback_data: "nav:main" },
    ],
  ],
};

const ACTIVITY_LABEL_KEYBOARD = {
  inline_keyboard: [
    [
      { text: "👥 Dengan Pelanggan", callback_data: "act:pelanggan" },
      { text: "🏗️ Pelanggan Dengan Proyek", callback_data: "act:proyek" },
    ],
    [
      { text: "🏠 Menu Utama", callback_data: "nav:main" },
    ],
  ],
};

// Officer keyboards
const OFFICER_MAIN_KEYBOARD = {
  inline_keyboard: [
    [{ text: "⬆️ Upload Data", callback_data: "off:upload" }],
  ],
};

const OFFICER_UPLOAD_TYPE_KEYBOARD = {
  inline_keyboard: [
    [
      { text: "📊 Performance", callback_data: "off:type:performance" },
      { text: "📋 Funneling", callback_data: "off:type:funnel" },
    ],
    [
      { text: "📅 Activity", callback_data: "off:type:activity" },
    ],
    [
      { text: "⬅️ Kembali", callback_data: "off:cancel" },
    ],
  ],
};

// Manager keyboards
const MANAGER_MAIN_KEYBOARD = {
  inline_keyboard: [
    [{ text: "👤 Pilih AM", callback_data: "mgr:am:list:0" }],
  ],
};

function buildManagerAmDataKeyboard(selectedNama: string) {
  return {
    inline_keyboard: [
      [
        { text: "📋 Funneling", callback_data: "mgr:data:funneling" },
        { text: "📅 Activity", callback_data: "mgr:data:activity" },
      ],
      [
        { text: "📊 Performansi", callback_data: "mgr:data:performansi" },
      ],
      [
        { text: "🔁 Ganti AM", callback_data: "mgr:am:list:0" },
        { text: "🏠 Menu Utama", callback_data: "nav:main" },
      ],
    ],
  };
}

const MGR_PERF_NAV_KEYBOARD = {
  inline_keyboard: [
    [
      { text: "◀️ Pilih Bulan Lain", callback_data: "mgr:perf:menu" },
      { text: "🔁 Ganti AM", callback_data: "mgr:am:list:0" },
    ],
    [
      { text: "🏠 Menu Utama", callback_data: "nav:main" },
    ],
  ],
};

const MGR_ACTIVITY_LABEL_KEYBOARD = {
  inline_keyboard: [
    [
      { text: "👥 Dengan Pelanggan", callback_data: "mgr:act:pelanggan" },
      { text: "🏗️ Pelanggan Dengan Proyek", callback_data: "mgr:act:proyek" },
    ],
    [
      { text: "🔁 Ganti AM", callback_data: "mgr:am:list:0" },
      { text: "🏠 Menu Utama", callback_data: "nav:main" },
    ],
  ],
};

// ── Constants ───────────────────────────────────────────────────────────────

const MONTH_NAMES = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const AM_PER_PAGE = 5;

// ── Message builders ────────────────────────────────────────────────────────

function buildCoreBody(): string {
  return (
    `Bot ini siap bantu kamu pantau 3 hal penting:\n\n` +
    `1. 📋 *Sales Funneling*\n` +
    `Update & pergerakan LOP yang kamu handle, termasuk yang perlu segera ditindaklanjuti.\n\n` +
    `2. 📅 *Sales Activity*\n` +
    `Pantauan KPI activity kamu — hanya aktivitas *Dengan Pelanggan* yang dihitung KPI ya kak.\n\n` +
    `3. 📊 *Performansi Revenue*\n` +
    `Rekap capaian Revenue, Sustain, Scaling, dan NGTMA setiap periode.\n\n` +
    `*⚠️ PENTING — Mohon Perhatikan!*\n\n` +
    `*Jangan di-mute apalagi hapus bot ini ya kak.* Bot hadir buat bantu kamu on track, pantau progress, dan ngejar target setiap periode. Tanpa notifikasi ini, kamu bisa ketinggalan info penting! 🎯\n\n` +
    `💪 Yuk segera menangkan LOP yang ada dan terus gali prospek proyek baru — rezeki nggak akan datang sendiri, semangat kak!\n\n` +
    `Pilih menu di bawah untuk akses data:`
  );
}

async function buildWelcomeLinked(namaLengkap: string): Promise<string> {
  const greeting = greetingByTime();
  return (
    `✅ *Akun berhasil terhubung!* 🎉\n\n` +
    `Hai kak *${namaLengkap}*! 👋 ${greeting}\n\n` +
    `Selamat datang di *BOT LESA VI — Witel Suramadu TREG 3!* 🏢\n\n` +
    buildCoreBody()
  );
}

async function buildWelcomeReturning(namaLengkap: string): Promise<string> {
  const greeting = greetingByTime();
  return (
    `Hai kak *${namaLengkap}*! 👋 ${greeting}\n\n` +
    `Selamat datang kembali di *BOT LESA VI — Witel Suramadu TREG 3!* 🏢\n\n` +
    buildCoreBody()
  );
}

function buildWelcomeOfficer(namaLengkap: string): string {
  const greeting = greetingByTime();
  return (
    `Hai kak *${namaLengkap}*! 👋 ${greeting}\n\n` +
    `Selamat datang di *BOT LESA VI — Witel Suramadu TREG 3!* 🏢\n\n` +
    `Sebagai *Officer*, kamu bisa upload data langsung dari sini:\n\n` +
    `📊 *Performance* — Data performa AM\n` +
    `📋 *Funneling* — Data sales funnel\n` +
    `📅 *Activity* — Data sales activity\n\n` +
    `Cukup pilih tipe data, lalu kirim file Excel-nya. Bot akan otomatis memproses dan mengimport datanya ke sistem. 🚀\n\n` +
    `Pilih menu di bawah:`
  );
}

function buildWelcomeManager(namaLengkap: string): string {
  const greeting = greetingByTime();
  return (
    `Hai kak *${namaLengkap}*! 👋 ${greeting}\n\n` +
    `Selamat datang di *BOT LESA VI — Witel Suramadu TREG 3!* 🏢\n\n` +
    `Sebagai *Manager*, kamu bisa memonitor data AM secara langsung dari sini:\n\n` +
    `1. 👤 Pilih AM yang ingin dilihat\n` +
    `2. 📋📅📊 Lihat Funneling, Activity, atau Performansi\n\n` +
    `Pilih menu di bawah:`
  );
}

function buildWelcomeUnlinked(firstName: string, chatId: string): string {
  return (
    `Halo *${firstName}*! 👋\n\n` +
    `Saya Bot LESA VI — AM Reminder Witel Suramadu TREG 3.\n\n` +
    `Untuk terhubung ke sistem, klik *link verifikasi* yang dikirimkan admin kepadamu. Atau bagikan ID berikut ke admin untuk dihubungkan secara manual:\n\n` +
    `🆔 *Chat ID kamu:* \`${chatId}\`\n\n` +
    `Belum dapat link? Hubungi admin LESA VI.`
  );
}

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ── Helper: get keyboard by role ────────────────────────────────────────────

function getMainKeyboardByRole(role: string) {
  switch (role) {
    case "OFFICER": return OFFICER_MAIN_KEYBOARD;
    case "MANAGER": return MANAGER_MAIN_KEYBOARD;
    default: return AM_MAIN_KEYBOARD;
  }
}

// ── Helper: build AM list keyboard for Manager ──────────────────────────────

async function buildAmListKeyboard(page: number) {
  const [ams, total] = await Promise.all([
    getActiveAMs(page, AM_PER_PAGE),
    getActiveAMsCount(),
  ]);
  const totalPages = Math.ceil(total / AM_PER_PAGE);

  const rows: { text: string; callback_data: string }[][] = [];

  for (const am of ams) {
    rows.push([{ text: `${am.nama} (${am.divisi})`, callback_data: `mgr:am:pick:${am.nik}` }]);
  }

  // Navigation row
  const navRow: { text: string; callback_data: string }[] = [];
  if (page > 0) navRow.push({ text: "◀️ Prev", callback_data: `mgr:am:list:${page - 1}` });
  navRow.push({ text: `${page + 1}/${totalPages}`, callback_data: "mgr:am:noop" });
  if (page < totalPages - 1) navRow.push({ text: "Next ▶️", callback_data: `mgr:am:list:${page + 1}` });
  if (navRow.length > 0) rows.push(navRow);

  // Action row
  rows.push([
    { text: "🔎 Cari AM", callback_data: "mgr:am:search" },
    { text: "🏠 Menu Utama", callback_data: "nav:main" },
  ]);

  return { inline_keyboard: rows };
}

// ── Helper: download Telegram file ──────────────────────────────────────────

async function downloadTelegramFile(token: string, fileId: string): Promise<Buffer> {
  const fileResp = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
  const fileData = await fileResp.json() as { ok: boolean; result?: { file_path: string } };
  if (!fileData.ok || !fileData.result?.file_path) throw new Error("Gagal mendapatkan info file dari Telegram");

  const downloadUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`;
  const resp = await fetch(downloadUrl);
  if (!resp.ok) throw new Error(`Gagal download file: ${resp.status}`);
  return Buffer.from(await resp.arrayBuffer());
}

// ── Helper: build import overview for Officer upload response ───────────────

function buildImportOverview(
  importType: "performance" | "funnel" | "activity",
  rows: Record<string, any>[],
  result: { imported: number; period: string | null },
): string {
  try {
    if (result.imported === 0) return "⚠️ _Tidak ada data yang berhasil diimport._";

    if (importType === "performance") {
      // Collect unique AM names
      const amNames = new Set<string>();
      let totalTarget = 0;
      let totalReal = 0;
      for (const r of rows) {
        const nama = String(r.NAMA_AM || r.nama_am || "").trim();
        if (nama) amNames.add(nama);
        totalTarget += parseFloat(String(r.TARGET_REVENUE ?? r.target_revenue ?? r["Target Revenue Dinamis"] ?? 0)) || 0;
        totalReal += parseFloat(String(r.REAL_REVENUE ?? r.real_revenue ?? r["Real Revenue Dinamis"] ?? 0)) || 0;
      }

      const fmtNum = (n: number) => {
        if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
        if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
        if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
        return String(Math.round(n));
      };

      const amList = [...amNames].slice(0, 8);
      const more = amNames.size > 8 ? `\n   _...dan ${amNames.size - 8} AM lainnya_` : "";

      return (
        `📋 *Overview Data Performance*\n` +
        `├ AM tercatat: *${amNames.size}* orang\n` +
        `├ Total rows Excel: *${rows.length}*\n` +
        `├ Total Target: *Rp ${fmtNum(totalTarget)}*\n` +
        `└ Total Real: *Rp ${fmtNum(totalReal)}*\n\n` +
        `👥 *AM:*\n   ${amList.join(", ")}${more}`
      );
    }

    if (importType === "funnel") {
      // Summarize funnel: unique LOP, total nilai, unique AM
      const lopIds = new Set<string>();
      const amNames = new Set<string>();
      let totalNilai = 0;
      const statusCount: Record<string, number> = {};

      for (const r of rows) {
        const lopid = String(r.lopid || "").trim();
        if (lopid) lopIds.add(lopid);
        const nama = String(r.nama_pembuat_lop || r.namaAm || "").trim();
        if (nama) amNames.add(nama.toUpperCase());
        totalNilai += parseFloat(String(r.nilai_proyek ?? 0)) || 0;
        const sf = String(r.status_f || r.statusF || "").trim();
        if (sf) statusCount[sf] = (statusCount[sf] || 0) + 1;
      }

      const fmtNum = (n: number) => {
        if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
        if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
        if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
        return String(Math.round(n));
      };

      // Top 5 statuses
      const topStatus = Object.entries(statusCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([s, c]) => `   • ${s}: ${c}`)
        .join("\n");

      return (
        `📋 *Overview Data Funneling*\n` +
        `├ Unique LOP: *${lopIds.size}*\n` +
        `├ AM tercatat: *${amNames.size}* orang\n` +
        `├ Total rows Excel: *${rows.length}*\n` +
        `└ Total Nilai Proyek: *Rp ${fmtNum(totalNilai)}*\n\n` +
        (topStatus ? `📊 *Status Funnel:*\n${topStatus}` : "")
      );
    }

    if (importType === "activity") {
      const amNames = new Set<string>();
      const labelCount: Record<string, number> = {};
      const actTypeCount: Record<string, number> = {};

      for (const r of rows) {
        const nama = String(r.fullname || "").trim();
        if (nama) amNames.add(nama.toUpperCase());
        const label = String(r.label || "").trim().toLowerCase();
        if (label) labelCount[label] = (labelCount[label] || 0) + 1;
        const at = String(r.activity_type || "").trim();
        if (at) actTypeCount[at] = (actTypeCount[at] || 0) + 1;
      }

      const topLabels = Object.entries(labelCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([l, c]) => `   • ${l}: ${c}`)
        .join("\n");

      return (
        `📋 *Overview Data Activity*\n` +
        `├ AM tercatat: *${amNames.size}* orang\n` +
        `├ Total rows Excel: *${rows.length}*\n` +
        `└ Total imported: *${result.imported}*\n\n` +
        (topLabels ? `🏷️ *Label:*\n${topLabels}` : "")
      );
    }

    return "";
  } catch {
    return "";
  }
}

// ── Main poller ─────────────────────────────────────────────────────────────

export async function pollOnce() {
  try {
    const token = await getBotToken();
    if (!token) return;
    const offset = lastUpdateId > 0 ? lastUpdateId + 1 : 0;
    const url = `https://api.telegram.org/bot${token}/getUpdates?limit=50&offset=${offset}&timeout=30`;

    const resp = await fetch(url, { signal: AbortSignal.timeout(35000) });
    if (!resp.ok) return;

    const data = await resp.json() as { ok: boolean; result: any[] };
    if (!data.ok || !data.result.length) return;

    for (const update of data.result) {
      if (update.update_id > lastUpdateId) lastUpdateId = update.update_id;

      // ── callback_query (inline keyboard buttons) ────────────────────────
      if (update.callback_query) {
        const cb = update.callback_query;
        const cbChatId = String(cb.message?.chat?.id || cb.from?.id || "");
        const cbData = (cb.data || "").trim();
        await answerCallbackQuery(token, cb.id);
        if (!cbChatId) continue;

        const linkedAm = await getLinkedAmByChatId(cbChatId);

        if (!linkedAm) {
          await sendToTelegram(token, cbChatId, `❌ Akun kamu belum terhubung. Minta admin untuk generate link verifikasi.`).catch(() => { });
          continue;
        }

        const role = linkedAm.role || "AM";
        const amFirstName = linkedAm.nama.split(" ")[0];

        // ── nav:main — kembali ke menu utama sesuai role ──────────────────
        if (cbData === "nav:main") {
          clearChatState(cbChatId);
          await sendToTelegram(token, cbChatId, `Pilih menu di bawah untuk akses data:`, getMainKeyboardByRole(role)).catch(() => { });
          continue;
        }

        // ════════════════════════════════════════════════════════════════════
        // OFFICER CALLBACKS
        // ════════════════════════════════════════════════════════════════════

        if (cbData === "off:upload" && role === "OFFICER") {
          clearChatState(cbChatId);
          await sendToTelegram(token, cbChatId,
            `📂 *Upload Data*\n\nPilih jenis data yang ingin diupload:`,
            OFFICER_UPLOAD_TYPE_KEYBOARD
          ).catch(() => { });
          continue;
        }

        if (cbData.startsWith("off:type:") && role === "OFFICER") {
          const importType = cbData.slice(9) as "performance" | "funnel" | "activity";
          const typeLabel = importType === "performance" ? "Performance" : importType === "funnel" ? "Funneling" : "Activity";
          const state = getChatState(cbChatId);
          state.mode = "officer-awaiting-document";
          state.importType = importType;

          await sendToTelegram(token, cbChatId,
            `📎 *Upload ${typeLabel}*\n\nSilakan kirim file Excel (*.xlsx*) untuk data *${typeLabel}*.\n\n_Kirim file sebagai dokumen, bukan foto._`,
            { inline_keyboard: [[{ text: "❌ Batal", callback_data: "off:cancel" }]] }
          ).catch(() => { });
          continue;
        }

        if (cbData === "off:cancel" && role === "OFFICER") {
          clearChatState(cbChatId);
          await sendToTelegram(token, cbChatId, `Pilih menu di bawah:`, OFFICER_MAIN_KEYBOARD).catch(() => { });
          continue;
        }

        // ════════════════════════════════════════════════════════════════════
        // MANAGER CALLBACKS
        // ════════════════════════════════════════════════════════════════════

        // AM list (paginated)
        if (cbData.startsWith("mgr:am:list:") && role === "MANAGER") {
          clearChatState(cbChatId);
          const page = parseInt(cbData.slice(12), 10) || 0;
          const keyboard = await buildAmListKeyboard(page);
          await sendToTelegram(token, cbChatId,
            `👤 *Pilih Account Manager*\n\nPilih AM yang ingin kamu lihat datanya:`,
            keyboard
          ).catch(() => { });
          continue;
        }

        // noop (page indicator button)
        if (cbData === "mgr:am:noop") continue;

        // AM search trigger
        if (cbData === "mgr:am:search" && role === "MANAGER") {
          const state = getChatState(cbChatId);
          state.mode = "mgr-awaiting-search";
          await sendToTelegram(token, cbChatId,
            `🔎 *Cari AM*\n\nKetik nama atau NIK AM yang ingin dicari:`,
            { inline_keyboard: [[{ text: "⬅️ Kembali ke Daftar", callback_data: "mgr:am:list:0" }]] }
          ).catch(() => { });
          continue;
        }

        // AM pick
        if (cbData.startsWith("mgr:am:pick:") && role === "MANAGER") {
          const nik = cbData.slice(12);
          const [pickedAm] = await db.select().from(accountManagersTable)
            .where(eq(accountManagersTable.nik, nik));

          if (!pickedAm) {
            await sendToTelegram(token, cbChatId, `❌ AM tidak ditemukan.`).catch(() => { });
            continue;
          }

          const state = getChatState(cbChatId);
          state.mode = "mgr-am-selected";
          state.selectedNik = nik;
          state.selectedNama = pickedAm.nama;

          await sendToTelegram(token, cbChatId,
            `✅ AM terpilih: *${pickedAm.nama}* (${pickedAm.divisi})\n\nPilih data yang ingin dilihat:`,
            buildManagerAmDataKeyboard(pickedAm.nama)
          ).catch(() => { });
          continue;
        }

        // Manager data: Funneling
        if (cbData === "mgr:data:funneling" && role === "MANAGER") {
          const state = getChatState(cbChatId);
          if (!state.selectedNik) {
            await sendToTelegram(token, cbChatId, `❌ Pilih AM terlebih dahulu.`, MANAGER_MAIN_KEYBOARD).catch(() => { });
            continue;
          }
          const period = currentPeriod();
          const msgs = await buildTelegramMessages(state.selectedNik, period, { includePerformance: false, includeFunnel: true, includeActivity: false });
          for (const m of msgs) await sendToTelegram(token, cbChatId, m).catch(() => { });
          if (!msgs.length) await sendToTelegram(token, cbChatId, `Belum ada data funneling untuk *${state.selectedNama}* periode ini.`).catch(() => { });
          await sendToTelegram(token, cbChatId, `Pilih data lain atau ganti AM:`, buildManagerAmDataKeyboard(state.selectedNama || "")).catch(() => { });
          continue;
        }

        // Manager data: Activity
        if (cbData === "mgr:data:activity" && role === "MANAGER") {
          const state = getChatState(cbChatId);
          if (!state.selectedNik) {
            await sendToTelegram(token, cbChatId, `❌ Pilih AM terlebih dahulu.`, MANAGER_MAIN_KEYBOARD).catch(() => { });
            continue;
          }
          const period = currentPeriod();
          const msgs = await buildTelegramMessages(state.selectedNik, period, { includePerformance: false, includeFunnel: false, includeActivity: true });
          for (const m of msgs) await sendToTelegram(token, cbChatId, m).catch(() => { });
          if (!msgs.length) await sendToTelegram(token, cbChatId, `Belum ada data activity untuk *${state.selectedNama}* periode ini.`).catch(() => { });

          await sendToTelegram(token, cbChatId,
            `Mau lihat detail berdasarkan kategori?`,
            MGR_ACTIVITY_LABEL_KEYBOARD
          ).catch(() => { });
          continue;
        }

        // Manager activity label filter
        if (cbData.startsWith("mgr:act:") && role === "MANAGER") {
          const state = getChatState(cbChatId);
          if (!state.selectedNik) continue;
          const labelMap: Record<string, string> = { "pelanggan": "dengan pelanggan", "proyek": "pelanggan dengan proyek" };
          const key = cbData.slice(8);
          const label = labelMap[key];
          if (label) {
            const period = currentPeriod();
            const msgs = await buildTelegramMessages(state.selectedNik, period, {
              includePerformance: false, includeFunnel: false, includeActivity: true, activityLabel: label
            });
            for (const m of msgs) await sendToTelegram(token, cbChatId, m).catch(() => { });
            if (!msgs.length) {
              await sendToTelegram(token, cbChatId, `Belum ada data untuk kategori *${label}* untuk *${state.selectedNama}*.`).catch(() => { });
            }
          }
          continue;
        }

        // Manager data: Performansi (period picker)
        if (cbData === "mgr:data:performansi" && role === "MANAGER") {
          const state = getChatState(cbChatId);
          if (!state.selectedNik) {
            await sendToTelegram(token, cbChatId, `❌ Pilih AM terlebih dahulu.`, MANAGER_MAIN_KEYBOARD).catch(() => { });
            continue;
          }
          const now = new Date();
          const displayMonth = `${MONTH_NAMES[now.getMonth() + 1]} ${now.getFullYear()}`;
          const pickerKeyboard = {
            inline_keyboard: [
              [{ text: `📅 Bulan Terkini (${displayMonth})`, callback_data: "mgr:perf:current" }],
              [{ text: "🗓 Pilih Bulan Lain", callback_data: "mgr:perf:menu" }],
            ],
          };
          await sendToTelegram(token, cbChatId,
            `📊 *Performansi ${state.selectedNama}*\n\nMau lihat rekap performansi bulan apa?`,
            pickerKeyboard
          ).catch(() => { });
          continue;
        }

        // Manager perf: current
        if (cbData === "mgr:perf:current" && role === "MANAGER") {
          const state = getChatState(cbChatId);
          if (!state.selectedNik) continue;
          const period = currentPeriod();
          const msgs = await buildTelegramMessages(state.selectedNik, period, { includePerformance: true, includeFunnel: false, includeActivity: false });
          for (const m of msgs) await sendToTelegram(token, cbChatId, m).catch(() => { });
          if (!msgs.length) {
            const now = new Date();
            await sendToTelegram(token, cbChatId,
              `_Data performansi untuk *${MONTH_NAMES[now.getMonth() + 1]} ${now.getFullYear()}* belum tersedia untuk *${state.selectedNama}*._`
            ).catch(() => { });
          } else {
            await sendToTelegram(token, cbChatId, `Butuh data lain? 😊`, MGR_PERF_NAV_KEYBOARD).catch(() => { });
          }
          continue;
        }

        // Manager perf: menu (period list)
        if (cbData === "mgr:perf:menu" && role === "MANAGER") {
          const state = getChatState(cbChatId);
          if (!state.selectedNik) continue;
          const periods = await getAvailablePerfPeriods(state.selectedNik);
          if (!periods.length) {
            await sendToTelegram(token, cbChatId, `❌ Belum ada data performansi untuk *${state.selectedNama}*.`).catch(() => { });
            continue;
          }
          const SHORT_MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
          const buttons = periods.map(p => ({
            text: `${SHORT_MONTHS[p.bulan]} ${p.tahun}`,
            callback_data: `mgr:perf:${p.tahun}-${String(p.bulan).padStart(2, "0")}`,
          }));
          const rows: typeof buttons[] = [];
          for (let i = 0; i < buttons.length; i += 3) rows.push(buttons.slice(i, i + 3));
          await sendToTelegram(token, cbChatId,
            `🗓 *Pilih Periode* — ${state.selectedNama}`,
            { inline_keyboard: rows }
          ).catch(() => { });
          continue;
        }

        // Manager perf: specific period
        if (cbData.startsWith("mgr:perf:") && role === "MANAGER") {
          const state = getChatState(cbChatId);
          if (!state.selectedNik) continue;
          const periodStr = cbData.slice(9);
          if (/^\d{4}-\d{2}$/.test(periodStr)) {
            const msgs = await buildTelegramMessages(state.selectedNik, periodStr, { includePerformance: true, includeFunnel: false, includeActivity: false });
            for (const m of msgs) await sendToTelegram(token, cbChatId, m).catch(() => { });
            if (!msgs.length) {
              const [yr, mo] = periodStr.split("-").map(Number);
              await sendToTelegram(token, cbChatId,
                `_Data performansi untuk *${MONTH_NAMES[mo]} ${yr}* tidak ditemukan untuk *${state.selectedNama}*._`
              ).catch(() => { });
            } else {
              await sendToTelegram(token, cbChatId, `Butuh data lain? 😊`, MGR_PERF_NAV_KEYBOARD).catch(() => { });
            }
          }
          continue;
        }

        // ════════════════════════════════════════════════════════════════════
        // AM CALLBACKS (existing, backward compatible)
        // ════════════════════════════════════════════════════════════════════

        if (role === "AM" || (!cbData.startsWith("off:") && !cbData.startsWith("mgr:"))) {
          // Funneling
          if (cbData === "/funneling") {
            const period = currentPeriod();
            const opts = { includePerformance: false, includeFunnel: true, includeActivity: false };
            const msgs = await buildTelegramMessages(linkedAm.nik, period, opts);
            for (const m of msgs) await sendToTelegram(token, cbChatId, m).catch(() => { });
            if (!msgs.length) await sendToTelegram(token, cbChatId, `Belum ada data untuk periode ini kak *${amFirstName}*.`).catch(() => { });
            continue;
          }

          // Activity: show summary + label picker
          if (cbData === "/activity") {
            const period = currentPeriod();
            const opts = { includePerformance: false, includeFunnel: false, includeActivity: true };
            const msgs = await buildTelegramMessages(linkedAm.nik, period, opts);
            for (const m of msgs) await sendToTelegram(token, cbChatId, m).catch(() => { });

            await sendToTelegram(token, cbChatId,
              `Mau lihat detail *Sales Activity* berdasarkan kategori apa, kak *${amFirstName}*?`,
              ACTIVITY_LABEL_KEYBOARD
            ).catch(() => { });
            continue;
          }

          // Activity label filter
          if (cbData.startsWith("act:")) {
            const labelMap: Record<string, string> = {
              "pelanggan": "dengan pelanggan",
              "proyek": "pelanggan dengan proyek"
            };
            const key = cbData.slice(4);
            const label = labelMap[key];
            if (label) {
              const period = currentPeriod();
              const msgs = await buildTelegramMessages(linkedAm.nik, period, {
                includePerformance: false, includeFunnel: false, includeActivity: true, activityLabel: label
              });
              for (const m of msgs) await sendToTelegram(token, cbChatId, m).catch(() => { });
              if (!msgs.length) {
                await sendToTelegram(token, cbChatId, `Belum ada data untuk kategori *${label}* periode ini kak *${amFirstName}*.`).catch(() => { });
              }
            }
            continue;
          }

          // Performansi: show period picker
          if (cbData === "/performansi") {
            const now = new Date();
            const displayMonth = `${MONTH_NAMES[now.getMonth() + 1]} ${now.getFullYear()}`;
            const pickerKeyboard = {
              inline_keyboard: [
                [{ text: `📅 Bulan Terkini (${displayMonth})`, callback_data: "perf:current" }],
                [{ text: "🗓 Pilih Bulan Lain", callback_data: "perf:menu" }],
              ],
            };
            await sendToTelegram(token, cbChatId,
              `📊 *Performansi Revenue*\n\nMau lihat rekap performansi bulan apa, kak *${amFirstName}*?`,
              pickerKeyboard
            ).catch(() => { });
            continue;
          }

          // perf:current
          if (cbData === "perf:current") {
            const period = currentPeriod();
            const msgs = await buildTelegramMessages(linkedAm.nik, period, { includePerformance: true, includeFunnel: false, includeActivity: false });
            for (const m of msgs) await sendToTelegram(token, cbChatId, m).catch(() => { });
            if (!msgs.length) {
              const now = new Date();
              await sendToTelegram(token, cbChatId,
                `_Data performansi untuk *${MONTH_NAMES[now.getMonth() + 1]} ${now.getFullYear()}* belum tersedia kak *${amFirstName}*. Mungkin belum diimport bulan ini._`
              ).catch(() => { });
            } else {
              await sendToTelegram(token, cbChatId, `Butuh apa lagi kak *${amFirstName}*? 😊`, PERF_NAV_KEYBOARD).catch(() => { });
            }
            continue;
          }

          // perf:menu
          if (cbData === "perf:menu") {
            const periods = await getAvailablePerfPeriods(linkedAm.nik);
            if (!periods.length) {
              await sendToTelegram(token, cbChatId, `❌ Belum ada data performansi tersimpan untuk akun kamu kak *${amFirstName}*.`).catch(() => { });
              continue;
            }
            const SHORT_MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
            const buttons = periods.map(p => ({
              text: `${SHORT_MONTHS[p.bulan]} ${p.tahun}`,
              callback_data: `perf:${p.tahun}-${String(p.bulan).padStart(2, "0")}`,
            }));
            const rows: typeof buttons[] = [];
            for (let i = 0; i < buttons.length; i += 3) rows.push(buttons.slice(i, i + 3));
            await sendToTelegram(token, cbChatId,
              `🗓 *Pilih Periode Performansi*\n\nSilakan pilih bulan yang ingin kamu lihat kak *${amFirstName}*:`,
              { inline_keyboard: rows }
            ).catch(() => { });
            continue;
          }

          // perf:YYYY-MM
          if (cbData.startsWith("perf:")) {
            const periodStr = cbData.slice(5);
            if (/^\d{4}-\d{2}$/.test(periodStr)) {
              const msgs = await buildTelegramMessages(linkedAm.nik, periodStr, { includePerformance: true, includeFunnel: false, includeActivity: false });
              for (const m of msgs) await sendToTelegram(token, cbChatId, m).catch(() => { });
              if (!msgs.length) {
                const [yr, mo] = periodStr.split("-").map(Number);
                await sendToTelegram(token, cbChatId,
                  `_Data performansi untuk *${MONTH_NAMES[mo]} ${yr}* tidak ditemukan kak *${amFirstName}*._`
                ).catch(() => { });
              } else {
                await sendToTelegram(token, cbChatId, `Butuh apa lagi kak *${amFirstName}*? 😊`, PERF_NAV_KEYBOARD).catch(() => { });
              }
            }
            continue;
          }
        }

        continue;
      }

      // ── Regular messages ───────────────────────────────────────────────
      const msg = update.message;
      if (!msg) continue;

      const chatId = String(msg.chat.id);
      const firstName = msg.from?.first_name || msg.chat?.first_name || "";
      const lastName = msg.from?.last_name || msg.chat?.last_name || "";
      const username = msg.from?.username || "";
      const text = (msg.text || "").trim();

      upsertBotUser({
        chatId, firstName, lastName, username,
        lastMessage: text.slice(0, 80) || (msg.document ? `[File] ${msg.document.file_name || ""}` : ""),
        lastSeen: new Date().toISOString(),
      }).catch(() => {});

      const isVerifCode = (s: string) => /^\d{6}$/.test(s) || /^LESAVI-\d+$/i.test(s);

      const tryLinkByCode = async (code: string, source: string) => {
        const now = new Date();
        const [am] = await db.select().from(accountManagersTable)
          .where(eq(accountManagersTable.telegramCode, code));
        if (!am) {
          await sendToTelegram(token, chatId, `❌ Link/kode tidak valid atau sudah kadaluarsa.\n\nMinta admin untuk generate link baru.`).catch(() => { });
          return false;
        }
        if (!am.telegramCodeExpiry || am.telegramCodeExpiry <= now) {
          await sendToTelegram(token, chatId, `⏰ Link sudah kadaluarsa.\n\nMinta admin untuk generate link baru.`).catch(() => { });
          return false;
        }
        await db.update(accountManagersTable)
          .set({ telegramChatId: chatId, telegramCode: null, telegramCodeExpiry: null })
          .where(eq(accountManagersTable.id, am.id));
        invalidateAmCache(chatId);
        upsertBotUser({ ...botUsersMap.get(chatId)!, lastMessage: `✅ Linked via ${source}` }).catch(() => {});

        // Send role-appropriate welcome
        const role = am.role || "AM";
        if (role === "OFFICER") {
          await sendToTelegram(token, chatId, buildWelcomeOfficer(am.nama), OFFICER_MAIN_KEYBOARD).catch(() => { });
        } else if (role === "MANAGER") {
          await sendToTelegram(token, chatId, buildWelcomeManager(am.nama), MANAGER_MAIN_KEYBOARD).catch(() => { });
        } else {
          await sendToTelegram(token, chatId, await buildWelcomeLinked(am.nama), AM_MAIN_KEYBOARD).catch(() => { });
        }
        logger.info({ amId: am.id, nama: am.nama, chatId, source, role }, "Account auto-linked");
        return true;
      };

      // ── /start ────────────────────────────────────────────────────────
      if (text.startsWith("/start")) {
        clearChatState(chatId);
        const deepLinkCode = text.slice(6).trim();
        if (isVerifCode(deepLinkCode)) {
          await tryLinkByCode(deepLinkCode, "magic link");
          continue;
        }
        const linkedAm = await getLinkedAmByChatId(chatId);
        if (linkedAm) {
          const role = linkedAm.role || "AM";
          if (role === "OFFICER") {
            await sendToTelegram(token, chatId, buildWelcomeOfficer(linkedAm.nama), OFFICER_MAIN_KEYBOARD).catch(() => { });
          } else if (role === "MANAGER") {
            await sendToTelegram(token, chatId, buildWelcomeManager(linkedAm.nama), MANAGER_MAIN_KEYBOARD).catch(() => { });
          } else if (role === "AM") {
            await sendToTelegram(token, chatId, await buildWelcomeReturning(linkedAm.nama), AM_MAIN_KEYBOARD).catch(() => { });
          } else {
            await sendToTelegram(token, chatId,
              `⚠️ Role akun kamu (*${role}*) belum dikonfigurasi untuk bot ini.\n\nHubungi admin LESA VI untuk bantuan.`
            ).catch(() => { });
          }
        } else {
          await sendToTelegram(token, chatId, buildWelcomeUnlinked(firstName, chatId)).catch(() => { });
        }
        continue;
      }

      // ── /myid ─────────────────────────────────────────────────────────
      if (text === "/myid") {
        await sendToTelegram(token, chatId,
          `🆔 *Chat ID kamu:* \`${chatId}\`\n\nBagikan ID ini ke admin LESA VI untuk menghubungkan akun kamu ke sistem.`
        ).catch(() => { });
        continue;
      }

      // ── Document handler (Officer upload) ─────────────────────────────
      if (msg.document) {
        const linkedAm = await getLinkedAmByChatId(chatId);

        if (!linkedAm || linkedAm.role !== "OFFICER") {
          // Non-officer sending document — ignore or inform
          if (linkedAm) {
            await sendToTelegram(token, chatId, `ℹ️ Fitur upload hanya tersedia untuk Officer.`).catch(() => { });
          }
          continue;
        }

        const state = getChatState(chatId);
        if (state.mode !== "officer-awaiting-document" || !state.importType) {
          await sendToTelegram(token, chatId,
            `📂 Untuk upload, pilih jenis data terlebih dahulu:`,
            OFFICER_UPLOAD_TYPE_KEYBOARD
          ).catch(() => { });
          continue;
        }

        const fileName = msg.document.file_name || "";
        const fileSize = msg.document.file_size || 0;
        const ext = fileName.toLowerCase().split(".").pop();

        if (!["xlsx", "xls"].includes(ext || "")) {
          await sendToTelegram(token, chatId, `❌ Format file tidak didukung. Kirim file *.xlsx* atau *.xls*.`).catch(() => { });
          continue;
        }

        if (fileSize > 20 * 1024 * 1024) {
          await sendToTelegram(token, chatId, `❌ Ukuran file terlalu besar (max 20MB).`).catch(() => { });
          continue;
        }

        const importType = state.importType;
        const typeLabel = importType === "performance" ? "Performance" : importType === "funnel" ? "Funneling" : "Activity";
        // Escape underscore in fileName to prevent Markdown parse errors
        const safeFileName = fileName.replace(/_/g, "\\_");
        await sendToTelegram(token, chatId, `⏳ Memproses file *${typeLabel}*...\n_${safeFileName}_`).catch(() => { });

        try {
          const fileBuf = await downloadTelegramFile(token, msg.document.file_id);

          // Auto-detect best sheet for performance imports
          let resolvedSheet: string | undefined;
          if (importType === "performance") {
            const sheetNames = getWorkbookSheetNames(fileBuf);
            if (sheetNames.length > 1) {
              const up = (s: string) => s.toUpperCase().trim();
              resolvedSheet =
                sheetNames.find(s => up(s) === "RAW_AM_DATA" || up(s).replace(/[^A-Z0-9]/g, "") === "RAWAMDATA") ||
                sheetNames.find(s => up(s).includes("RAW") && (up(s).includes("AM") || up(s).includes("DATA"))) ||
                sheetNames.find(s => up(s).includes("RAW")) ||
                sheetNames.find(s => up(s).includes("DATA") || up(s).includes("PERFORMANSI") || up(s).includes("PERFORMA")) ||
                sheetNames[0];
            }
          }

          const rows = parseExcelBuffer(fileBuf, resolvedSheet);

          if (rows.length === 0) {
            clearChatState(chatId);
            await sendToTelegram(token, chatId,
              `❌ *File kosong atau tidak dapat dibaca*\n\n` +
              `File \`${fileName}\` tidak mengandung data yang valid.${resolvedSheet ? `\nSheet yang dibaca: \`${resolvedSheet}\`` : ""}\n\n` +
              `Pastikan file Excel berisi data dengan header yang sesuai.`,
              OFFICER_MAIN_KEYBOARD
            ).catch((sendErr) => {
              logger.error({ sendErr, fileName }, "Failed to send empty-file message to Telegram");
            });
            continue;
          }

          const snapshotDate = new Date().toISOString().slice(0, 10);
          const sourceUrl = `telegram-upload:${fileName}`;

          let result: { imported: number; importId: number | null; period: string | null };

          if (importType === "performance") {
            result = await importPerformance(rows, sourceUrl, null, snapshotDate, fileName);
          } else if (importType === "funnel") {
            result = await importFunnel(rows, sourceUrl, null, snapshotDate, fileName);
          } else {
            result = await importActivity(rows, sourceUrl, null, snapshotDate, fileName);
          }

          clearChatState(chatId);

          // Build overview based on import type
          const overview = await buildImportOverview(importType, rows, result);

          await sendToTelegram(token, chatId,
            `✅ *Import ${typeLabel} Berhasil!*\n\n` +
            `📄 *File:* \`${fileName}\`\n` +
            `📊 *Rows imported:* ${result.imported}\n` +
            `📅 *Period:* ${result.period || "-"}\n` +
            `🆔 *Import ID:* ${result.importId || "-"}\n` +
            (resolvedSheet ? `📋 *Sheet:* \`${resolvedSheet}\`\n` : "") +
            `\n${overview}`,
            OFFICER_MAIN_KEYBOARD
          ).catch(() => { });

          logger.info({ type: importType, fileName, rows: result.imported, importId: result.importId, officer: linkedAm.nama }, "Telegram bot import success");
        } catch (err) {
          clearChatState(chatId);
          const errMsg = err instanceof Error ? err.message : "Unknown error";
          const isConflict = !!(err as any)?.conflict || (err as any)?.status === 409;
          logger.error({ err, fileName, type: importType, officer: linkedAm.nama }, "Telegram bot import failed");
          if (isConflict) {
            await sendToTelegram(token, chatId,
              `⚠️ *File sudah pernah diimport*\n\n` +
              `📄 File: \`${fileName}\`\n` +
              `ℹ️ ${errMsg.slice(0, 500)}\n\n` +
              `Silakan upload file periode/snapshot lain, atau gunakan overwrite dari dashboard jika memang ingin mengganti data lama.`,
              OFFICER_MAIN_KEYBOARD
            ).catch((sendErr) => {
              logger.error({ sendErr, fileName, type: importType }, "Failed to send conflict message to Telegram");
            });
          } else {
            // Use backtick (code) format for fileName to avoid Markdown parse errors with underscores/dots
            await sendToTelegram(token, chatId,
              `❌ *Gagal import ${typeLabel}*\n\n` +
              `📄 File: \`${fileName}\`\n` +
              `⚠️ Error: ${errMsg.slice(0, 500)}\n\n` +
              `Pastikan format file sesuai dan header kolom benar lalu coba lagi.`,
              OFFICER_MAIN_KEYBOARD
            ).catch((sendErr) => {
              logger.error({ sendErr, fileName, type: importType }, "Failed to send error message to Telegram");
            });
          }
        }
        continue;
      }

      // ── Text shortcuts (AM only) ──────────────────────────────────────
      if (["/funneling", "/activity", "/performansi"].includes(text)) {
        const linkedAm = await getLinkedAmByChatId(chatId);
        if (!linkedAm) {
          await sendToTelegram(token, chatId, `❌ Akun kamu belum terhubung. Minta admin untuk generate link verifikasi.`).catch(() => { });
          continue;
        }
        const amFirstName = linkedAm.nama.split(" ")[0];
        const role = linkedAm.role || "AM";

        // If not AM, redirect to their menu
        if (role !== "AM") {
          await sendToTelegram(token, chatId, `Gunakan menu di bawah:`, getMainKeyboardByRole(role)).catch(() => { });
          continue;
        }

        // /performansi → show period picker
        if (text === "/performansi") {
          const now = new Date();
          const displayMonth = `${MONTH_NAMES[now.getMonth() + 1]} ${now.getFullYear()}`;
          const pickerKeyboard = {
            inline_keyboard: [
              [{ text: `📅 Bulan Terkini (${displayMonth})`, callback_data: "perf:current" }],
              [{ text: "🗓 Pilih Bulan Lain", callback_data: "perf:menu" }],
            ],
          };
          await sendToTelegram(token, chatId,
            `📊 *Performansi Revenue*\n\nMau lihat rekap performansi bulan apa, kak *${amFirstName}*?`,
            pickerKeyboard
          ).catch(() => { });
          continue;
        }

        const period = currentPeriod();
        const opts = { includePerformance: false, includeFunnel: text === "/funneling", includeActivity: text === "/activity" };
        const msgs = await buildTelegramMessages(linkedAm.nik, period, opts);
        for (const m of msgs) await sendToTelegram(token, chatId, m).catch(() => { });
        if (!msgs.length) await sendToTelegram(token, chatId, `Belum ada data untuk periode ini kak *${amFirstName}*.`).catch(() => { });
        continue;
      }

      // ── Verification code ─────────────────────────────────────────────
      if (isVerifCode(text)) {
        await tryLinkByCode(text, "manual code");
        continue;
      }

      // ── Manager search handler ────────────────────────────────────────
      if (text && !text.startsWith("/")) {
        const state = getChatState(chatId);
        if (state.mode === "mgr-awaiting-search") {
          const results = await searchAMs(text);
          if (results.length === 0) {
            await sendToTelegram(token, chatId,
              `❌ Tidak ditemukan AM dengan nama/NIK "*${text}*".`,
              { inline_keyboard: [[{ text: "⬅️ Kembali ke Daftar", callback_data: "mgr:am:list:0" }]] }
            ).catch(() => { });
          } else {
            const rows = results.map(am => [{ text: `${am.nama} (${am.divisi})`, callback_data: `mgr:am:pick:${am.nik}` }]);
            rows.push([{ text: "⬅️ Kembali ke Daftar", callback_data: "mgr:am:list:0" }]);
            await sendToTelegram(token, chatId,
              `🔎 Hasil pencarian "*${text}*" (${results.length}):`,
              { inline_keyboard: rows }
            ).catch(() => { });
          }
          state.mode = undefined;
          continue;
        }
      }

      // ── AI chat for all other messages ────────────────────────────────
      if (text && !text.startsWith("/")) {
        const linkedAm = await getLinkedAmByChatId(chatId);

        const aiReply = await chatWithGemini(text, {
          amName: linkedAm?.nama,
          divisi: linkedAm?.divisi,
        });

        if (aiReply) {
          await sendToTelegram(token, chatId, aiReply).catch(() => { });
        } else if (!linkedAm) {
          await sendToTelegram(token, chatId,
            `Halo kak! Untuk bisa menggunakan bot ini, kamu perlu terhubung ke sistem dulu ya.\n\nKetik /myid untuk dapat Chat ID kamu.`
          ).catch(() => { });
        }
      }
    }
  } catch (err) {
    logger.debug({ err }, "Telegram poller error (non-fatal)");
  }
}

async function deleteWebhookIfAny(token: string) {
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`);
    const data = await resp.json() as { ok: boolean };
    if (data.ok) logger.info("Telegram webhook deleted — using getUpdates polling");
  } catch { /* non-fatal */ }
}

export function startTelegramPoller(intervalMs = 100) {
  const run = async () => {
    await pollOnce();
    pollerTimer = setTimeout(run, intervalMs);
  };
  db.select().from(appSettingsTable).then(([settings]) => {
    if (settings?.telegramBotToken) {
      deleteWebhookIfAny(settings.telegramBotToken).then(() => {
        logger.info({ intervalMs }, "Telegram background poller started");
        pollerTimer = setTimeout(run, 3000);
      });
    } else {
      logger.info({ intervalMs }, "Telegram background poller started (no token yet)");
      pollerTimer = setTimeout(run, 5000);
    }
  }).catch(() => { pollerTimer = setTimeout(run, 5000); });
}

export function stopTelegramPoller() {
  if (pollerTimer) { clearTimeout(pollerTimer); pollerTimer = null; }
}

export function rescheduleTelegramPoller(newToken?: string) {
  logger.info("Telegram poller rescheduled — token updated");
  stopTelegramPoller();
  invalidateBotTokenCache();
  lastUpdateId = 0;
  const restart = async () => {
    if (newToken) {
      try {
        await (async () => {
          const resp = await fetch(`https://api.telegram.org/bot${newToken}/deleteWebhook?drop_pending_updates=false`);
          const data = await resp.json() as { ok: boolean };
          if (data.ok) logger.info("Webhook cleared for new token");
        })();
      } catch { /* non-fatal */ }
    }
    startTelegramPoller(100);
  };
  setTimeout(() => restart().catch(() => { }), 500);
}
