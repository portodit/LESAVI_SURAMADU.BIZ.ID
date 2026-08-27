import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  useLogin,
  useOtpRequest,
  useOtpVerify,
  useOtpResend,
  usePresentationRequestOtp,
  usePresentationVerifyOtp,
  useLogout,
  type AuthResponse,
  type PresentationLoginResponse,
} from "@workspace/api-client-react";

export type AuthState =
  | "IDLE"
  | "CREDENTIAL_VALIDATING"
  | "OTP_REQUIRED"
  | "TELEGRAM_LINK_REQUIRED"
  | "AUTHENTICATED"
  | "AUTH_ERROR";

export interface AuthMachineContext {
  state: AuthState;
  challengeId: string | null;
  expiresAt: string | null;
  pendingUserId: number | null;
  pendingEmail: string | null;
  pendingNama: string | null;
  pendingRole: string | null;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  navigateOnSuccess: () => Promise<void>;
  requestOtp: () => Promise<void>;
  verifyOtp: (otp: string) => Promise<void>;
  resendOtp: () => Promise<void>;
  reset: () => void;
  logout: () => Promise<void>;
}

function isLoginSuccess(r: AuthResponse): r is { nextStep: "AUTHENTICATED"; id: number; email: string; role: string; nama: string; tipe?: string } {
  return r.nextStep === "AUTHENTICATED";
}

function isLoginOtpRequired(r: AuthResponse): r is { nextStep: "OTP_REQUIRED"; userId: number; email: string; nama: string; role: string } {
  return r.nextStep === "OTP_REQUIRED";
}

function isLoginTelegramLinkRequired(r: AuthResponse): r is { nextStep: "TELEGRAM_LINK_REQUIRED"; userId: number; email: string; nama: string; role: string } {
  return r.nextStep === "TELEGRAM_LINK_REQUIRED";
}

export function useAuthMachine(): AuthMachineContext {
  const [state, setState] = useState<AuthState>("IDLE");
  const [challengeId, setChallengeId] = useState<string | null>(() => sessionStorage.getItem("auth_challengeId"));
  const [expiresAt, setExpiresAt] = useState<string | null>(() => sessionStorage.getItem("auth_expiresAt"));
  const [pendingUserId, setPendingUserId] = useState<number | null>(() => {
    const stored = sessionStorage.getItem("auth_pendingUserId");
    return stored ? Number(stored) : null;
  });
  const [pendingEmail, setPendingEmail] = useState<string | null>(() => sessionStorage.getItem("auth_pendingEmail"));
  const [pendingNama, setPendingNama] = useState<string | null>(() => sessionStorage.getItem("auth_pendingNama"));
  const [pendingRole, setPendingRole] = useState<string | null>(() => sessionStorage.getItem("auth_pendingRole"));
  const [error, setError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const loginMutation = useLogin();
  const otpRequestMutation = useOtpRequest();
  const otpVerifyMutation = useOtpVerify();
  const otpResendMutation = useOtpResend();
  const logoutMutation = useLogout();

  const clearSession = useCallback(() => {
    sessionStorage.removeItem("auth_pendingUserId");
    sessionStorage.removeItem("auth_pendingEmail");
    sessionStorage.removeItem("auth_pendingNama");
    sessionStorage.removeItem("auth_pendingRole");
    sessionStorage.removeItem("auth_challengeId");
    sessionStorage.removeItem("auth_expiresAt");
  }, []);

  const navigateOnSuccess = useCallback(async () => {
    // Clear presentation session from localStorage to prevent it from interfering
    // with the dashboard session.
    try {
      const raw = localStorage.getItem("presentation_auth_v1");
      if (raw) localStorage.removeItem("presentation_auth_v1");
    } catch { /* ignore */ }

    // Use window.location.href (hard redirect) instead of setLocation to ensure
    // AuthProvider fully remounts with the fresh session cookie. Client-side
    // routing (setLocation) doesn't remount AuthProvider, causing a race where
    // the old session may still be read.
    window.location.href = "/import";
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setState("CREDENTIAL_VALIDATING");
    setError(null);
    try {
      const response = await loginMutation.mutateAsync({ data: { email, password } });

      if (response.error) {
        setState("AUTH_ERROR");
        setError(response.error);
        return;
      }

      if (isLoginSuccess(response)) {
        clearSession();
        setState("AUTHENTICATED");
        // Invalidate React Query cache so AuthProvider/useGetMe picks up the session cookie
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        await navigateOnSuccess();
        return;
      }

      if (isLoginOtpRequired(response)) {
        setPendingUserId(response.userId);
        sessionStorage.setItem("auth_pendingUserId", String(response.userId));
        setPendingEmail(response.email);
        sessionStorage.setItem("auth_pendingEmail", response.email);
        setPendingNama(response.nama);
        sessionStorage.setItem("auth_pendingNama", response.nama);
        setPendingRole(response.role);
        sessionStorage.setItem("auth_pendingRole", response.role);
        // Auto-request OTP
        try {
          const otpResult = await otpRequestMutation.mutateAsync({ data: { userId: response.userId } });
          setChallengeId(otpResult.challengeId);
          sessionStorage.setItem("auth_challengeId", otpResult.challengeId);
          setExpiresAt(otpResult.expiresAt);
          sessionStorage.setItem("auth_expiresAt", otpResult.expiresAt);
          setState("OTP_REQUIRED");
        } catch (otpErr: any) {
          setState("AUTH_ERROR");
          setError(otpErr?.error || "Gagal mengirim kode verifikasi. Pastikan akun Telegram Anda terhubung.");
        }
        return;
      }

      if (isLoginTelegramLinkRequired(response)) {
        setPendingUserId(response.userId);
        sessionStorage.setItem("auth_pendingUserId", String(response.userId));
        setPendingEmail(response.email);
        sessionStorage.setItem("auth_pendingEmail", response.email);
        setPendingNama(response.nama);
        sessionStorage.setItem("auth_pendingNama", response.nama);
        setPendingRole(response.role);
        sessionStorage.setItem("auth_pendingRole", response.role);
        setState("TELEGRAM_LINK_REQUIRED");
        return;
      }
    } catch (err: any) {
      setState("AUTH_ERROR");
      setError(err?.error || "Email/NIK atau password salah");
    }
  }, [loginMutation, otpRequestMutation, navigateOnSuccess, clearSession]);

  const requestOtp = useCallback(async () => {
    const uid = pendingUserId ?? Number(sessionStorage.getItem("auth_pendingUserId"));
    if (!uid) return;
    setError(null);
    try {
      const result = await otpRequestMutation.mutateAsync({ data: { userId: uid } });
      setChallengeId(result.challengeId);
      sessionStorage.setItem("auth_challengeId", result.challengeId);
      setExpiresAt(result.expiresAt);
      sessionStorage.setItem("auth_expiresAt", result.expiresAt);
    } catch (err: any) {
      setError(err?.error || "Gagal mengirim kode verifikasi.");
      throw err;
    }
  }, [pendingUserId, otpRequestMutation]);

  const verifyOtp = useCallback(async (otp: string) => {
    const cid = challengeId ?? sessionStorage.getItem("auth_challengeId");
    if (!cid) { setError("Challenge tidak valid"); return; }
    setError(null);
    try {
      await otpVerifyMutation.mutateAsync({ data: { challengeId: cid, otp } });
      clearSession();
      setState("AUTHENTICATED");
      await navigateOnSuccess();
    } catch (err: any) {
      const message = err?.data?.error ?? err?.message ?? "Kode verifikasi tidak sesuai";
      setError(message);
      throw err;
    }
  }, [challengeId, otpVerifyMutation, navigateOnSuccess, clearSession]);

  const resendOtp = useCallback(async () => {
    setError(null);
    try {
      const result = await otpResendMutation.mutateAsync();
      setChallengeId(result.challengeId);
      sessionStorage.setItem("auth_challengeId", result.challengeId);
      setExpiresAt(result.expiresAt);
      sessionStorage.setItem("auth_expiresAt", result.expiresAt);
    } catch (err: any) {
      const message = err?.data?.error ?? err?.message ?? "Gagal mengirim kode verifikasi ulang.";
      setError(message);
      throw err;
    }
  }, [otpResendMutation]);

  const reset = useCallback(() => {
    clearSession();
    setState("IDLE");
    setChallengeId(null);
    setExpiresAt(null);
    setPendingUserId(null);
    setPendingEmail(null);
    setPendingNama(null);
    setPendingRole(null);
    setError(null);
  }, [clearSession]);

  const logout = useCallback(async () => {
    reset();
    try {
      await logoutMutation.mutateAsync();
      queryClient.clear();
      setLocation("/login");
    } catch {
      queryClient.clear();
      setLocation("/login");
    }
  }, [logoutMutation, queryClient, reset, setLocation]);

  return {
    state,
    challengeId,
    expiresAt,
    pendingUserId,
    pendingEmail,
    pendingNama,
    pendingRole,
    error,
    login,
    navigateOnSuccess,
    requestOtp,
    verifyOtp,
    resendOtp,
    reset,
    logout,
  };
}

// ─── Presentation Auth Machine ───────────────────────────────────────────────

export interface PresentationAuthMachineContext {
  state: AuthState;
  challengeId: string | null;
  expiresAt: string | null;
  pendingUserId: number | null;
  pendingNik: string | null;
  pendingNama: string | null;
  error: string | null;
  requestOtp: (nik: string) => Promise<void>;
  verifyOtp: (otp: string) => Promise<void>;
  resendOtp: () => Promise<void>;
  reset: () => void;
}

function isPresentationOtpRequired(r: PresentationLoginResponse): r is { nextStep: "OTP_REQUIRED"; userId: number; nama: string; challengeId: string; expiresAt: string } {
  return r.nextStep === "OTP_REQUIRED";
}

function isPresentationTelegramLinkRequired(r: PresentationLoginResponse): r is { nextStep: "TELEGRAM_LINK_REQUIRED"; userId: number; nama: string } {
  return r.nextStep === "TELEGRAM_LINK_REQUIRED";
}

export function usePresentationAuthMachine(): PresentationAuthMachineContext {
  const [state, setState] = useState<AuthState>("IDLE");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<number | null>(null);
  const [pendingNik, setPendingNik] = useState<string | null>(null);
  const [pendingNama, setPendingNama] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const presentationRequestMutation = usePresentationRequestOtp();
  const presentationVerifyMutation = usePresentationVerifyOtp();
  const otpResendMutation = useOtpResend();

  const requestOtp = useCallback(async (nik: string) => {
    setState("CREDENTIAL_VALIDATING");
    setError(null);
    setPendingNik(nik);
    try {
      const response = await presentationRequestMutation.mutateAsync({ data: { nik } });

      if (response.error) {
        setState("AUTH_ERROR");
        setError(response.error);
        return;
      }

      if (isPresentationOtpRequired(response)) {
        setPendingUserId(response.userId);
        setPendingNama(response.nama);
        setChallengeId(response.challengeId);
        setExpiresAt(response.expiresAt);
        // Persist to sessionStorage so OTP page can read without stale closure issues
        sessionStorage.setItem("auth_challengeId", response.challengeId);
        sessionStorage.setItem("auth_expiresAt", response.expiresAt);
        sessionStorage.setItem("auth_pendingNik", nik);
        sessionStorage.setItem("auth_pendingNama", response.nama);
        sessionStorage.setItem("auth_pendingUserId", String(response.userId));
        setState("OTP_REQUIRED");
        return;
      }

      if (isPresentationTelegramLinkRequired(response)) {
        setPendingUserId(response.userId);
        setPendingNama(response.nama);
        setState("TELEGRAM_LINK_REQUIRED");
        return;
      }
    } catch (err: any) {
      setState("AUTH_ERROR");
      const message = err?.data?.error ?? err?.message ?? "NIK tidak ditemukan";
      setError(message);
    }
  }, [presentationRequestMutation]);

  const verifyOtp = useCallback(async (otp: string) => {
    if (!challengeId) { setError("Challenge tidak valid"); return; }
    setError(null);
    try {
      const result = await presentationVerifyMutation.mutateAsync({ data: { challengeId, otp, userId: pendingUserId ?? undefined } });
      setState("AUTHENTICATED");
      return result; // contains presentationToken on success
    } catch (err: any) {
      const message = err?.data?.error ?? err?.message ?? "Kode verifikasi tidak sesuai";
      setError(message);
      throw err;
    }
  }, [challengeId, pendingUserId, presentationVerifyMutation]);

  const resendOtp = useCallback(async () => {
    setError(null);
    try {
      const result = await otpResendMutation.mutateAsync();
      setChallengeId(result.challengeId);
      setExpiresAt(result.expiresAt);
      // Persist to sessionStorage for OTP page to read
      sessionStorage.setItem("auth_challengeId", result.challengeId);
      sessionStorage.setItem("auth_expiresAt", result.expiresAt);
    } catch (err: any) {
      const message = err?.data?.error ?? err?.message ?? "Gagal mengirim kode verifikasi ulang.";
      setError(message);
      throw err;
    }
  }, [otpResendMutation]);

  const reset = useCallback(() => {
    setState("IDLE");
    setChallengeId(null);
    setExpiresAt(null);
    setPendingUserId(null);
    setPendingNik(null);
    setPendingNama(null);
    setError(null);
    sessionStorage.removeItem("auth_challengeId");
    sessionStorage.removeItem("auth_expiresAt");
    sessionStorage.removeItem("auth_pendingNik");
    sessionStorage.removeItem("auth_pendingNama");
    sessionStorage.removeItem("auth_pendingUserId");
  }, []);

  return {
    state,
    challengeId,
    expiresAt,
    pendingUserId,
    pendingNik,
    pendingNama,
    error,
    requestOtp,
    verifyOtp,
    resendOtp,
    reset,
  };
}
