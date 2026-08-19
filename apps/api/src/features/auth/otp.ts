import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db, otpChallengesTable, accountManagersTable, appSettingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { sendToTelegram } from "../telegram/service";
import { getClientIp } from "../../shared/auth";
import type { Request } from "express";

const OTP_LENGTH = 5;
const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

function generateOtp(): string {
  return crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");
}

function generateChallengeId(): string {
  return crypto.randomBytes(16).toString("hex");
}

export async function requestOtp(userId: number, req: Request): Promise<{
  challengeId: string;
  expiresAt: Date;
}> {
  // Rate limit: check for a recent pending challenge
  const recentChallenges = await db
    .select()
    .from(otpChallengesTable)
    .where(
      and(
        eq(otpChallengesTable.userId, userId),
        eq(otpChallengesTable.status, "PENDING")
      )
    )
    .orderBy(otpChallengesTable.createdAt)
    .limit(1);

  const now = new Date();
  if (recentChallenges.length > 0) {
    const lastCreated = recentChallenges[0].createdAt;
    const secondsSince = (now.getTime() - lastCreated.getTime()) / 1000;
    if (secondsSince < RESEND_COOLDOWN_SECONDS) {
      const remaining = Math.ceil(RESEND_COOLDOWN_SECONDS - secondsSince);
      throw new Error(`Tunggu ${remaining} detik sebelum meminta kode ulang.`);
    }
  }

  // Get user info
  const [user] = await db
    .select()
    .from(accountManagersTable)
    .where(eq(accountManagersTable.id, userId));
  if (!user) throw new Error("User tidak ditemukan.");

  // Check if Telegram is linked
  if (!user.telegramChatId) {
    throw new Error("Telegram belum terhubung. Hubungi petugas untuk menghubungkan akun Telegram terlebih dahulu.");
  }

  // Generate OTP
  const otp = generateOtp();
  const challengeId = generateChallengeId();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MINUTES * 60 * 1000);
  const otpHash = await bcrypt.hash(otp, 10);

  // Invalidate any existing pending challenges for this user
  await db
    .update(otpChallengesTable)
    .set({ status: "REVOKED" })
    .where(
      and(
        eq(otpChallengesTable.userId, userId),
        eq(otpChallengesTable.status, "PENDING")
      )
    );

  // Store new challenge
  await db.insert(otpChallengesTable).values({
    userId,
    challengeId,
    otpHash,
    channel: "TELEGRAM",
    expiresAt,
    attemptCount: 0,
    status: "PENDING",
  });

  // Send OTP via Telegram
  const [settings] = await db.select().from(appSettingsTable);
  if (settings?.telegramBotToken && user.telegramChatId) {
    const firstName = user.nama?.split(" ")[0] ?? "Kak";
    const message =
      `🔐 *Kode Verifikasi Masuk*\n\n` +
      `Hai kak *${firstName}*!\n\n` +
      `Berikut kode verifikasi untuk masuk ke Dashboard LESA VI:\n\n` +
      `*${otp}*\n\n` +
      `⚠️ Kode ini berlaku selama *${OTP_EXPIRY_MINUTES} menit*. Jangan bagikan kode ini ke siapa pun.\n\n` +
      `Jika Anda tidak meminta kode ini, abaikan pesan ini.`;

    await sendToTelegram(settings.telegramBotToken, user.telegramChatId, message).catch(() => {});
  }

  // Store challenge in session
  const session = (req as any).session;
  if (session) {
    session.pendingUserId = userId;
    session.pendingChallengeId = challengeId;
    session.pendingEmail = user.email;
    session.pendingNama = user.nama;
    session.pendingRole = user.role;
    session.pendingTipe = user.tipe;
    session.pendingExpiresAt = expiresAt.toISOString();
    await new Promise<void>((resolve, reject) => {
      session.save((err: any) => (err ? reject(err) : resolve()));
    });
  }

  return { challengeId, expiresAt };
}

export async function verifyOtp(
  challengeId: string,
  otp: string,
  req: Request
): Promise<{ success: boolean; error?: string; locked?: boolean }> {
  const session = (req as any).session;

  // Validate challengeId matches session
  if (session.pendingChallengeId !== challengeId) {
    return { success: false, error: "Challenge tidak valid atau sudah kedaluarsa. Silakan mulai proses login dari awal." };
  }

  // Check expiry from session
  if (session.pendingExpiresAt && new Date(session.pendingExpiresAt) < new Date()) {
    return { success: false, error: "Session verifikasi sudah kedaluarsa. Silakan login kembali." };
  }

  // Look up challenge in DB
  const [challenge] = await db
    .select()
    .from(otpChallengesTable)
    .where(
      and(
        eq(otpChallengesTable.challengeId, challengeId),
        eq(otpChallengesTable.status, "PENDING")
      )
    );

  if (!challenge) {
    // Check if challenge existed but was blocked
    const [blockedChallenge] = await db
      .select()
      .from(otpChallengesTable)
      .where(eq(otpChallengesTable.challengeId, challengeId));
    if (blockedChallenge && blockedChallenge.status === "BLOCKED") {
      return { success: false, error: "Terlalu banyak percobaan salah. Tunggu beberapa menit sebelum mencoba lagi.", locked: true };
    }
    return { success: false, error: "Challenge tidak valid atau sudah kedaluarsa. Silakan mulai proses login dari awal." };
  }

  // Check expiry from DB
  if (challenge.expiresAt < new Date()) {
    await db
      .update(otpChallengesTable)
      .set({ status: "EXPIRED" })
      .where(eq(otpChallengesTable.id, challenge.id));
    return { success: false, error: "Kode verifikasi sudah kedaluwarsa. Silakan minta kode baru." };
  }

  // Check attempt count
  if (challenge.attemptCount >= MAX_ATTEMPTS) {
    await db
      .update(otpChallengesTable)
      .set({ status: "BLOCKED" })
      .where(eq(otpChallengesTable.id, challenge.id));
    return { success: false, error: "Terlalu banyak percobaan salah. Tunggu beberapa menit sebelum mencoba lagi." };
  }

  // Verify OTP
  const valid = await bcrypt.compare(otp, challenge.otpHash);
  if (!valid) {
    await db
      .update(otpChallengesTable)
      .set({ attemptCount: challenge.attemptCount + 1 })
      .where(eq(otpChallengesTable.id, challenge.id));
    const remaining = MAX_ATTEMPTS - challenge.attemptCount - 1;
    if (remaining <= 0) {
      return { success: false, error: "Kode verifikasi salah. Terlalu banyak percobaan. Tunggu beberapa menit sebelum mencoba lagi.", locked: true };
    }
    return { success: false, error: `Kode verifikasi tidak sesuai. Sisa percobaan: ${remaining}.` };
  }

  // Mark challenge as verified
  await db
    .update(otpChallengesTable)
    .set({ status: "VERIFIED", verifiedAt: new Date() })
    .where(eq(otpChallengesTable.id, challenge.id));

  // Create session
  session.userId = session.pendingUserId;
  session.userEmail = session.pendingEmail;
  session.userRole = session.pendingRole;
  session.userNama = session.pendingNama;
  session.userTipe = session.pendingTipe;

  // Generate deviceId
  const deviceId = crypto.randomBytes(8).toString("hex");
  session.deviceId = deviceId;

  // Clear pending challenge
  delete session.pendingUserId;
  delete session.pendingChallengeId;
  delete session.pendingEmail;
  delete session.pendingNama;
  delete session.pendingRole;
  delete session.pendingTipe;
  delete session.pendingExpiresAt;

  await new Promise<void>((resolve, reject) => {
    session.save((err: any) => (err ? reject(err) : resolve()));
  });

  return { success: true };
}

export async function resendOtp(req: Request): Promise<{
  challengeId: string;
  expiresAt: Date;
}> {
  const session = (req as any).session;
  if (!session.pendingUserId) {
    throw new Error("Tidak ada tantangan yang aktif. Silakan mulai proses login dari awal.");
  }
  return requestOtp(session.pendingUserId, req);
}

export async function getPendingUserInfo(req: Request): Promise<{
  userId: number | null;
  email: string | null;
  nama: string | null;
  role: string | null;
  linked: boolean;
  telegramUsername: string | null;
  telegramChatId: string | null;
} | null> {
  const session = (req as any).session;

  let userId: number | null = null;
  if (session.userId) {
    userId = session.userId;
  } else if (session.pendingUserId) {
    userId = session.pendingUserId;
  }

  if (!userId) return null;

  const [am] = await db
    .select()
    .from(accountManagersTable)
    .where(eq(accountManagersTable.id, userId));

  if (!am) return null;

  return {
    userId: am.id,
    email: am.email ?? null,
    nama: am.nama ?? null,
    role: am.role ?? null,
    linked: !!am.telegramChatId,
    telegramUsername: am.telegramUsername ?? null,
    telegramChatId: am.telegramChatId ?? null,
  };
}
