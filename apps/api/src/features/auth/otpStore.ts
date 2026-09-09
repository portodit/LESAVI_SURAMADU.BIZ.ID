// In-memory store for OTP codes keyed by challengeId
// Used for Telegram OTP copy-to-clipboard feature
import crypto from "crypto";

const otpStore = new Map<string, { otp: string; chatId: string; expiresAt: number }>();

export function storeOtp(challengeId: string, otp: string, chatId: string, ttlMs = 5 * 60 * 1000): void {
  otpStore.set(challengeId, { otp, chatId, expiresAt: Date.now() + ttlMs });
}

export function getOtpByChallenge(challengeId: string): { otp: string; chatId: string } | null {
  const entry = otpStore.get(challengeId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(challengeId);
    return null;
  }
  return { otp: entry.otp, chatId: entry.chatId };
}

export function getOtpByChatId(chatId: string): { challengeId: string; otp: string } | null {
  for (const [challengeId, entry] of otpStore.entries()) {
    if (entry.chatId === chatId && Date.now() <= entry.expiresAt) {
      return { challengeId, otp: entry.otp };
    }
  }
  return null;
}
