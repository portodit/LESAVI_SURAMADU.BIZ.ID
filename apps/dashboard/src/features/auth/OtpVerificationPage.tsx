import React, { useState, useRef, useEffect, useCallback } from "react";
import { flushSync } from "react-dom";
import { Loader2, ShieldCheck, XCircle } from "lucide-react";
import { usePresentationAuthMachine } from "@/shared/hooks/use-auth-machine";
import { storePresentationSession } from "@/shared/hooks/use-presentation-auth";

interface OtpVerificationPageProps {
  mode?: "dashboard" | "presentation";
}

export default function OtpVerificationPage({ mode = "dashboard" }: OtpVerificationPageProps) {
  const authMachine = usePresentationAuthMachine();

  const [otp, setOtp] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [otpExpirySeconds, setOtpExpirySeconds] = useState(0);
  const [locked, setLocked] = useState(false);

  const expiryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Derive challenge invalid from error
  const hasChallengeError =
    (localError?.toLowerCase().includes("challenge tidak") ?? false) ||
    (localError?.toLowerCase().includes("mulai proses login dari awal") ?? false) ||
    (localError?.toLowerCase().includes("mulai login ulang") ?? false) ||
    (localError?.toLowerCase().includes("silakan mulai") ?? false);

  // Input disabled when: challenge invalid, or cooldown is running
  const isInputDisabled = hasChallengeError || cooldown > 0;

  // OTP expiry countdown
  useEffect(() => {
    const expiresAt = sessionStorage.getItem("auth_expiresAt");
    if (!expiresAt) return;

    const tick = () => {
      const exp = sessionStorage.getItem("auth_expiresAt");
      if (!exp) return;
      const remaining = Math.max(0, Math.ceil((new Date(exp).getTime() - Date.now()) / 1000));
      setOtpExpirySeconds(remaining);
      if (remaining <= 0) {
        setLocalError("Kode verifikasi telah kedaluwarsa. Silakan minta kode baru.");
        if (expiryRef.current) clearInterval(expiryRef.current);
      }
    };
    tick();
    expiryRef.current = setInterval(tick, 1000);
    return () => { if (expiryRef.current) clearInterval(expiryRef.current); };
  }, []);

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) {
      if (cooldownRef.current) { clearInterval(cooldownRef.current); cooldownRef.current = null; }
      return;
    }
    cooldownRef.current = setInterval(() => {
      setCooldown(c => {
        if (c <= 1) {
          if (cooldownRef.current) { clearInterval(cooldownRef.current); cooldownRef.current = null; }
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, [cooldown > 0]);

  // Unlock when cooldown ends
  useEffect(() => {
    if (cooldown === 0 && locked) {
      setLocked(false);
    }
  }, [cooldown, locked]);

  const handleVerify = useCallback(async (currentOtp?: string) => {
    const code = currentOtp ?? otp;
    if (code.length !== 5) {
      setLocalError("Masukkan 5 digit kode verifikasi");
      return;
    }

    const challengeId =
      sessionStorage.getItem("auth_challengeId") ??
      sessionStorage.getItem("pres_challengeId");
    if (!challengeId) {
      setLocalError("Challenge tidak valid. Silakan mulai dari awal.");
      return;
    }

    setIsVerifying(true);
    setLocalError(null);

    try {
      const apiBase = import.meta.env.VITE_API_URL ?? "";
      const res = await fetch(`${apiBase}/api/auth/presentation/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ challengeId, otp: code }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMsg = data?.error ?? "Kode verifikasi tidak sesuai";
        setLocalError(errorMsg);
        setOtp("");
        setOtpExpirySeconds(0);
        // Only lock input if server explicitly says locked
        if (data?.locked) {
          flushSync(() => { setLocked(true); });
          flushSync(() => { setCooldown(60); });
        }
        setIsVerifying(false);
        return;
      }

      if (mode === "presentation") {
        const token: string = data?.presentationToken ?? "";
        const pendingNik =
          sessionStorage.getItem("auth_pendingNik") ??
          sessionStorage.getItem("pres_pendingNik") ?? "";
        const nama =
          sessionStorage.getItem("auth_pendingNama") ??
          sessionStorage.getItem("pres_pendingNama") ?? "";
        storePresentationSession(pendingNik, nama, token);
        window.location.href = "/presentation";
      }
    } catch (err: any) {
      setLocalError(err?.message ?? "Koneksi gagal. Silakan coba lagi.");
      setOtp("");
      flushSync(() => { setLocked(true); });
      flushSync(() => { setCooldown(60); });
    } finally {
      setIsVerifying(false);
    }
  }, [otp, mode]);

  const handleResend = async () => {
    if (cooldown > 0 || locked) return;
    setIsResending(true);
    try {
      if (expiryRef.current) { clearInterval(expiryRef.current); expiryRef.current = null; }
      setOtpExpirySeconds(0);
      await authMachine.resendOtp();
      setLocalError(null);
      setOtp("");
      setLocked(false);
      setCooldown(0);
      // Restart expiry countdown from sessionStorage
      expiryRef.current = setInterval(() => {
        const exp = sessionStorage.getItem("auth_expiresAt");
        if (!exp) return;
        const remaining = Math.max(0, Math.ceil((new Date(exp).getTime() - Date.now()) / 1000));
        setOtpExpirySeconds(remaining);
        if (remaining <= 0) {
          setLocalError("Kode verifikasi telah kedaluwarsa. Silakan minta kode baru.");
          if (expiryRef.current) clearInterval(expiryRef.current);
        }
      }, 1000);
    } catch (err: any) {
      setLocalError(err?.data?.error ?? err?.message ?? "Gagal mengirim kode verifikasi ulang.");
      setCooldown(60);
    } finally {
      setIsResending(false);
    }
  };

  const handleBack = () => {
    window.location.href = mode === "presentation" ? "/presentation/login" : "/login";
  };

  const showTimer = (cooldown > 0 || otpExpirySeconds > 0) && !hasChallengeError;
  const verifyDisabled = otp.length !== 5 || isVerifying || isInputDisabled;
  const resendDisabled = isVerifying || isResending || otpExpirySeconds > 0;

  return (
    <div className="relative flex min-h-screen w-full overflow-hidden">
      <div className="absolute inset-0 z-0 lg:hidden">
        <img src={`${import.meta.env.BASE_URL}login-bg.jpg`} alt="" className="h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-[#cc0000]/70 mix-blend-multiply" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
      </div>

      <div className="relative z-10 flex w-full items-center justify-center p-4 sm:p-6 lg:justify-start lg:p-0">
        <div className="w-full max-w-[440px] bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl px-8 py-10 sm:px-10 sm:py-12 lg:rounded-none lg:h-screen lg:max-w-none lg:w-[42%] xl:w-[40%] lg:flex lg:flex-col lg:justify-center lg:bg-white lg:backdrop-blur-none lg:shadow-none lg:px-14 lg:py-16 overflow-y-auto">
          <div className="mx-auto w-full max-w-[418px]">

            {/* Logo */}
            <div className="mb-8 flex items-center gap-3.5">
              <img src={`${import.meta.env.BASE_URL}logo-tr3.png`} alt="Logo TR3" className="h-12 object-contain shrink-0" />
              <div className="flex flex-col leading-tight">
                <p className="text-[15px] font-bold text-[#101828] tracking-[-0.45px]" style={{ fontFamily: "'Montserrat', sans-serif" }}>LESA VI · WITEL SURAMADU</p>
                <p className="text-[10px] font-semibold tracking-[1.5px] uppercase text-[#cc0000]" style={{ fontFamily: "'Inter', sans-serif" }}>Monitoring Dashboard</p>
              </div>
            </div>

            {/* Icon */}
            <div className="mb-5 flex justify-center">
              <div className="w-14 h-14 rounded-full bg-green-50 border border-green-200 flex items-center justify-center">
                <ShieldCheck className="w-7 h-7 text-green-600" />
              </div>
            </div>

            {/* Heading */}
            <div className="mb-6 text-center">
              <h1 className="text-[24px] sm:text-[28px] font-bold text-[#101828] tracking-[-0.75px] leading-8 mb-2" style={{ fontFamily: "'Montserrat', sans-serif" }}>Verifikasi Akses</h1>
              <p className="text-sm text-[#6a7282] tracking-[-0.16px] leading-5">
                {sessionStorage.getItem("auth_pendingNama") ? <>Hai <strong>{sessionStorage.getItem("auth_pendingNama")}</strong>, </> : null}
                Untuk menjaga keamanan akun Anda, kami telah mengirimkan kode verifikasi 5 digit ke akun Telegram yang terhubung. Masukkan kode tersebut untuk melanjutkan ke dashboard.
              </p>
            </div>

            {/* Error */}
            {localError && (
              <div className="mb-4 bg-red-50 border-2 border-red-300 rounded-2xl px-4 py-3">
                <div className="flex items-start gap-2.5">
                  <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-red-700 text-sm font-semibold leading-snug">{localError}</p>
                </div>
              </div>
            )}

            {/* OTP Input */}
            <div className="flex justify-center mb-6">
              <div className="w-full max-w-[280px]">
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={isInputDisabled ? "" : otp}
                  onChange={isInputDisabled ? undefined : (e => {
                    const raw = e.target.value.replace(/\D/g, "").slice(0, 5);
                    setOtp(raw);
                    if (raw.length === 5) {
                      setLocalError(null);
                      handleVerify(raw);
                    }
                  })}
                  onKeyDown={isInputDisabled ? undefined : (e => {
                    if (e.key === "Enter" && otp.length === 5) handleVerify(otp);
                  })}
                  placeholder={isInputDisabled ? "" : "• • • • •"}
                  disabled={isInputDisabled}
                  readOnly={isInputDisabled}
                  className={
                    isInputDisabled
                      ? "w-full text-center text-2xl font-bold tracking-[12px] py-3 px-4 rounded-xl border-2 border-gray-200 bg-gray-100 text-gray-400 outline-none cursor-not-allowed select-none"
                      : "w-full text-center text-2xl font-bold tracking-[12px] py-3 px-4 rounded-xl border-2 border-gray-200 bg-gray-50 outline-none focus:border-[#cc0000] focus:ring-4 focus:ring-red-100 transition-all placeholder:text-gray-300"
                  }
                  style={{ fontFamily: "'Inter', sans-serif", color: isInputDisabled ? "#9ca3af" : "#101828" }}
                  autoFocus={!isInputDisabled}
                />
              </div>
            </div>

            {/* Timer */}
            {showTimer ? (
              <div className="text-center mb-4">
                {cooldown > 0 ? (
                  <span className="text-xs font-medium text-[#374151]">
                    Tunggu <span className="font-bold">{String(Math.floor(cooldown / 60)).padStart(2, "0")}:{String(cooldown % 60).padStart(2, "0")}</span> sebelum kirim ulang
                  </span>
                ) : (
                  <span className="text-xs text-[#374151]">
                    Kode berlaku <span className={otpExpirySeconds <= 60 ? "font-semibold text-[#cc0000]" : ""}>{String(Math.floor(otpExpirySeconds / 60)).padStart(2, "0")}:{String(otpExpirySeconds % 60).padStart(2, "0")}</span> lagi
                  </span>
                )}
              </div>
            ) : null}

            {/* Verify Button */}
            <div className="relative mb-4">
              <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{ boxShadow: "0px 10px 15px -3px #ffc9c9, 0px 4px 6px -4px #ffc9c9" }} />
              <button
                type="button"
                onClick={() => handleVerify()}
                disabled={verifyDisabled}
                className="relative w-full flex items-center justify-center gap-2 bg-[#cc0000] hover:bg-[#b50000] active:scale-[0.98] text-white rounded-2xl py-[14px] px-4 text-sm font-bold tracking-[-0.16px] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                {isVerifying ? <><Loader2 className="w-4 h-4 animate-spin" /> Memverifikasi...</> : "Verifikasi"}
              </button>
            </div>

            {/* Kirim Ulang */}
            <div className="text-center mb-4">
              <button
                type="button"
                onClick={handleResend}
                disabled={resendDisabled}
                className={
                  resendDisabled
                    ? "text-sm font-semibold text-[#d1d5db] cursor-not-allowed no-underline"
                    : "text-sm font-semibold text-[#cc0000] hover:text-[#b50000] hover:underline"
                }
              >
                {isResending ? "Mengirim..." : otpExpirySeconds > 0 ? `Kirim Ulang Kode` : "Kirim Ulang Kode"}
              </button>
            </div>

            {/* Back */}
            <button
              type="button"
              onClick={handleBack}
              className="w-full flex items-center justify-center gap-1.5 bg-white border-2 border-[#e5e7eb] hover:border-[#d1d5db] hover:bg-[#f9fafb] active:scale-[0.99] text-[#374151] rounded-xl py-[11px] px-4 text-sm font-semibold tracking-[-0.16px] transition-all"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              ← Kembali ke halaman masuk
            </button>

            <p className="mt-8 text-[11px] text-[#99a1af] text-center tracking-[-0.16px]" style={{ fontFamily: "'Inter', sans-serif" }}>
              © 2026 Large Enterprise Service Area VI Witel Suramadu Telkom Indonesia
            </p>
          </div>
        </div>

        <div className="hidden lg:flex lg:flex-1 relative overflow-hidden self-stretch">
          <img src={`${import.meta.env.BASE_URL}login-bg.jpg`} alt="" className="absolute inset-0 w-full h-full object-cover object-center" />
          <div className="absolute inset-0 bg-[#cc0000]/70 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
        </div>
      </div>
    </div>
  );
}
