import { Router, type IRouter } from "express";
import crypto from "crypto";
import { db, accountManagersTable, presentationSessionsTable } from "@workspace/db";
import { eq, or, inArray } from "drizzle-orm";
import { comparePassword, requireAuth, logAuthEvent, getClientIp } from "../../shared/auth";
import { requestOtp, verifyOtp, resendOtp, getPendingUserInfo } from "./otp";

// ─── Login handler (used by both /auth/login and /api/auth/login) ─────────────
async function handleLogin(req: any, res: any): Promise<void> {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(200).json({ error: "Email/NIK dan password wajib diisi" });
    return;
  }

  const identifier = String(email).trim();

  const [user] = await db
    .select()
    .from(accountManagersTable)
    .where(
      or(
        eq(accountManagersTable.email, identifier),
        eq(accountManagersTable.nik, identifier)
      )
    );

  if (!user || !user.passwordHash) {
    await logAuthEvent({
      eventType: "LOGIN_ATTEMPT",
      loginMethod: "EMAIL",
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
      status: "FAILED",
      failureReason: "INVALID_CREDENTIALS",
    });
    res.status(200).json({ error: "Email/NIK atau password salah" });
    return;
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    await logAuthEvent({
      userId: user.id,
      eventType: "LOGIN_ATTEMPT",
      loginMethod: "EMAIL",
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
      status: "FAILED",
      failureReason: "INVALID_PASSWORD",
    });
    res.status(200).json({ error: "Email/NIK atau password salah" });
    return;
  }

  await logAuthEvent({
    userId: user.id,
    eventType: "CREDENTIAL_VERIFIED",
    loginMethod: "EMAIL",
    ipAddress: getClientIp(req),
    userAgent: req.headers["user-agent"],
    status: "SUCCESS",
  });

  // ── Admin bypass: create session directly (no OTP) ──────────────────────────
  if (user.nik === "160203") {
    const session = (req as any).session;
    session.userId = user.id;
    session.userEmail = user.email;
    session.userRole = user.role;
    session.userNama = user.nama;
    session.userTipe = user.tipe ?? null;
    // Wait for session to be persisted to DB BEFORE sending response.
    // Without this, cookie may not be set in browser before the next request.
    await new Promise<void>((resolve) => {
      session.save((err: any) => { resolve(); });
    });
    res.json({
      nextStep: "AUTHENTICATED",
      id: user.id,
      email: user.email,
      role: user.role,
      nama: user.nama,
      tipe: user.tipe ?? null,
    });
    return;
  }

  // Check Telegram linking status
  if (!user.telegramChatId) {
    res.json({
      nextStep: "TELEGRAM_LINK_REQUIRED",
      userId: user.id,
      email: user.email,
      nama: user.nama,
      role: user.role,
    });
    return;
  }

  // ACCOUNT_MANAGER cannot login to dashboard — they must use /presentation/login
  if (user.role === "ACCOUNT_MANAGER") {
    res.status(200).json({
      error: "Akun Manager tidak dapat login di halaman ini. Silakan gunakan halaman login performa di /presentation/login.",
    });
    return;
  }

  // Telegram linked — return OTP_REQUIRED state
  // Frontend will call POST /auth/otp/request to trigger OTP delivery
  res.json({
    nextStep: "OTP_REQUIRED",
    userId: user.id,
    email: user.email,
    nama: user.nama,
    role: user.role,
  });
}

// ─── Router setup ──────────────────────────────────────────────────────────────
const router: IRouter = Router();

// This router is mounted at /api in routes/index.ts,
// so this route handles GET/POST /api/auth/*
router.post("/auth/login", handleLogin);

// ─── POST /auth/logout ────────────────────────────────────────────────────────
router.post("/auth/logout", (req, res): void => {
  const session = (req as any).session;
  const userId = session?.userId;

  if (userId) {
    logAuthEvent({
      userId,
      eventType: "LOGOUT",
      loginMethod: "EMAIL",
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
      status: "SUCCESS",
    }).catch(() => {});
  }

  (req as any).session.destroy(() => {
    res.json({ message: "Logged out" });
  });
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────────
router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const session = (req as any).session;
  res.json({
    id: session.userId,
    email: session.userEmail,
    role: session.userRole,
    nama: session.userNama,
    tipe: session.userTipe,
    telegramConnected: !!(session as any).user?.telegramChatId,
  });
});

// ─── POST /auth/otp/request ──────────────────────────────────────────────────
// Requires userId body param. Stores challenge in session.
// Should be called by frontend AFTER receiving OTP_REQUIRED from login.
router.post("/auth/otp/request", async (req, res): Promise<void> => {
  const { userId } = req.body;
  if (!userId || typeof userId !== "number") {
    res.status(400).json({ error: "userId diperlukan" });
    return;
  }

  try {
    const result = await requestOtp(userId, req);

    await logAuthEvent({
      userId,
      eventType: "OTP_REQUESTED",
      loginMethod: "EMAIL",
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
      status: "SUCCESS",
      metadata: { challengeId: result.challengeId },
    });

    res.json({
      challengeId: result.challengeId,
      expiresAt: result.expiresAt.toISOString(),
    });
  } catch (err: any) {
    await logAuthEvent({
      userId,
      eventType: "OTP_REQUESTED",
      loginMethod: "EMAIL",
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
      status: "FAILED",
      failureReason: err.message,
    });
    res.status(400).json({ error: err.message });
  }
});

// ─── POST /auth/otp/verify ────────────────────────────────────────────────────
router.post("/auth/otp/verify", async (req, res): Promise<void> => {
  const { challengeId, otp } = req.body;
  if (!challengeId || !otp) {
    res.status(400).json({ error: "challengeId dan OTP wajib diisi" });
    return;
  }

  if (!/^\d{5}$/.test(String(otp))) {
    res.status(400).json({ error: "OTP harus 5 digit angka" });
    return;
  }

  const session = (req as any).session;
  const pendingUserId = session?.pendingUserId;

  const result = await verifyOtp(String(challengeId), String(otp), req);

  if (!result.success) {
    await logAuthEvent({
      userId: pendingUserId ?? null,
      eventType: "OTP_FAILED",
      loginMethod: "EMAIL",
      challengeId: String(challengeId),
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
      status: "FAILED",
      failureReason: result.error ?? "INVALID_OTP",
    });
    res.status(401).json({ error: result.error });
    return;
  }

  // verifyOtp already created the session
  await logAuthEvent({
    userId: session.userId,
    eventType: "LOGIN_SUCCESS",
    loginMethod: "EMAIL",
    challengeId: String(challengeId),
    ipAddress: getClientIp(req),
    userAgent: req.headers["user-agent"],
    deviceId: session.deviceId,
    status: "SUCCESS",
  });

  res.json({
    id: session.userId,
    email: session.userEmail,
    role: session.userRole,
    nama: session.userNama,
    tipe: session.userTipe,
  });
});

// ─── POST /auth/otp/resend ────────────────────────────────────────────────────
router.post("/auth/otp/resend", async (req, res): Promise<void> => {
  const session = (req as any).session;
  if (!session.pendingUserId) {
    res.status(400).json({ error: "Tidak ada tantangan aktif. Silakan mulai proses login dari awal." });
    return;
  }

  try {
    const result = await resendOtp(req);
    res.json({
      challengeId: result.challengeId,
      expiresAt: result.expiresAt.toISOString(),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── GET /auth/telegram/status ─────────────────────────────────────────────────
router.get("/auth/telegram/status", requireAuth, async (req, res): Promise<void> => {
  const info = await getPendingUserInfo(req);
  if (!info) {
    res.json({ linked: false, telegramUsername: null, telegramChatId: null });
    return;
  }
  res.json({
    linked: info.linked,
    telegramUsername: info.telegramUsername,
    telegramChatId: info.telegramChatId,
  });
});

// ─── POST /auth/presentation/request-otp ───────────────────────────────────────
// For presentation login: takes NIK, looks up user, sends OTP if Telegram linked
router.post("/auth/presentation/request-otp", async (req, res): Promise<void> => {
  const { nik } = req.body;
  if (!nik) {
    res.status(400).json({ error: "NIK wajib diisi" });
    return;
  }

  const [user] = await db
    .select()
    .from(accountManagersTable)
    .where(eq(accountManagersTable.nik, String(nik).trim()));

  if (!user) {
    await logAuthEvent({
      eventType: "LOGIN_ATTEMPT",
      loginMethod: "NIK_PRESENTATION",
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
      status: "FAILED",
      failureReason: "NIK_NOT_FOUND",
    });
    res.status(401).json({ error: "NIK tidak ditemukan" });
    return;
  }

  await logAuthEvent({
    userId: user.id,
    eventType: "CREDENTIAL_VERIFIED",
    loginMethod: "NIK_PRESENTATION",
    ipAddress: getClientIp(req),
    userAgent: req.headers["user-agent"],
    status: "SUCCESS",
  });

  if (!user.telegramChatId) {
    res.json({
      nextStep: "TELEGRAM_LINK_REQUIRED",
      userId: user.id,
      nama: user.nama,
    });
    return;
  }

  try {
    const result = await requestOtp(user.id, req);
    res.json({
      nextStep: "OTP_REQUIRED",
      userId: user.id,
      nama: user.nama,
      challengeId: result.challengeId,
      expiresAt: result.expiresAt.toISOString(),
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── POST /auth/presentation/verify-otp ──────────────────────────────────────
router.post("/auth/presentation/verify-otp", async (req, res): Promise<void> => {
  const { challengeId, otp, userId } = req.body;
  if (!challengeId || !otp) {
    res.status(400).json({ error: "challengeId dan OTP wajib diisi" });
    return;
  }

  if (!/^\d{5}$/.test(String(otp))) {
    res.status(400).json({ error: "OTP harus 5 digit angka" });
    return;
  }

  const session = (req as any).session;
  const pendingUserId = session?.pendingUserId;

  // Defensive: if userId from body doesn't match session, reject
  if (userId && pendingUserId && Number(userId) !== pendingUserId) {
    res.status(401).json({ error: "User tidak valid. Silakan mulai login ulang." });
    return;
  }

  const result = await verifyOtp(String(challengeId), String(otp), req);

  if (!result.success) {
    await logAuthEvent({
      userId: pendingUserId ?? null,
      eventType: "OTP_FAILED",
      loginMethod: "NIK_PRESENTATION",
      challengeId: String(challengeId),
      ipAddress: getClientIp(req),
      userAgent: req.headers["user-agent"],
      status: "FAILED",
      failureReason: result.error ?? "INVALID_OTP",
    });
    res.status(401).json({ error: result.error, locked: result.locked });
    return;
  }

  await logAuthEvent({
    userId: session.userId,
    eventType: "LOGIN_SUCCESS",
    loginMethod: "NIK_PRESENTATION",
    challengeId: String(challengeId),
    ipAddress: getClientIp(req),
    userAgent: req.headers["user-agent"],
    deviceId: session.deviceId,
    status: "SUCCESS",
  });

  // Generate presentation token and store in DB (not session) for independent session management
  const presentationToken = crypto.randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await db.insert(presentationSessionsTable).values({
    token: presentationToken,
    userId: session.userId,
    userNik: session.userNik ?? null,
    userNama: session.userNama,
    userRole: session.userRole,
    expiresAt,
  }).onConflictDoNothing();

  res.json({
    id: session.userId,
    nama: session.userNama,
    role: session.userRole,
    presentationToken,
  });
});

// ─── POST /auth/presentation/session ────────────────────────────────────────────
// Validates the presentation session token from DB. Returns 200 + user info if valid, 401 otherwise.
router.post("/auth/presentation/session", async (req, res): Promise<void> => {
  const { presentationToken } = req.body;
  const session = (req as any).session;
  console.log(`[/presentation/session] token=${presentationToken?.slice(0,8)} sessionId=${session?.id} userId=${session?.userId}`);
  if (!presentationToken) {
    console.log("[/presentation/session] no token in body");
    res.status(401).json({ error: "Session tidak ditemukan. Silakan login ulang." });
    return;
  }

  const [presSession] = await db
    .select()
    .from(presentationSessionsTable)
    .where(eq(presentationSessionsTable.token, presentationToken));

  console.log(`[/presentation/session] DB lookup:`, presSession ? `userId=${presSession.userId} nama=${presSession.userNama}` : "NOT FOUND");

  if (!presSession) {
    console.log("[/presentation/session] token not in DB");
    res.status(401).json({ error: "Session tidak valid atau sudah kedaluwarsa. Silakan login ulang." });
    return;
  }

  if (new Date(presSession.expiresAt).getTime() < Date.now()) {
    console.log("[/presentation/session] token expired");
    await db.delete(presentationSessionsTable).where(eq(presentationSessionsTable.token, presentationToken));
    res.status(401).json({ error: "Session sudah kedaluwarsa. Silakan login ulang." });
    return;
  }

  console.log("[/presentation/session] VALID");
  res.json({
    id: presSession.userId,
    nama: presSession.userNama,
    role: presSession.userRole,
    nik: presSession.userNik ?? null,
  });
});

// ─── DELETE /auth/presentation/session ────────────────────────────────────────
// Logs out from presentation mode — deletes the token from DB.
router.delete("/auth/presentation/session", async (req, res): Promise<void> => {
  const { presentationToken } = req.body;
  if (presentationToken) {
    await db.delete(presentationSessionsTable).where(eq(presentationSessionsTable.token, presentationToken));
  }
  res.json({ success: true });
});

// ─── GET /auth/officers ────────────────────────────────────────────────────────
// Lists ADMIN/MANAGER/OFFICER who have Telegram connected.
// Public endpoint — used on Telegram linking page (before user is authenticated).
router.get("/auth/officers", async (req, res): Promise<void> => {
  const officers = await db
    .select({
      id: accountManagersTable.id,
      nama: accountManagersTable.nama,
      email: accountManagersTable.email,
      role: accountManagersTable.role,
      telegramUsername: accountManagersTable.telegramUsername,
      telegramDisplayName: accountManagersTable.telegramDisplayName,
      telegramConnected: accountManagersTable.telegramChatId,
    })
    .from(accountManagersTable)
    .where(
      inArray(accountManagersTable.role, ["ADMIN", "MANAGER", "OFFICER"])
    )
    .orderBy(accountManagersTable.nama);

  // Only return officers who are active AND have Telegram connected
  const withTelegram = officers.filter(o => o.telegramConnected);

  res.json(withTelegram);
});

export default router;
