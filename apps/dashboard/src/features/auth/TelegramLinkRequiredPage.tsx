import React, { useState } from "react";
import { useLocation } from "wouter";
import { MessageCircle, ShieldAlert, Users, ExternalLink, Loader2, CheckCircle } from "lucide-react";
import { useAuthMachine } from "@/shared/hooks/use-auth-machine";
import { useListOfficers } from "@workspace/api-client-react";

export default function TelegramLinkRequiredPage() {
  const authMachine = useAuthMachine();
  const [, setLocation] = useLocation();
  const { data: officers, isLoading } = useListOfficers();
  const [step, setStep] = useState<"instructions" | "success">("instructions");

  const handleBack = () => {
    authMachine.reset();
    setLocation("/login");
  };

  if (step === "success") {
    return (
      <div className="relative flex min-h-screen w-full overflow-hidden">
        <div className="absolute inset-0 z-0 lg:hidden">
          <img src={`${import.meta.env.BASE_URL}login-bg.jpg`} alt="" className="h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-[#cc0000]/70 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
        </div>

        <div className="relative z-10 flex w-full items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-[440px] bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl px-8 py-10 sm:px-10 sm:py-12 overflow-y-auto">
            <div className="mx-auto w-full max-w-[418px] text-center">
              <div className="mb-5 flex justify-center">
                <div className="w-16 h-16 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
              </div>
              <h1 className="text-[24px] sm:text-[28px] font-bold text-[#101828] tracking-[-0.75px] leading-8 mb-3"
                style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Akun Telegram Terhubung!
              </h1>
              <p className="text-sm text-[#6a7282] tracking-[-0.16px] leading-5 mb-8">
                Akun Telegram Anda berhasil terhubung. Silakan masuk kembali untuk melanjutkan.
              </p>
              <button
                type="button"
                onClick={() => {
                  authMachine.reset();
                  setLocation("/login");
                }}
                className="relative w-full flex items-center justify-center gap-2 bg-[#cc0000] hover:bg-[#b50000] active:scale-[0.98] text-white rounded-2xl py-[14px] px-4 text-sm font-bold tracking-[-0.16px] transition-all"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                Kembali ke Halaman Masuk
              </button>
              <p className="mt-8 text-[11px] text-[#99a1af] text-center tracking-[-0.16px]"
                style={{ fontFamily: "'Inter', sans-serif" }}>
                © 2026 Large Enterprise Service Area VI Witel Suramadu Telkom Indonesia
              </p>
            </div>
          </div>

          {/* Right panel — desktop only */}
          <div className="hidden lg:flex lg:flex-1 relative overflow-hidden self-stretch">
            <img src={`${import.meta.env.BASE_URL}login-bg.jpg`} alt="" className="absolute inset-0 w-full h-full object-cover object-center" />
            <div className="absolute inset-0 bg-[#cc0000]/70 mix-blend-multiply" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen w-full overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0 lg:hidden">
        <img src={`${import.meta.env.BASE_URL}login-bg.jpg`} alt="" className="h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-[#cc0000]/70 mix-blend-multiply" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
      </div>

      {/* Form card */}
      <div className="relative z-10 flex w-full items-center justify-center p-4 sm:p-6 lg:justify-start lg:p-0">
        <div className="w-full max-w-[500px] bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl px-8 py-10 sm:px-10 sm:py-12 lg:rounded-none lg:h-screen lg:max-w-none lg:w-[45%] xl:w-[42%] lg:flex lg:flex-col lg:justify-center lg:bg-white lg:shadow-none lg:px-14 lg:py-16 overflow-y-auto">
          <div className="mx-auto w-full max-w-[418px]">

            {/* Logo + Brand */}
            <div className="mb-6 flex items-center gap-3.5">
              <img src={`${import.meta.env.BASE_URL}logo-tr3.png`} alt="Logo TR3" className="h-12 object-contain shrink-0" />
              <div className="flex flex-col leading-tight">
                <p className="text-[15px] font-bold text-[#101828] tracking-[-0.45px]"
                  style={{ fontFamily: "'Montserrat', sans-serif" }}>
                  LESA VI · WITEL SURAMADU
                </p>
                <p className="text-[10px] font-semibold tracking-[1.5px] uppercase text-[#cc0000]"
                  style={{ fontFamily: "'Inter', sans-serif" }}>
                  Monitoring Dashboard
                </p>
              </div>
            </div>

            {/* Icon */}
            <div className="mb-4 flex justify-center">
              <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
                <MessageCircle className="w-7 h-7 text-amber-600" />
              </div>
            </div>

            {/* Heading */}
            <div className="mb-4 text-center">
              <h1 className="text-[24px] sm:text-[28px] font-bold text-[#101828] tracking-[-0.75px] leading-8 mb-2"
                style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Hubungkan Akun Telegram
              </h1>
              <p className="text-sm text-[#6a7282] tracking-[-0.16px] leading-5">
                Akun Anda belum terhubung dengan Telegram. Ikuti langkah-langkah di bawah untuk menghubungkan akun Anda.
              </p>
            </div>

            {/* Steps */}
            <div className="space-y-3 mb-5">
              {[
                {
                  step: "1",
                  title: "Buka Bot LESAVI",
                  desc: "Klik tombol di bawah untuk membuka bot Telegram LESAVI SURAMADU",
                },
                {
                  step: "2",
                  title: "Minta Kode Akses",
                  desc: "Ketik /kode dan sampaikan NIK Anda kepada petugas untuk mendapatkan kode akses",
                },
                {
                  step: "3",
                  title: "Masukkan Kode Akses",
                  desc: "Ketik kode akses yang diberikan petugas ke bot Telegram, format: LV-XXXXXX",
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-3 bg-[#f9fafb] rounded-2xl p-3.5">
                  <div className="w-7 h-7 rounded-full bg-[#cc0000] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {item.step}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#101828]">{item.title}</p>
                    <p className="text-xs text-[#6a7282] mt-0.5 leading-4">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA Button */}
            <div className="relative mb-4">
              <div className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{ boxShadow: "0px 10px 15px -3px #ffc9c9, 0px 4px 6px -4px #ffc9c9" }} />
              <a
                href="https://t.me/LESAVIBot"
                target="_blank"
                rel="noopener noreferrer"
                className="relative flex items-center justify-center gap-2 bg-[#cc0000] hover:bg-[#b50000] active:scale-[0.98] text-white rounded-2xl py-[14px] px-4 text-sm font-bold tracking-[-0.16px] transition-all"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
                Buka Bot LESAVI SURAMADU
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>
            </div>

            {/* Officers List */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2.5">
                <Users className="w-4 h-4 text-[#6a7282]" />
                <p className="text-xs font-semibold text-[#6a7282] uppercase tracking-[0.5px]"
                  style={{ fontFamily: "'Inter', sans-serif" }}>
                  Petugas yang dapat membantu
                </p>
              </div>
              {isLoading ? (
                <div className="flex items-center gap-2 text-xs text-[#99a1af]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Memuat daftar petugas...
                </div>
              ) : officers && officers.length > 0 ? (
                <div className="space-y-1.5">
                  {officers.map((officer) => (
                    <div key={officer.id} className="flex items-center gap-2.5 bg-[#f9fafb] rounded-xl px-3.5 py-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#cc0000]/10 flex items-center justify-center shrink-0">
                        <span className="text-[#cc0000] text-xs font-bold">
                          {officer.nama.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#101828] truncate">{officer.nama}</p>
                        <p className="text-[11px] text-[#99a1af]">
                          {officer.role} {officer.telegramUsername ? `· @${officer.telegramUsername}` : ""}
                        </p>
                      </div>
                      {officer.telegramConnected && (
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" title="Telegram aktif" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-[#99a1af]">Tidak ada petugas yang tersedia saat ini.</p>
              )}
            </div>

            {/* Security notice */}
            <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-3.5 py-3 mb-4">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-700 leading-4">
                Jangan bagikan kode akses <strong>LV-XXXXXX</strong> kepada siapa pun. Petugas tidak akan pernah meminta password Anda.
              </p>
            </div>

            {/* Back button — secondary style */}
            <button
              type="button"
              onClick={handleBack}
              className="w-full flex items-center justify-center gap-1.5 bg-white border-2 border-[#e5e7eb] hover:border-[#d1d5db] hover:bg-[#f9fafb] active:scale-[0.99] text-[#374151] rounded-xl py-[11px] px-4 text-sm font-semibold tracking-[-0.16px] transition-all"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              ← Kembali ke halaman masuk
            </button>

            {/* Footer */}
            <p className="mt-8 text-[11px] text-[#99a1af] text-center tracking-[-0.16px]"
              style={{ fontFamily: "'Inter', sans-serif" }}>
              © 2026 Large Enterprise Service Area VI Witel Suramadu Telkom Indonesia
            </p>
          </div>
        </div>

        {/* Right panel — desktop only */}
        <div className="hidden lg:flex lg:flex-1 relative overflow-hidden self-stretch">
          <img src={`${import.meta.env.BASE_URL}login-bg.jpg`} alt="" className="absolute inset-0 w-full h-full object-cover object-center" />
          <div className="absolute inset-0 bg-[#cc0000]/70 mix-blend-multiply" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
        </div>
      </div>
    </div>
  );
}
