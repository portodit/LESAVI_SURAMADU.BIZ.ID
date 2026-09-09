import { db, accountManagersTable, appSettingsTable, telegramBotUsersTable, telegramAccessCodesTable, dataImportsTable } from "@workspace/db";
import { eq, and, gt, inArray, desc } from "drizzle-orm";
import { sendToTelegram, answerCallbackQuery, greetingByTime, buildTelegramMessages, getAvailablePerfPeriods } from "./service";
import { chatWithGemini, generateBasaBasi } from "./ai";
import { logger } from "../../shared/logger";
import { getPublicBaseUrl } from "../../shared/publicUrl";
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

// ── Period extraction from filename ───────────────────────────────────────────
function extractPeriodFromFilename(filename: string): string | null {
  // Try YYYYMMDD first (e.g., 20260904) — find 8 consecutive digits, check if valid as year-month-day
  const all8 = [...filename.matchAll(/(\d{8})/g)];
  for (const m of all8) {
    const s = m[1];
    const year = parseInt(s.slice(0, 4));
    const month = parseInt(s.slice(4, 6));
    const day = parseInt(s.slice(6, 8));
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  // Try DDMMYYYY (e.g., 04092026)
  for (const m of all8) {
    const s = m[1];
    const day = parseInt(s.slice(0, 2));
    const month = parseInt(s.slice(2, 4));
    const year = parseInt(s.slice(4, 8));
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return null;
}

// ── Download file from Telegram ───────────────────────────────────────────────
async function downloadTelegramFile(token: string, fileId: string): Promise<Buffer> {
  const getFileResp = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
  const getFileData = await getFileResp.json() as { ok: boolean; result?: { file_path?: string } };
  if (!getFileData.ok || !getFileData.result?.file_path) {
    throw new Error("Gagal获取文件信息");
  }
  const filePath = getFileData.result.file_path;
  const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
  const fileResp = await fetch(downloadUrl);
  const arrayBuffer = await fileResp.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ── Process import (shared by confirm and overwrite handlers) ───────────────────
async function doProcessImport(
  token: string,
  chatId: string,
  state: ImportState,
  fileData: string,
  linkedAm: { nama: string; role: string },
  forceOverwrite = false,
) {
  logger.info({ chatId, importType: state.importType, forceOverwrite }, "doProcessImport: START");
  const typeLabel = state.importType === "performance" ? "Performance"
    : state.importType === "funnel" ? "Sales Funnel" : "Sales Activity";
  const endpoint = state.importType === "performance"
    ? "/import-performance"
    : state.importType === "funnel"
      ? "/import-funnel"
      : "/import-activity";

  const secret = process.env["TELEGRAM_IMPORT_SECRET"] || "telegram-bot-internal-secret-2024";
  const internalBase = process.env["PUBLIC_API_URL"] || "http://localhost:8000";
  const domain = getPublicBaseUrl();

  const dbType = state.importType === "performance" ? "performance" : state.importType === "funnel" ? "funnel" : "activity";

  const PROGRESS_KEYBOARD = {
    inline_keyboard: [
      [{ text: "⏳ Memproses...", callback_data: "import:processing" }],
    ],
  };

  await sendToTelegram(token, chatId,
    `📥 *Import ${typeLabel} — Sedang Berlangsung*\n\n` +
    `⏳ Memproses file...\n\n` +
    `_Mohon tunggu sebentar ya kak 🙏_`,
    PROGRESS_KEYBOARD
  ).catch(() => {});

  try {
    const apiResp = await fetch(`${internalBase}/api/internal${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-telegram-secret": secret },
      body: JSON.stringify({
        fileData,
        snapshotDate: state.extractedDate || undefined,
        period: state.period || undefined,
        forceOverwrite,
      }),
    });

    const apiData = await apiResp.json() as {
      error?: string; rowsImported?: number; rows?: number; conflict?: boolean; importId?: number;
    };

    if (apiData.conflict) {
      // API found existing snapshot — show overwrite/cancel buttons
      const existingMsg = apiData.error || `Sudah ada data ${typeLabel} periode ${state.period} yang diimport sebelumnya.`;
      const OVERWRITE_KEYBOARD = {
        inline_keyboard: [
          [{ text: "✅ Ya, Timpa Snapshot Lama", callback_data: "import:overwrite" }],
          [{ text: "❌ Batalkan", callback_data: "import:cancel" }],
        ],
      };
      await sendToTelegram(token, chatId,
        `⚠️ *Snapshot Sudah Ada*\n\n${existingMsg}\n\n` +
        `⚠️ Mengimpor ulang akan *MENIMPA* snapshot lama.\n\n` +
        `Lanjutkan timpa snapshot lama kak *${linkedAm.nama.split(" ")[0]}*? 👇`,
        OVERWRITE_KEYBOARD
      ).catch(() => {});
      state.step = "waiting_overwrite_confirm";
      importState.set(chatId, state);
      return;
    }
    if (!apiResp.ok) {
      await sendToTelegram(token, chatId,
        `❌ *Gagal Import ${typeLabel}*\n\n` +
        `${apiData.error || "Terjadi kesalahan saat memproses file."}\n\n` +
        `Silakan coba lagi atau hubungi admin.`,
        getMainKeyboard(linkedAm.role)
      ).catch(() => {});
    } else {
      const rows = apiData.rowsImported ?? apiData.rows ?? 0;
      const snapId = apiData.importId;
      const snapUrl = snapId ? `${domain}/import/detail/${dbType}/${snapId}` : `${domain}/import`;
      const presUrl = snapId ? `${domain}/presentation?type=${dbType}&snapshot=${snapId}` : `${domain}/presentation`;
      const typeLabelLower = state.importType === "performance" ? "Performansi AM" : state.importType === "funnel" ? "Sales Funnel" : "Sales Activity";
      const snapName = state.period
        ? `${typeLabelLower} — ${state.period}`
        : `${typeLabelLower}`;

      const SUCCESS_KEYBOARD = {
        inline_keyboard: [
          [{ text: "📋 Lihat Snapshot", url: snapUrl }],
          [{ text: "📊 Lihat Visualisasi", url: presUrl }],
          [{ text: "◀️ Kembali ke Menu", callback_data: "/import" }],
        ],
      };

      await sendToTelegram(token, chatId,
        `✅ *Import ${typeLabel} Berhasil!*\n\n` +
        `📋 *Nama Snapshot:* ${snapName}\n` +
        `📊 *Tipe:* ${typeLabelLower}\n` +
        `📦 *Total Baris:* *${rows.toLocaleString("id-ID")}* baris data\n\n` +
        `Silakan pilih aksi di bawah ya kak 🙏`,
        SUCCESS_KEYBOARD
      ).catch(() => {});
    }
  } catch (err) {
    logger.error({ err }, "Failed to call internal import API from Telegram");
    await sendToTelegram(token, chatId,
      `❌ *Gagal Import ${typeLabel}*\n\n` +
      `Terjadi kesalahan koneksi ke server. Silakan coba lagi nanti.`,
      getMainKeyboard(linkedAm.role)
    ).catch(() => {});
  }

  importState.delete(chatId);
  funnelFileData.delete(chatId);
  activityFileData.delete(chatId);
}

const MAIN_KEYBOARD_ADMIN = {
  inline_keyboard: [
    [
      { text: "📥 Impor Data",          callback_data: "/import"   },
      { text: "🔓 Putuskan Koneksi",   callback_data: "/logout"  },
    ],
    [
      { text: "📋 List Data Snapshot",  callback_data: "/list"    },
    ],
  ],
};

const MAIN_KEYBOARD_EMPTY: typeof MAIN_KEYBOARD_ADMIN = { inline_keyboard: [] };

function getMainKeyboard(role: string) {
  return role === "ADMIN" || role === "MANAGER" || role === "OFFICER"
    ? MAIN_KEYBOARD_ADMIN
    : MAIN_KEYBOARD_EMPTY;
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

// ── Import flow state ─────────────────────────────────────────────────────────
type ImportStep = "idle" | "waiting_period" | "waiting_file" | "waiting_confirm" | "processing" | "waiting_drive_link" | "waiting_overwrite_confirm";
interface ImportState {
  step: ImportStep;
  importType: "performance" | "funnel" | "activity" | "prognosa";
  period: string;
  extractedDate?: string;
}
const importState = new Map<string, ImportState>();
const funnelFileData = new Map<string, string>();
const activityFileData = new Map<string, string>();

const FUNNEL_BACK_KEYBOARD = {
  inline_keyboard: [[{ text: "◀️ Kembali ke Menu Import", callback_data: "/import" }]],
};

// ── Snapshot selection flow state ───────────────────────────────────────────────
type SnapshotStep = "idle" | "choose_type" | "choose_snapshot" | "snapshot_detail";
interface SnapshotState {
  step: SnapshotStep;
  dataType: "performance" | "funnel" | "activity";
  snapshots: Array<{
    id: number; period: string; snapshotDate: string | null;
    rowsImported: number | null; sourceUrl: string | null; createdAt: string | null;
  }>;
  selectedIndex: number;
}
const snapshotState = new Map<string, SnapshotState>();

// Keyboard: choose data type
const LIST_SNAPSHOT_TYPE_KEYBOARD = {
  inline_keyboard: [
    [{ text: "📊 Performansi AM", callback_data: "snap:perf" }],
    [{ text: "📋 Sales Funnel", callback_data: "snap:funnel" }],
    [{ text: "📅 Sales Activity", callback_data: "snap:activity" }],
    [{ text: "◀️ Menu Utama", callback_data: "nav:main" }],
  ],
};

// Build snapshot list keyboard
function buildSnapshotListKeyboard(snaps: SnapshotState["snapshots"], dataType: string) {
  const typeLabel = dataType === "performance" ? "Performansi AM" : dataType === "funnel" ? "Sales Funnel" : "Sales Activity";
  const rows: any[] = [];
  for (const snap of snaps) {
    const date = snap.snapshotDate
      ? new Date(snap.snapshotDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
      : (snap.period || "-");
    rows.push({ text: `📅 ${date} — ${typeLabel}`, callback_data: `snap:select:${dataType}:${snap.id}` });
  }
  const inline_keyboard = rows.map(r => [r]);
  inline_keyboard.push([{ text: "◀️ Kembali", callback_data: "snap:back_to_list" }]);
  return { inline_keyboard };
}

// Build snapshot list message
async function buildSnapshotListMsg(dataType: "performance" | "funnel" | "activity"): Promise<{ text: string; keyboard: any; rows: SnapshotState["snapshots"] }> {
  const dbType = dataType === "performance" ? "performance" : dataType === "funnel" ? "funnel" : "activity";
  const rows = await db.select({
    id: dataImportsTable.id, period: dataImportsTable.period,
    snapshotDate: dataImportsTable.snapshotDate, rowsImported: dataImportsTable.rowsImported,
    sourceUrl: dataImportsTable.sourceUrl, createdAt: dataImportsTable.createdAt,
  }).from(dataImportsTable).where(eq(dataImportsTable.type, dbType)).orderBy(desc(dataImportsTable.id));
  const typeLabel = dataType === "performance" ? "Performansi AM" : dataType === "funnel" ? "Sales Funnel" : "Sales Activity";
  if (rows.length === 0) {
    return {
      text: `📋 *Daftar Snapshot ${typeLabel}*\n\nBelum ada data ${typeLabel} yang diimport kak. Silakan import terlebih dahulu melalui menu /import.`,
      keyboard: { inline_keyboard: [[{ text: "◀️ Menu Utama", callback_data: "nav:main" }]] }, rows: [],
    };
  }
  const keyboard = buildSnapshotListKeyboard(rows, dataType);
  return { text: `📋 *Daftar Snapshot ${typeLabel}*\n\nPilih snapshot yang ingin dilihat:`, keyboard, rows };
}

// Build snapshot detail message
function buildSnapshotDetailMsg(snap: SnapshotState["snapshots"][0], dataType: string, idx: number): string {
  const typeLabel = dataType === "performance" ? "Performansi AM" : dataType === "funnel" ? "Sales Funnel" : "Sales Activity";
  const date = snap.snapshotDate ? new Date(snap.snapshotDate).toLocaleDateString("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }) : "-";
  const rows = snap.rowsImported != null ? `${snap.rowsImported.toLocaleString("id-ID")} baris data` : "belum diketahui";
  const source = snap.sourceUrl ? `\n📎 Sumber: ${snap.sourceUrl}` : "";
  return (
    `✅ *Snapshot #${idx} Dipilih*\n\n` +
    `📊 Tipe Data: *${typeLabel}*\n` +
    `📅 Tanggal Snapshot: *${date}*\n` +
    `📦 Jumlah Baris: *${rows}*${source}\n\n` +
    `Silakan pilih aksi yang ingin dilakukan di bawah ya kak 👇`
  );
}

// Fetch snapshots helper
async function fetchSnapshots(dataType: "performance" | "funnel" | "activity"): Promise<SnapshotState["snapshots"]> {
  const dbType = dataType === "performance" ? "performance" : dataType === "funnel" ? "funnel" : "activity";
  const rows = await db.select({
    id: dataImportsTable.id, period: dataImportsTable.period,
    snapshotDate: dataImportsTable.snapshotDate, rowsImported: dataImportsTable.rowsImported,
    sourceUrl: dataImportsTable.sourceUrl, createdAt: dataImportsTable.createdAt,
  }).from(dataImportsTable).where(eq(dataImportsTable.type, dbType)).orderBy(desc(dataImportsTable.id));
  return rows.map(r => ({
    id: r.id, period: r.period ?? "", snapshotDate: r.snapshotDate?.toString() ?? null,
    rowsImported: r.rowsImported, sourceUrl: r.sourceUrl ?? null, createdAt: r.createdAt?.toString() ?? null,
  }));
}

// Extract date from funnel filename
function extractDateFromFunnelFilename(fileName: string): string | null {
  const matches = fileName.match(/\d{8}/g);
  if (!matches || matches.length === 0) return null;
  const candidate = matches[matches.length - 1];
  const year = parseInt(candidate.slice(0, 4), 10);
  const month = parseInt(candidate.slice(4, 6), 10);
  const day = parseInt(candidate.slice(6, 8), 10);
  if (year >= 2020 && year <= 2030 && month >= 1 && month <= 12 && day >= 1 && day <= 31) return candidate;
  return null;
}

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
    `Sebagai *${roleLabel}*, kamu bisa mengelola dan mengakses data operasional melalui menu di bawah ini.\n\n` +
    `Pilih menu di bawah untuk akses fitur:`
  );
}

// Fallback: pesan tidak dikenali (hanya 1 pesan singkat, tanpa welcome + tanpa keyboard)
function buildFallback(): string {
  return `Maaf kak, aku belum paham maksud pesannya 🙏\n\nKetik /start untuk mengakses menu Utama`;
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
        console.log(`[TELEGRAM] INCOMING CALLBACK: data="${cb.data}", from=${cb.from?.first_name}, chatId=${cb.message?.chat?.id || cb.from?.id}`);
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
            await sendToTelegram(token, cbChatId, `Ketik /start untuk memulai.`, MAIN_KEYBOARD_EMPTY).catch(() => {});
          }
          continue;
        }

        // ── /list — show list snapshot type menu ─────────────────────────
        if (cbData === "/list") {
          const [linkedAm] = await db.select().from(accountManagersTable)
            .where(eq(accountManagersTable.telegramChatId, cbChatId));
          if (!linkedAm || linkedAm.role === "ACCOUNT_MANAGER") {
            await sendToTelegram(token, cbChatId, `Fitur ini hanya tersedia untuk *ADMIN*, *OFFICER*, dan *MANAGER*.`).catch(() => {});
            continue;
          }
          const amFirstName = linkedAm.nama.split(" ")[0];
          snapshotState.delete(cbChatId);
          await sendToTelegram(token, cbChatId,
            `📋 *List Data Snapshot*\n\nPilih tipe data yang ingin dilihat kak *${amFirstName}*:`, LIST_SNAPSHOT_TYPE_KEYBOARD
          ).catch(() => {});
          continue;
        }

        // ── snap:back_to_list ───────────────────────────────────────────
        if (cbData === "snap:back_to_list") {
          const state = snapshotState.get(cbChatId);
          if (!state) {
            await sendToTelegram(token, cbChatId, `Silakan mulai dari menu *List Data Snapshot* kak.`, LIST_SNAPSHOT_TYPE_KEYBOARD).catch(() => {});
            continue;
          }
          const { text, keyboard } = await buildSnapshotListMsg(state.dataType);
          state.step = "choose_snapshot";
          snapshotState.set(cbChatId, state);
          await sendToTelegram(token, cbChatId, text, keyboard).catch(() => {});
          continue;
        }

        // ── snap:perf / snap:funnel / snap:activity ──────────────────────
        if (["snap:perf", "snap:funnel", "snap:activity"].includes(cbData)) {
          const dataType = cbData === "snap:perf" ? "performance" : cbData === "snap:funnel" ? "funnel" : "activity";
          try {
            const { text, keyboard, rows } = await buildSnapshotListMsg(dataType);
            snapshotState.set(cbChatId, { step: "choose_snapshot", dataType, snapshots: rows, selectedIndex: 0 });
            await sendToTelegram(token, cbChatId, text, keyboard).catch(() => {});
          } catch (e: any) {
            logger.error({ err: e, dataType, cbData }, "snap:buildSnapshotListMsg failed");
          }
          continue;
        }

        // ── snap:select ──────────────────────────────────────────────────
        if (cbData.startsWith("snap:select:")) {
          const parts = cbData.split(":");
          const dataType = parts[2] as "performance" | "funnel" | "activity";
          const snapId = parseInt(parts[3], 10);
          if (isNaN(snapId)) { continue; }
          const snaps = await db.select().from(dataImportsTable)
            .where(and(eq(dataImportsTable.id, snapId), eq(dataImportsTable.type, dataType))).limit(1);
          if (!snaps.length) {
            await sendToTelegram(token, cbChatId, `❌ Snapshot tidak ditemukan.`, LIST_SNAPSHOT_TYPE_KEYBOARD).catch(() => {});
            continue;
          }
          const snap = snaps[0];
          const typeLabel = dataType === "performance" ? "Performansi AM" : dataType === "funnel" ? "Sales Funnel" : "Sales Activity";
          const date = snap.snapshotDate
            ? new Date(snap.snapshotDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
            : "-";
          const rows = snap.rowsImported != null ? `${snap.rowsImported.toLocaleString("id-ID")} baris data` : "belum diketahui";
          const domain = getPublicBaseUrl();

          const msg =
            `✅ *Snapshot Dipilih*\n\n` +
            `📊 Tipe Data: *${typeLabel}*\n` +
            `📅 Tanggal: *${date}*\n` +
            `📦 Jumlah: *${rows}*\n\n` +
            `🔗 *Link Akses:*\n` +
            `• Akses Data: ${domain}/import/detail/${dataType}/${snapId}\n` +
            `• Lihat Visualisasi: ${domain}/presentation?type=${dataType}&snapshot=${snapId}\n\n` +
            `Silakan pilih aksi di bawah ya kak 👇`;

          const keyboard = {
            inline_keyboard: [
              [
                { text: "🗑 Hapus Data", callback_data: `snap:delete:${dataType}:${snapId}` },
                { text: "◀️ Pilih Snapshot Lain", callback_data: "snap:back_to_list" },
              ],
            ],
          };
          await sendToTelegram(token, cbChatId, msg, keyboard).catch(() => {});
          continue;
        }

        // ── snap:delete ─────────────────────────────────────────────────
        if (cbData.startsWith("snap:delete:")) {
          const parts = cbData.split(":");
          const dataType = parts[2];
          const snapId = parseInt(parts[3], 10);
          if (isNaN(snapId)) { continue; }
          const snap = await db.select().from(dataImportsTable)
            .where(and(eq(dataImportsTable.id, snapId), eq(dataImportsTable.type, dataType))).limit(1);
          if (!snap.length) {
            await sendToTelegram(token, cbChatId, `❌ Snapshot tidak ditemukan.`, LIST_SNAPSHOT_TYPE_KEYBOARD).catch(() => {});
            continue;
          }
          const date = snap[0].snapshotDate
            ? new Date(snap[0].snapshotDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
            : "-";
          const CONFIRM_DELETE_KEYBOARD = {
            inline_keyboard: [
              [
                { text: "⚠️ Ya, Hapus", callback_data: `snap:confirm_delete:${dataType}:${snapId}` },
                { text: "❌ Batal", callback_data: "snap:back_to_list" },
              ],
            ],
          };
          await sendToTelegram(token, cbChatId,
            `⚠️ *Konfirmasi Hapus Data*\n\nYakin ingin menghapus snapshot?\n\n📅 Tanggal: *${date}*\n📊 Tipe: *${dataType}*\n\nData yang dihapus tidak dapat dikembalikan.`, CONFIRM_DELETE_KEYBOARD
          ).catch(() => {});
          continue;
        }

        // ── snap:confirm_delete ─────────────────────────────────────────
        if (cbData.startsWith("snap:confirm_delete:")) {
          const parts = cbData.split(":");
          const dataType = parts[2];
          const snapId = parseInt(parts[3], 10);
          if (isNaN(snapId)) { continue; }
          const snap = await db.select().from(dataImportsTable)
            .where(and(eq(dataImportsTable.id, snapId), eq(dataImportsTable.type, dataType))).limit(1);
          if (!snap.length) {
            await sendToTelegram(token, cbChatId, `❌ Snapshot tidak ditemukan.`, LIST_SNAPSHOT_TYPE_KEYBOARD).catch(() => {});
            continue;
          }
          await db.delete(dataImportsTable).where(eq(dataImportsTable.id, snapId));
          await sendToTelegram(token, cbChatId, `✅ Snapshot berhasil dihapus.`).catch(() => {});
          continue;
        }

        // ── /import — show import type selection ─────────────────────────
        if (cbData === "/import") {
          const [linkedAm] = await db.select().from(accountManagersTable)
            .where(eq(accountManagersTable.telegramChatId, cbChatId));
          if (!linkedAm || linkedAm.role === "ACCOUNT_MANAGER") {
            await sendToTelegram(token, cbChatId, `Fitur ini hanya tersedia untuk *ADMIN*, *OFFICER*, dan *MANAGER*.`).catch(() => {});
            continue;
          }
          importState.set(cbChatId, { step: "idle", importType: "funnel", period: "" });
          const IMPORT_TYPE_KEYBOARD = {
            inline_keyboard: [
              [{ text: "📊 Import Performance", callback_data: "import:type:performance" }],
              [{ text: "🔻 Import Sales Funnel", callback_data: "import:type:funnel" }],
              [{ text: "📅 Import Sales Activity", callback_data: "import:type:activity" }],
              [{ text: "◀️ Menu Utama", callback_data: "nav:main" }],
            ],
          };
          await sendToTelegram(token, cbChatId,
            `📥 *Import Data*\n\nPilih tipe data yang ingin diimport kak *${linkedAm.nama.split(" ")[0]}*:`,
            IMPORT_TYPE_KEYBOARD
          ).catch(() => {});
          continue;
        }

        // ── /website — send website link ─────────────────────────────────
        if (cbData === "/website") {
          const domain = getPublicBaseUrl();
          await sendToTelegram(token, cbChatId,
            `🌐 *Akses Website*\n\nKlik link berikut untuk membuka dashboard:\n\n${domain}`, MAIN_KEYBOARD_ADMIN
          ).catch(() => {});
          continue;
        }

        // ── import:type:* — set import type and ask for file ─────────────
        if (cbData.startsWith("import:type:")) {
          const type = cbData.split(":")[2] as "performance" | "funnel" | "activity";
          const [linkedAm] = await db.select().from(accountManagersTable)
            .where(eq(accountManagersTable.telegramChatId, cbChatId));
          if (!linkedAm || linkedAm.role === "ACCOUNT_MANAGER") {
            await sendToTelegram(token, cbChatId, `Fitur ini hanya tersedia untuk *ADMIN*, *OFFICER*, dan *MANAGER*.`).catch(() => {});
            continue;
          }
          const state: ImportState = { step: "waiting_file", importType: type, period: "" };
          importState.set(cbChatId, state);
          funnelFileData.delete(cbChatId);
          activityFileData.delete(cbChatId);
          const typeLabel = type === "performance" ? "Performance" : type === "funnel" ? "Sales Funnel" : "Sales Activity";
          const IMPORT_FILE_KEYBOARD = {
            inline_keyboard: [
              [{ text: "◀️ Kembali ke Menu Import", callback_data: "/import" }],
              [{ text: "🏠 Menu Utama", callback_data: "nav:main" }],
            ],
          };
          await sendToTelegram(token, cbChatId,
            `📥 *Import ${typeLabel}*\n\nKirim file *Excel (.xlsx)* atau *CSV* yang ingin diimport kak *${linkedAm.nama.split(" ")[0]}*.\n\nPastikan nama file mengandung periode data (format: *DDMMYYYY* atau *YYYYMMDD*) ya kak.`,
            IMPORT_FILE_KEYBOARD
          ).catch(() => {});
          continue;
        }

        // ── import:confirm — process the uploaded file ─────────────────────
        if (cbData === "import:confirm") {
          console.log(`[DEBUG] import:confirm received! cbChatId=${cbChatId}, updateId=${update.update_id}`);
          const [linkedAm] = await db.select().from(accountManagersTable)
            .where(eq(accountManagersTable.telegramChatId, cbChatId));
          if (!linkedAm || linkedAm.role === "ACCOUNT_MANAGER") {
            await sendToTelegram(token, cbChatId, `Fitur ini hanya tersedia untuk *ADMIN*, *OFFICER*, dan *MANAGER*.`).catch(() => {});
            continue;
          }

          const state = importState.get(cbChatId);
          if (!state) {
            console.error(`[IMPORT DEBUG] importState keys: ${JSON.stringify([...importState.keys()])}`);
            await sendToTelegram(token, cbChatId, `❌ Sesi import tidak ditemukan (state=null). ChatID: ${cbChatId}. Silakan mulai ulang dari menu *Impor Data*.`, getMainKeyboard(linkedAm.role)).catch(() => {});
            continue;
          }
          if (state.step !== "waiting_confirm") {
            console.error(`[IMPORT DEBUG] state found but step=${state.step}, expected=waiting_confirm`);
            await sendToTelegram(token, cbChatId, `❌ Sesi import tidak ditemukan. Step: ${state.step}. Silakan mulai ulang dari menu *Impor Data*.`, getMainKeyboard(linkedAm.role)).catch(() => {});
            continue;
          }

          // Get file data from storage
          const fileKey = state.importType === "activity" ? activityFileData : funnelFileData;
          const fileData = fileKey.get(cbChatId);
          if (!fileData) {
            await sendToTelegram(token, cbChatId, `❌ File tidak ditemukan. Silakan upload ulang.`, getMainKeyboard(linkedAm.role)).catch(() => {});
            continue;
          }

          const typeLabel = state.importType === "performance" ? "Performance" : state.importType === "funnel" ? "Sales Funnel" : "Sales Activity";
          const dbType = state.importType === "performance" ? "performance" : state.importType === "funnel" ? "funnel" : "activity";

          // ── Check for existing snapshot ──────────────────────────────────
          const importPeriod = state.period || "";
          const [existingSnap] = await db.select().from(dataImportsTable)
            .where(and(eq(dataImportsTable.type, dbType), eq(dataImportsTable.period, importPeriod)));

          if (existingSnap) {
            // Ask user: overwrite or cancel
            const existingDate = existingSnap.createdAt
              ? new Date(existingSnap.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })
              : "-";
            const existingRows = existingSnap.rowsImported ?? 0;

            state.step = "waiting_overwrite_confirm";
            importState.set(cbChatId, state);

            const OVERWRITE_KEYBOARD = {
              inline_keyboard: [
                [{ text: "✅ Ya, Timpa Snapshot Lama", callback_data: "import:overwrite" }],
                [{ text: "❌ Batalkan", callback_data: "import:cancel" }],
              ],
            };

            await sendToTelegram(token, cbChatId,
              `⚠️ *Snapshot Sudah Ada*\n\n` +
              `Untuk tipe *${typeLabel}* periode *${importPeriod}*, sudah ada snapshot yang diimport sebelumnya:\n\n` +
              `📅 Tanggal import : *${existingDate}*\n` +
              `📦 Jumlah baris   : *${existingRows}* baris\n\n` +
              `⚠️ Mengimpor ulang akan *MENIMPA* snapshot lama.\n\n` +
              `Lanjutkan timpa snapshot lama kak *${linkedAm.nama.split(" ")[0]}*? 👇`,
              OVERWRITE_KEYBOARD
            ).catch(() => {});
            // return NOT continue — we must not fall through to doProcessImport
            return;
          }

          // ── No existing snapshot — proceed directly ─────────────────────
          await doProcessImport(token, cbChatId, state, fileData, linkedAm);
          continue;
        }

        // ── import:overwrite — proceed with force overwrite ───────────────
        if (cbData === "import:overwrite") {
          const [linkedAm] = await db.select().from(accountManagersTable)
            .where(eq(accountManagersTable.telegramChatId, cbChatId));
          if (!linkedAm || linkedAm.role === "ACCOUNT_MANAGER") {
            await sendToTelegram(token, cbChatId, `Fitur ini hanya tersedia untuk *ADMIN*, *OFFICER*, dan *MANAGER*.`).catch(() => {});
            continue;
          }

          const state = importState.get(cbChatId);
          if (!state || state.step !== "waiting_overwrite_confirm") {
            await sendToTelegram(token, cbChatId, `❌ Sesi import tidak ditemukan. Silakan mulai ulang dari menu *Impor Data*.`, getMainKeyboard(linkedAm.role)).catch(() => {});
            continue;
          }

          const fileKey = state.importType === "activity" ? activityFileData : funnelFileData;
          const fileData = fileKey.get(cbChatId);
          if (!fileData) {
            await sendToTelegram(token, cbChatId, `❌ File tidak ditemukan.`, getMainKeyboard(linkedAm.role)).catch(() => {});
            continue;
          }

          await doProcessImport(token, cbChatId, state, fileData, linkedAm, true);
          continue;
        }

        // ── import:cancel — cancel import ─────────────────────────────────
        if (cbData === "import:cancel") {
          const [linkedAm] = await db.select().from(accountManagersTable)
            .where(eq(accountManagersTable.telegramChatId, cbChatId));
          importState.delete(cbChatId);
          funnelFileData.delete(cbChatId);
          activityFileData.delete(cbChatId);
          await sendToTelegram(token, cbChatId,
            `❌ *Import Dibatalkan*\n\nImport telah dibatalkan kak *${linkedAm?.nama.split(" ")[0] || "Kak"}*.\n\n` +
            `Silakan mulai ulang kapan saja melalui menu *Impor Data*.`,
            linkedAm ? getMainKeyboard(linkedAm.role) : undefined
          ).catch(() => {});
          continue;
        }

        continue;

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

      // ── Document / file handling — import flow ───────────────────────────
      const doc = (msg as any).document as { file_id: string; file_name?: string } | undefined;
      if (doc) {
        const state = importState.get(chatId);
        if (state?.step === "waiting_file") {
          try {
            await sendToTelegram(token, chatId,
              `📥 *File Diterima!*\n\n` +
              `⏳ Mendownload file dari Telegram...\n\n` +
              `_Sabarin sebentar ya kak_`
            ).catch(() => {});

            const [linkedAm] = await db.select().from(accountManagersTable)
              .where(eq(accountManagersTable.telegramChatId, chatId));

            const filename = doc.file_name || "file";
            const buffer = await downloadTelegramFile(token, doc.file_id);
            const base64 = buffer.toString("base64");

            const extractedPeriod = extractPeriodFromFilename(filename);
            const amFirstName = linkedAm?.nama.split(" ")[0] || "Kak";

            if (!extractedPeriod) {
              await sendToTelegram(token, chatId,
                `⚠️ *Nama File Tidak Mengandung Tanggal*\n\n` +
                `Bot tidak bisa mendeteksi periode dari nama file:\n*${filename}*\n\n` +
                `Pastikan nama file mengandung tanggal dengan format *DDMMYYYY* atau *YYYYMMDD* ya kak *${amFirstName}*. Silakan upload ulang filenya kak.`
              ).catch(() => {});
              continue;
            }

            // Store file data and period
            const fileKey = state.importType === "activity" ? activityFileData : funnelFileData;
            fileKey.set(chatId, base64);
            state.extractedDate = extractedPeriod;
            state.period = extractedPeriod.replace(/-/g, "");
            state.step = "waiting_confirm";
            importState.set(chatId, state);

            const typeLabel = state.importType === "performance" ? "Performance" : state.importType === "funnel" ? "Sales Funnel" : "Sales Activity";
            const [year, month, day] = extractedPeriod.split("-");
            const monthName = MONTH_NAMES[parseInt(month)] || month;
            const displayDate = `${day} ${monthName} ${year}`;

            const CONFIRM_KEYBOARD = {
              inline_keyboard: [
                [{ text: "✅ Ya, Proses Import", callback_data: "import:confirm" }],
                [{ text: "◀️ Kembali ke Menu Import", callback_data: "/import" }],
              ],
            };

            await sendToTelegram(token, chatId,
              `📄 *File Diterima!*\n\n` +
              `Nama file: *${filename}*\n` +
              `Tipe data : *${typeLabel}*\n` +
              `Periode   : *${displayDate}*\n\n` +
              `Data akan diimport ke sistem LESA VI.\n\n` +
              `Lanjutkan import kak *${amFirstName}*? 👇`,
              CONFIRM_KEYBOARD
            ).catch(() => {});
          } catch (err) {
            logger.error({ err }, "Failed to process uploaded file from Telegram");
            await sendToTelegram(token, chatId,
              `❌ Gagal mendownload file. Pastikan file dikirim ulang ya kak.`
            ).catch(() => {});
          }
          continue;
        }
      }

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

        // ADMIN/OFFICER/MANAGER should use /list instead
        if (linkedAm.role !== "ACCOUNT_MANAGER") {
          await sendToTelegram(token, chatId,
            `❌ Fitur ini hanya untuk *Account Manager* kak.\n\n` +
            `Untuk melihat data snapshot, silakan ketik */list* ya kak.`,
            getMainKeyboard(linkedAm.role)
          ).catch(() => {});
          continue;
        }

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

      // /list — show snapshot list (for ADMIN/OFFICER/MANAGER)
      if (text === "/list") {
        const [linkedAm] = await db.select().from(accountManagersTable)
          .where(eq(accountManagersTable.telegramChatId, chatId));
        if (!linkedAm || linkedAm.role === "ACCOUNT_MANAGER") {
          await sendToTelegram(token, chatId,
            `❌ Fitur ini hanya tersedia untuk *ADMIN*, *OFFICER*, dan *MANAGER*.`,
            linkedAm ? getMainKeyboard(linkedAm.role) : undefined
          ).catch(() => {});
          continue;
        }
        const amFirstName = linkedAm.nama.split(" ")[0];
        snapshotState.delete(chatId);
        await sendToTelegram(token, chatId,
          `📋 *List Data Snapshot*\n\nPilih tipe data yang ingin dilihat kak *${amFirstName}*:`, LIST_SNAPSHOT_TYPE_KEYBOARD
        ).catch(() => {});
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
          // Fallback: unrecognized text from linked user, short message (no cooldown)
          const fallbackText = buildFallback();
          await sendToTelegram(token, chatId, fallbackText).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error(`[TELEGRAM POLLER ERROR] ${err}`);
    logger.error({ err }, "Telegram poller error");
  }
}

async function deleteWebhookIfAny(token: string) {
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`);
    const data = await resp.json() as { ok: boolean };
    if (data.ok) logger.info("Telegram webhook deleted — using getUpdates polling");
  } catch { /* non-fatal */ }
}

export function startTelegramPoller(intervalMs = 3000) {
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
    startTelegramPoller(3000);
  };
  setTimeout(() => restart().catch(() => {}), 500);
}
