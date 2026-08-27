import { db, accountManagersTable, appSettingsTable, telegramBotUsersTable, telegramAccessCodesTable } from "@workspace/db";
import { eq, and, gt, inArray } from "drizzle-orm";
import { sendToTelegram, answerCallbackQuery, greetingByTime, buildTelegramMessages, getAvailablePerfPeriods } from "./service";
import { chatWithGemini, generateBasaBasi } from "./ai";
import { logger } from "../../shared/logger";
import bcrypt from "bcryptjs";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  OFFICER: "OFFICER",
  ACCOUNT_MANAGER: "ACCOUNT MANAGER",
};

const DAY_REMINDERS: Record<number, string> = {
  0: "", // Sunday — no special reminder
  1: "Selamat hari Senin kak! Awal minggu — yuk mulai dengan semangat baru dan target yang jelas! 💪",
  2: "", // Tuesday — no special reminder
  3: "Selamat hari Rabu kak! Sudah setengah minggu — waktunya cek progress dan pastikan target tetap on track. 📊",
  4: "", // Thursday — no special reminder
  5: "Selamat hari Jumat kak! Akhir semana kerja — pastikan semua LOPtertindak lanjuti dan rekap minggu ini! 🎯",
  6: "", // Saturday — no special reminder
};

function dayReminder(): string {
  const day = new Date().getDay();
  return DAY_REMINDERS[day] || "";
}

// Cooldown: track last full-welcome sent per chatId
const lastWelcomeSent = new Map<string, number>();
const WELCOME_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

const VERIF_CODE_UUID = "verif:code";
const VERIF_LINK_UUID = "verif:link";

let lastUpdateId = 0;
const processedUpdates = new Set<number>();
let pollerTimer: ReturnType<typeof setTimeout> | null = null;

export interface BotUser {
  chatId: string;
  firstName: string;
  lastName: string;
  username: string;
  lastMessage: string;
  lastSeen: string;
}
const botUsersMap = new Map<string, BotUser>();

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
      set: { firstName: user.firstName, lastName: user.lastName, username: user.username,
             lastMessage: user.lastMessage, lastSeen: new Date(user.lastSeen) },
    });
  } catch (err) {
    logger.debug({ err }, "Failed to persist bot user (non-fatal)");
  }
}

const MAIN_KEYBOARD_AM = {
  inline_keyboard: [
    [
      { text: "📊 Performansi AM", callback_data: "/performansi" },
    ],
    [
      { text: "📋 Sales Funneling", callback_data: "/funneling" },
      { text: "📅 Sales Activity",  callback_data: "/activity"  },
    ],
  ],
};

const MAIN_KEYBOARD_ADMIN = {
  inline_keyboard: [
    [
      { text: "📥 Import Data",   callback_data: "/import"   },
      { text: "📊 Akses Data",     callback_data: "/data"      },
    ],
    [
      { text: "🌐 Akses Website", callback_data: "/website"   },
    ],
  ],
};

function getMainKeyboard(role: string) {
  return role === "ACCOUNT_MANAGER" ? MAIN_KEYBOARD_AM : MAIN_KEYBOARD_ADMIN;
}

const PERF_NAV_KEYBOARD = {
  inline_keyboard: [
    [
      { text: "◀️ Pilih Bulan Lain", callback_data: "perf:menu" },
      { text: "🏠 Menu Utama",       callback_data: "nav:main"  },
    ],
  ],
};

const VERIF_MAIN_KEYBOARD = {
  inline_keyboard: [
    [
      { text: "📝 Masukkan Kode Verifikasi", callback_data: VERIF_CODE_UUID },
      { text: "🔗 Saya Butuh Tautan Verifikasi", callback_data: VERIF_LINK_UUID },
    ],
  ],
};

const VERIF_CODE_KEYBOARD = {
  inline_keyboard: [
    [{ text: "◀️ Kembali", callback_data: "verif:back" }],
  ],
};

const MONTH_NAMES = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

// ── Contact list builder (ADMIN, OFFICER, MANAGER who are Telegram-linked) ──
async function buildContactList(): Promise<string> {
  const contacts = await db.select({
    nama: accountManagersTable.nama,
    role: accountManagersTable.role,
    telegramChatId: accountManagersTable.telegramChatId,
    telegramUsername: accountManagersTable.telegramUsername,
  }).from(accountManagersTable)
    .where(and(
      inArray(accountManagersTable.role, ["ADMIN", "MANAGER", "OFFICER"]),
      eq(accountManagersTable.aktif, true),
    ));

  if (!contacts.length) return "";

  const lines: string[] = [];
  const byRole: Record<string, typeof contacts> = {};
  for (const c of contacts) {
    if (!byRole[c.role]) byRole[c.role] = [];
    byRole[c.role].push(c);
  }

  for (const role of ["ADMIN", "OFFICER", "MANAGER"]) {
    const members = byRole[role];
    if (!members?.length) continue;
    lines.push(`*${ROLE_LABELS[role] ?? role}:*`);
    for (const m of members) {
      const tgHandle = m.telegramUsername
        ? `@${m.telegramUsername.replace("@", "")}`
        : (m.telegramChatId ? `[chat](https://t.me/${m.telegramChatId})` : m.nama);
      lines.push(`  • ${m.nama} — ${tgHandle}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

// ── Message builders ────────────────────────────────────────────────────────

// Message 1: Konfirmasi akun berhasil terhubung (semua role)
function buildLinkedConfirm(namaLengkap: string, role: string): string {
  const roleLabel = ROLE_LABELS[role] ?? role;
  return (
    `✅ *Akun Berhasil Terhubung!* 🎉\n\n` +
    `Halo, *${namaLengkap}*! 👋\n` +
    `Kamu terdaftar sebagai *${roleLabel}* di LESA VI Witel Suramadu.\n\n` +
    `Akun Telegram kamu sudah berhasil terhubung dengan sistem. Ke depannya, kamu akan menerima informasi operasional LESA VI Witel Suramadu secara otomatis melalui bot ini.\n\n` +
    `Ingin memutuskan koneksi akun? Ketik /logout\n\n` +
    `Salam hangat dan terima kasih 🙏`
  );
}

// Message 2A: Welcome/Recurring untuk ACCOUNT MANAGER
async function buildWelcomeAM(namaLengkap: string): Promise<string> {
  const greeting = greetingByTime();
  const reminder = dayReminder();
  const reminderLine = reminder ? `\n${reminder}\n` : "\n";
  return (
    `Hai kak *${namaLengkap}*! 👋 Selamat ${greeting}~${reminderLine}` +
    `Selamat datang di *BOT LESA VI — Witel Suramadu TREG 3!* 🏢\n\n` +
    `Bot ini siap bantu kamu pantau 3 hal penting:\n\n` +
    `1. 📋 *Sales Funneling*\n` +
    `Update & pergerakan LOP yang kamu handle, termasuk yang perlu segera ditindaklanjuti.\n\n` +
    `2. 📅 *Sales Activity*\n` +
    `Pantauan KPI activity kamu — hanya aktivitas *Dengan Pelanggan* yang dihitung KPI ya kak.\n\n` +
    `3. 📊 *Performansi Revenue*\n` +
    `Rekap capaian Revenue, Sustain, Scaling, dan NGTMA setiap periode.\n\n` +
    `⚠️ *PENTING — Mohon Perhatikan!*\n\n` +
    `*Jangan di-mute apalagi dihapus ya kak.* Bot ini bantu kamu tetap on track, pantau progress, dan kejar target tiap periode. Tanpa notifikasi ini, info penting bisa terlewat! 🎯\n\n` +
    `Yuk segera menangkan LOP yang ada dan terus gali prospek baru — rezeki nggak datang sendiri, semangat kak! 💪\n\n` +
    `Pilih menu di bawah untuk akses data:`
  );
}

// Message 2B: Welcome untuk ADMIN / MANAGER / OFFICER
async function buildWelcomeAdmin(namaLengkap: string, role: string): Promise<string> {
  const greeting = greetingByTime();
  const roleLabel = ROLE_LABELS[role] ?? role;
  return (
    `Hai kak *${namaLengkap}*! 👋 Selamat ${greeting}~\n\n` +
    `Selamat datang di *BOT LESA VI — Witel Suramadu TREG 3!* 🏢\n\n` +
    `Sebagai *${roleLabel}*, melalui bot ini kamu bisa mengelola dan mengakses data operasional LESA VI Witel Suramadu — mulai dari data Performansi Revenue Account Manager, Sales Funneling, hingga Sales Activity.\n\n` +
    `Yuk mulai dari menu di bawah ini kak 👇\n\n` +
    `Pilih menu di bawah untuk akses fitur:`
  );
}

// Fallback: pesan tidak dikenali (singkat, bukan full welcome)
function buildFallback(namaLengkap: string): string {
  const greeting = greetingByTime();
  return (
    `Maaf kak, aku belum paham maksud pesannya 🙏\n\n` +
    `Ketik /start untuk lihat menu utama, atau pilih salah satu menu di bawah ini ya:\n\n` +
    `Hai kak *${namaLengkap}*! 👋 Selamat ${greeting}~\n\n` +
    `Pilih menu untuk akses fitur:`
  );
}

// First-time unlinked /start// First-time unlinked /start
async function buildWelcomeUnlinked(firstName: string): Promise<{ text: string; keyboard?: object }> {
  const greeting = greetingByTime();
  const text = (
    `${greeting}, Kak *${firstName}*! 👋\n\n` +
    `Ini adalah *Bot Telegram resmi LESA VI — Witel Suramadu*.\n\n` +
    `Sebelum bisa mengakses fitur bot ini, kami perlu memverifikasi identitas kamu terlebih dahulu 🔐\n\n` +
    `Pilih salah satu cara verifikasi di bawah ini ya kak.`
  );

  return { text, keyboard: VERIF_MAIN_KEYBOARD };
}

// Build message shown when user taps "Saya Butuh Tautan Verifikasi"
async function buildVerifLinkMessage(): Promise<{ text: string; keyboard?: object }> {
  const greeting = greetingByTime();
  const contacts = await buildContactList();

  const text = (
    `${greeting}! 👋\n\n` +
    `Bot ini menggunakan sistem *Kode Verifikasi* untuk menghubungkan akun Telegram kamu.\n\n` +
    `Jika kamu belum punya Kode Verifikasi, silakan hubungi ADMIN, OFFICER, atau MANAGER LESAVI terlebih dahulu untuk mendapatkannya.\n\n` +
    `*Berikut kontak yang bisa kamu hubungi:*\n\n` +
    `${contacts}\n\n` +
    `Setelah mendapat Kode Verifikasi, silakan ketik kode tersebut di sini.`
  );

  return { text, keyboard: VERIF_CODE_KEYBOARD };
}

// Build message shown when user taps "Masukkan Kode Verifikasi"
function buildVerifCodeMessage(): { text: string; keyboard: object } {
  return {
    text: `📝 *Masukkan Kode Verifikasi*\n\nSilakan ketik atau tempel *Kode Verifikasi* yang kamu dapat dari ADMIN, OFFICER, atau MANAGER LESAVI.\n\nFormat kode: *LV-XXXXXX* (6 karakter unik, case-insensitive)`,
    keyboard: VERIF_CODE_KEYBOARD,
  };
}

// Disconnection message — shown when chatId was previously linked to another account
function buildDisconnectedMessage(nama: string, nik: string, role: string): string {
  const roleLabel = ROLE_LABELS[role] ?? role;
  return (
    `⚠️ *Koneksi Telegram Terputus!*\n\n` +
    `Akun Telegram kamu telah terputus dari data berikut:\n\n` +
    `👤 *Nama:* ${nama}\n` +
    `🆔 *NIK:* ${nik}\n` +
    `🏷 *Role:* ${roleLabel}\n\n` +
    `Jika ini adalah *kesalahan*, silakan hubungi *ADMIN, OFFICER, atau MANAGER* LESAVI kamu untuk mendapatkan Kode Verifikasi baru dan menghubungkan ulang akun Telegram kamu.\n\n` +
    `Salam hangat dari *LESA VI Witel Suramadu* — semoga harimu lancar! 😊`
  );
}

// Get current YYYY-MM period
function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function pollOnce() {
  try {
    const [settings] = await db.select().from(appSettingsTable);
    if (!settings?.telegramBotToken) return;

    const token = settings.telegramBotToken;
    const offset = lastUpdateId > 0 ? lastUpdateId + 1 : 0;
    const url = `https://api.telegram.org/bot${token}/getUpdates?limit=50&offset=${offset}&timeout=0`;

    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return;

    const data = await resp.json() as { ok: boolean; result: any[] };
    if (!data.ok || !data.result.length) return;

    for (const update of data.result) {
      // Skip already-processed updates (defensive against race conditions)
      if (processedUpdates.has(update.update_id)) continue;
      processedUpdates.add(update.update_id);
      if (update.update_id > lastUpdateId) lastUpdateId = update.update_id;

      // Debug: log ALL incoming updates
      if (update.message) {
        const m = update.message;
        logger.info({ updateId: update.update_id, chatId: m.chat.id, text: m.text, from: m.from?.first_name }, "INCOMING MESSAGE");
      } else if (update.callback_query) {
        const cb = update.callback_query;
        logger.info({ updateId: update.update_id, cbData: cb.data, from: cb.from?.first_name, msgChatId: cb.message?.chat?.id }, "INCOMING CALLBACK");
      }

      // ── callback_query (inline keyboard buttons) ────────────────────────
      if (update.callback_query) {
        const cb = update.callback_query;
        const cbChatId = String(cb.message?.chat?.id || cb.from?.id || "");
        const cbData = (cb.data || "").trim();
        await answerCallbackQuery(token, cb.id);
        if (!cbChatId) continue;

        // ── Verification flow (works for unlinked users) ────────────────
        if (cbData === VERIF_CODE_UUID) {
          const codeMsg = buildVerifCodeMessage();
          await sendToTelegram(token, cbChatId, codeMsg.text, codeMsg.keyboard).catch(() => {});
          continue;
        }
        if (cbData === VERIF_LINK_UUID) {
          const linkMsg = await buildVerifLinkMessage();
          await sendToTelegram(token, cbChatId, linkMsg.text, linkMsg.keyboard).catch(() => {});
          continue;
        }
        if (cbData === "verif:back") {
          const [linkedAm] = await db.select().from(accountManagersTable)
            .where(eq(accountManagersTable.telegramChatId, cbChatId));
          if (linkedAm) {
            const text = linkedAm.role === "ACCOUNT_MANAGER"
              ? await buildWelcomeAM(linkedAm.nama)
              : await buildWelcomeAdmin(linkedAm.nama, linkedAm.role);
            await sendToTelegram(token, cbChatId, text, getMainKeyboard(linkedAm.role)).catch(() => {});
          } else {
            const welcome = await buildWelcomeUnlinked(cb.message?.chat?.first_name || cb.from?.first_name || "Kak");
            await sendToTelegram(token, cbChatId, welcome.text, welcome.keyboard).catch(() => {});
          }
          continue;
        }

        const [linkedAm] = await db.select().from(accountManagersTable)
          .where(eq(accountManagersTable.telegramChatId, cbChatId));

        if (!linkedAm) {
          await sendToTelegram(token, cbChatId, `❌ Akun kamu belum terhubung. Minta ADMIN, OFFICER, atau MANAGER untuk generate Kode Verifikasi.`).catch(() => {});
          continue;
        }

        const amFirstName = linkedAm.nama.split(" ")[0];

        // ── Funneling & Activity (unchanged) ────────────────────────────
        if (cbData === "/funneling" || cbData === "/activity") {
          const period = currentPeriod();
          const opts = { includePerformance: false, includeFunnel: cbData === "/funneling", includeActivity: cbData === "/activity" };
          const msgs = await buildTelegramMessages(linkedAm.nik, period, opts);
          for (const m of msgs) await sendToTelegram(token, cbChatId, m).catch(() => {});
          if (!msgs.length) await sendToTelegram(token, cbChatId, `Belum ada data untuk periode ini kak *${amFirstName}*.`).catch(() => {});
          continue;
        }

        // ── Performansi: show period picker ─────────────────────────────
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
          ).catch(() => {});
          continue;
        }

        // ── perf:current — current month, snapshot-aware ─────────────────
        if (cbData === "perf:current") {
          const period = currentPeriod();
          const msgs = await buildTelegramMessages(linkedAm.nik, period, { includePerformance: true, includeFunnel: false, includeActivity: false });
          for (const m of msgs) await sendToTelegram(token, cbChatId, m).catch(() => {});
          if (!msgs.length) {
            const now = new Date();
            await sendToTelegram(token, cbChatId,
              `_Data performansi untuk *${MONTH_NAMES[now.getMonth() + 1]} ${now.getFullYear()}* belum tersedia kak *${amFirstName}*. Mungkin belum diimport bulan ini._`
            ).catch(() => {});
          } else {
            await sendToTelegram(token, cbChatId, `Butuh apa lagi kak *${amFirstName}*? 😊`, PERF_NAV_KEYBOARD).catch(() => {});
          }
          continue;
        }

        // ── perf:menu — show available month buttons ──────────────────────
        if (cbData === "perf:menu") {
          const periods = await getAvailablePerfPeriods(linkedAm.nik);
          if (!periods.length) {
            await sendToTelegram(token, cbChatId, `❌ Belum ada data performansi tersimpan untuk akun kamu kak *${amFirstName}*.`).catch(() => {});
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
          ).catch(() => {});
          continue;
        }

        // ── perf:YYYY-MM — specific period, snapshot-aware ────────────────
        if (cbData.startsWith("perf:")) {
          const periodStr = cbData.slice(5);
          if (/^\d{4}-\d{2}$/.test(periodStr)) {
            const msgs = await buildTelegramMessages(linkedAm.nik, periodStr, { includePerformance: true, includeFunnel: false, includeActivity: false });
            for (const m of msgs) await sendToTelegram(token, cbChatId, m).catch(() => {});
            if (!msgs.length) {
              const [yr, mo] = periodStr.split("-").map(Number);
              await sendToTelegram(token, cbChatId,
                `_Data performansi untuk *${MONTH_NAMES[mo]} ${yr}* tidak ditemukan kak *${amFirstName}*._`
              ).catch(() => {});
            } else {
              await sendToTelegram(token, cbChatId, `Butuh apa lagi kak *${amFirstName}*? 😊`, PERF_NAV_KEYBOARD).catch(() => {});
            }
          }
          continue;
        }

        // ── nav:main — kembali ke menu utama ─────────────────────────────
        if (cbData === "nav:main") {
          const [linkedAm] = await db.select().from(accountManagersTable)
            .where(eq(accountManagersTable.telegramChatId, cbChatId));
          if (linkedAm) {
            const text = linkedAm.role === "ACCOUNT_MANAGER"
              ? await buildWelcomeAM(linkedAm.nama)
              : await buildWelcomeAdmin(linkedAm.nama, linkedAm.role);
            await sendToTelegram(token, cbChatId, text, getMainKeyboard(linkedAm.role)).catch(() => {});
          } else {
            await sendToTelegram(token, cbChatId, `Ketik /start untuk memulai.`, MAIN_KEYBOARD_ADMIN).catch(() => {});
          }
          continue;
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

      await upsertBotUser({
        chatId, firstName, lastName, username,
        lastMessage: text.slice(0, 80),
        lastSeen: new Date().toISOString(),
      });

      const isVerifCode = (s: string) => /^LV-[A-Z0-9]{6}$/i.test(s);

      const tryLinkByCode = async (code: string, source: string) => {
        const now = new Date();

        // ── Check if chatId was previously linked to a different account ─────
        const [previousLinked] = await db.select({
          nama: accountManagersTable.nama,
          nik: accountManagersTable.nik,
          role: accountManagersTable.role,
        }).from(accountManagersTable)
          .where(eq(accountManagersTable.telegramChatId, chatId));
        const previousLinkedAm = previousLinked;

        // ── Try new LV-XXXXXX hashed access code table ────────────────────
        const activeCodes = await db.select().from(telegramAccessCodesTable)
          .where(and(
            gt(telegramAccessCodesTable.expiresAt, now),
            eq(telegramAccessCodesTable.status, "ACTIVE")
          ));

        for (const ac of activeCodes) {
          const valid = await bcrypt.compare(code, ac.codeHash);
          if (!valid) continue;

          const [am] = await db.select().from(accountManagersTable)
            .where(eq(accountManagersTable.id, ac.userId));
          if (!am) continue;

          // ── Disconnect previous link if exists ────────────────────────────
          if (previousLinkedAm) {
            await db.update(accountManagersTable)
              .set({ telegramChatId: null, telegramUserId: null, telegramUsername: null })
              .where(eq(accountManagersTable.telegramChatId, chatId));
            const disMsg = buildDisconnectedMessage(previousLinkedAm.nama, previousLinkedAm.nik, previousLinkedAm.role);
            await sendToTelegram(token, chatId, disMsg).catch(() => {});
          }

          await db.update(accountManagersTable)
            .set({ telegramChatId: chatId, telegramLinkedAt: now, telegramLinkedByAccessCodeId: ac.id })
            .where(eq(accountManagersTable.id, am.id));
          await db.update(telegramAccessCodesTable)
            .set({ usedAt: now, status: "USED" })
            .where(eq(telegramAccessCodesTable.id, ac.id));
          await upsertBotUser({ ...botUsersMap.get(chatId)!, lastMessage: `✅ Linked via ${source}` });
          await sendToTelegram(token, chatId, buildLinkedConfirm(am.nama, am.role), getMainKeyboard(am.role)).catch(() => {});
          logger.info({ amId: am.id, nama: am.nama, role: am.role, chatId, source, accessCodeId: ac.id }, "AM linked via access code");
          return true;
        }

        // No valid code found
        await sendToTelegram(token, chatId, `❌ Kode tidak valid atau sudah kadaluarsa.\n\nMinta ADMIN, OFFICER, atau MANAGER untuk generate Kode Verifikasi baru.`).catch(() => {});
        return false;
      };

      // /start
      if (text.startsWith("/start")) {
        logger.info({ chatId, text }, "PROCESSING /start");
        const deepLinkCode = text.slice(6).trim();
        if (isVerifCode(deepLinkCode)) {
          logger.info({ chatId, deepLinkCode }, "/start WITH valid code — linking");
          await tryLinkByCode(deepLinkCode, "magic link");
          continue;
        }
        const [linkedAm] = await db.select().from(accountManagersTable)
          .where(eq(accountManagersTable.telegramChatId, chatId));
        logger.info({ chatId, linkedAm_nama: linkedAm?.nama, linkedAm_nik: linkedAm?.nik }, "/start linkedAm check result");
        if (linkedAm) {
          logger.info({ chatId, nama: linkedAm.nama }, "SENDING LINKED WELCOME for linked account");
          const now = Date.now();
          const lastSent = lastWelcomeSent.get(chatId) ?? 0;
          if (now - lastSent >= WELCOME_COOLDOWN_MS) {
            const text = linkedAm.role === "ACCOUNT_MANAGER"
              ? await buildWelcomeAM(linkedAm.nama)
              : await buildWelcomeAdmin(linkedAm.nama, linkedAm.role);
            await sendToTelegram(token, chatId, text, getMainKeyboard(linkedAm.role)).catch(() => {});
            lastWelcomeSent.set(chatId, now);
          } else {
            // Still acknowledge but don't spam
            await sendToTelegram(token, chatId, `Menu utama sudah dikirim tadi kak! Coba pilih menu di bawah ya 👇`, getMainKeyboard(linkedAm.role)).catch(() => {});
          }
        } else {
          logger.info({ chatId, firstName }, "SENDING UNLINKED WELCOME");
          const welcome = await buildWelcomeUnlinked(firstName);
          await sendToTelegram(token, chatId, welcome.text, welcome.keyboard).catch(() => {});
        }
        continue;
      }

      // /myid
      if (text === "/myid") {
        await sendToTelegram(token, chatId,
          `🆔 *Chat ID kamu:* \`${chatId}\`\n\nBagikan ID ini ke admin LESA VI untuk menghubungkan akun kamu ke sistem.`
        ).catch(() => {});
        continue;
      }

      // /logout — putuskan koneksi Telegram
      if (text === "/logout") {
        const [linkedAm] = await db.select().from(accountManagersTable)
          .where(eq(accountManagersTable.telegramChatId, chatId));
        if (!linkedAm) {
          await sendToTelegram(token, chatId, `Kamu belum terhubung ke sistem manapun kak.`).catch(() => {});
          continue;
        }
        await db.update(accountManagersTable)
          .set({ telegramChatId: null, telegramUserId: null, telegramUsername: null })
          .where(eq(accountManagersTable.telegramChatId, chatId));
        await sendToTelegram(token, chatId,
          `🔓 *Koneksi Terputus*\n\nAkun Telegram kamu sudah berhasil diputuskan dari *${linkedAm.nama}* (${linkedAm.nik}).\n\nJika ingin terhubung kembali, minta ADMIN, OFFICER, atau MANAGER untuk generate Kode Verifikasi baru ya kak.`
        ).catch(() => {});
        lastWelcomeSent.delete(chatId);
        logger.info({ chatId, nama: linkedAm.nama, nik: linkedAm.nik }, "AM disconnected via /logout");
        continue;
      }

      // Text shortcuts
      if (["/funneling", "/activity", "/performansi"].includes(text)) {
        const [linkedAm] = await db.select().from(accountManagersTable)
          .where(eq(accountManagersTable.telegramChatId, chatId));
        if (!linkedAm) {
          await sendToTelegram(token, chatId, `❌ Akun kamu belum terhubung. Minta ADMIN, OFFICER, atau MANAGER untuk generate Kode Verifikasi.`).catch(() => {});
          continue;
        }
        const amFirstName = linkedAm.nama.split(" ")[0];

        // Send welcome message with cooldown
        const now = Date.now();
        const lastSent = lastWelcomeSent.get(chatId) ?? 0;
        if (now - lastSent >= WELCOME_COOLDOWN_MS) {
          const welcomeText = linkedAm.role === "ACCOUNT_MANAGER"
            ? await buildWelcomeAM(linkedAm.nama)
            : await buildWelcomeAdmin(linkedAm.nama, linkedAm.role);
          await sendToTelegram(token, chatId, welcomeText, getMainKeyboard(linkedAm.role)).catch(() => {});
          lastWelcomeSent.set(chatId, now);
        }

        // /performansi → show period picker
        if (text === "/performansi") {
          const now2 = new Date();
          const displayMonth = `${MONTH_NAMES[now2.getMonth() + 1]} ${now2.getFullYear()}`;
          const pickerKeyboard = {
            inline_keyboard: [
              [{ text: `📅 Bulan Terkini (${displayMonth})`, callback_data: "perf:current" }],
              [{ text: "🗓 Pilih Bulan Lain", callback_data: "perf:menu" }],
            ],
          };
          await sendToTelegram(token, chatId,
            `📊 *Performansi Revenue*\n\nMau lihat rekap performansi bulan apa, kak *${amFirstName}*?`,
            pickerKeyboard
          ).catch(() => {});
          continue;
        }

        const period = currentPeriod();
        const opts = { includePerformance: false, includeFunnel: text === "/funneling", includeActivity: text === "/activity" };
        const msgs = await buildTelegramMessages(linkedAm.nik, period, opts);
        for (const m of msgs) await sendToTelegram(token, chatId, m).catch(() => {});
        if (!msgs.length) await sendToTelegram(token, chatId, `Belum ada data untuk periode ini kak *${amFirstName}*.`).catch(() => {});
        continue;
      }

      // Verification code
      if (isVerifCode(text)) {
        await tryLinkByCode(text, "manual code");
        continue;
      }

      // ── AI chat for all other messages ─────────────────────────────────
      if (text && !text.startsWith("/")) {
        const [linkedAm] = await db.select().from(accountManagersTable)
          .where(eq(accountManagersTable.telegramChatId, chatId));

        const aiReply = await chatWithGemini(text, {
          amName: linkedAm?.nama,
          divisi: linkedAm?.divisi,
        });

        if (aiReply) {
          await sendToTelegram(token, chatId, aiReply).catch(() => {});
        } else if (!linkedAm) {
          // User is unlinked — send the full unlinked welcome
          const unlinked = await buildWelcomeUnlinked(firstName);
          await sendToTelegram(token, chatId, unlinked.text, unlinked.keyboard).catch(() => {});
        } else {
          // Fallback: unrecognized text from linked user, short message with cooldown
          const now = Date.now();
          const lastSent = lastWelcomeSent.get(chatId) ?? 0;
          if (now - lastSent >= WELCOME_COOLDOWN_MS) {
            const fallbackText = buildFallback(linkedAm.nama.split(" ")[0]);
            await sendToTelegram(token, chatId, fallbackText, getMainKeyboard(linkedAm.role)).catch(() => {});
            lastWelcomeSent.set(chatId, now);
          }
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

export function startTelegramPoller(intervalMs = 15000) {
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
  lastUpdateId = 0;
  processedUpdates.clear();
  const restart = async () => {
    if (newToken) {
      try { await (async () => {
        const resp = await fetch(`https://api.telegram.org/bot${newToken}/deleteWebhook?drop_pending_updates=false`);
        const data = await resp.json() as { ok: boolean };
        if (data.ok) logger.info("Webhook cleared for new token");
      })(); } catch { /* non-fatal */ }
    }
    startTelegramPoller(15000);
  };
  setTimeout(() => restart().catch(() => {}), 500);
}
