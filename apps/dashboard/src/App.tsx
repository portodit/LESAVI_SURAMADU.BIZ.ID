import { useEffect, useState, Component, type ReactNode } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/shared/ui/toaster";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { AuthProvider, useAuth } from "@/shared/hooks/use-auth";
import { ImportGuardProvider } from "@/shared/hooks/use-import-guard";
import { DashboardLayout } from "@/shared/layout";
import { Loader2, AlertTriangle } from "lucide-react";
import { setBaseUrl } from "@workspace/api-client-react";

import Login from "@/features/auth/LoginPage";
import OtpVerificationPage from "@/features/auth/OtpVerificationPage";
import TelegramLinkRequiredPage from "@/features/auth/TelegramLinkRequiredPage";
import EmbedPerforma from "@/features/performance/PresentationPage";
import PresentationLoginPage from "@/features/performance/PresentationLoginPage";
import { getPresentationSession, clearPresentationSession } from "@/shared/hooks/use-presentation-auth";
import ImportData from "@/features/import/ImportPage";
import ImportDetail from "@/features/import/ImportDetailPage";
import PerformaVis from "@/features/performance/PerformaPage";
import FunnelVis from "@/features/funnel/FunnelPage";
import ActivityVis from "@/features/activity/ActivityPage";
import TelegramBot from "@/features/telegram/TelegramPage";
import PengaturanPage from "@/features/settings/PengaturanPage";
import ManajemenAmPage from "@/features/am/ManajemenAmPage";
import CorporateCustomerPage from "@/features/corporate/CorporateCustomerPage";

// ─── Query Client ───────────────────────────────────────────────────────────────
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

// ─── Error Boundary ─────────────────────────────────────────────────────────────
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

class ErrorBoundary extends Component<{ children: ReactNode; onReset?: () => void }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode; onReset?: () => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
    queryClient.clear();
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-sm w-full bg-white border border-red-200 rounded-2xl p-6 text-center shadow-lg">
            <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-[#101828] mb-2">Terjadi Kesalahan</h2>
            <p className="text-sm text-[#6a7282] mb-4">
              Terjadi kesalahan pada aplikasi. Silakan coba lagi.
            </p>
            <button
              onClick={this.reset}
              className="w-full bg-[#cc0000] hover:bg-[#b50000] text-white rounded-xl py-2.5 px-4 text-sm font-bold transition-colors"
            >
              Coba Lagi
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Safe Redirect ───────────────────────────────────────────────────────────────
function SafeRedirect({ to }: { to: string }) {
  useEffect(() => {
    // Preserve query params from current URL (e.g. ?type=funnel&snapshot=142)
    const qp = window.location.search;
    window.location.href = to + qp;
  }, [to]);
  return null;
}

// ─── Public AM Page ──────────────────────────────────────────────────────────────
function PublicAmPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <p className="text-lg font-medium text-muted-foreground">Public AM Profile (Dalam Pengembangan)</p>
    </div>
  );
}

// ─── Presentation Guard ─────────────────────────────────────────────────────────
function PresentationGuard() {
  const [status, setStatus] = useState<"loading" | "allowed" | "denied">("loading");

  useEffect(() => {
    const session = getPresentationSession();
    console.log("[PresentationGuard] session:", session ? `token=${session.presentationToken.slice(0, 8)}...` : "null");
    if (!session?.presentationToken) {
      console.log("[PresentationGuard] no token, denied");
      setStatus("denied");
      return;
    }

    let cancelled = false;
    fetch("/api/auth/presentation/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presentationToken: session.presentationToken }),
      credentials: "include",
    }).then((res) => {
      if (cancelled) return;
      console.log("[PresentationGuard] validate response:", res.status);
      if (res.ok) {
        res.json().then(data => console.log("[PresentationGuard] valid, user:", data.nama, data.role));
        setStatus("allowed");
      } else {
        res.text().then(err => console.log("[PresentationGuard] invalid:", err));
        clearPresentationSession();
        setStatus("denied");
      }
    }).catch((err) => {
      if (cancelled) return;
      console.log("[PresentationGuard] fetch error:", err);
      clearPresentationSession();
      setStatus("denied");
    });

    return () => { cancelled = true; };
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "denied") {
    return <SafeRedirect to="/presentation/login" />;
  }

  return <EmbedPerforma />;
}

// ─── Dashboard Router (wrapped in AuthProvider) ───────────────────────────────
// IMPORTANT: do NOT have a root "/" route here — it would match before RootPage.
// Root path is handled separately in AppRouter.
function DashboardRouter() {
  return (
    <Switch>
      <Route path="/import" component={ImportData} />
      <Route path="/import/detail/:type/:id">{(params: any) => <ImportDetail params={params} />}</Route>
      <Route path="/visualisasi/performa" component={PerformaVis} />
      <Route path="/visualisasi/funnel" component={FunnelVis} />
      <Route path="/visualisasi/activity" component={ActivityVis} />
      <Route path="/manajemen-akun" component={ManajemenAmPage} />
      <Route path="/corporate-customers" component={CorporateCustomerPage} />
      <Route path="/telegram" component={TelegramBot} />
      <Route path="/pengaturan" component={PengaturanPage} />
      <Route path="/dashboard" component={ImportData} />
      <Route><SafeRedirect to="/import" /></Route>
    </Switch>
  );
}

// ─── Root Page — only rendered for / ─────────────────────────────────────────
function RootPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not logged in → go to dashboard login
  if (!user) {
    window.location.href = "/login";
    return null;
  }

  // ACCOUNT_MANAGER → go to presentation
  if (user.role === "ACCOUNT_MANAGER") {
    window.location.href = "/presentation";
    return null;
  }

  // All other roles (ADMIN/OFFICER/MANAGER) → go to dashboard import
  window.location.href = "/import";
  return null;
}

// ─── Protected App ───────────────────────────────────────────────────────────────
// Only rendered inside AuthProvider, so useAuth is always available.
function ProtectedApp() {
  const { user, isLoading } = useAuth();
  console.log("[ProtectedApp] isLoading=", isLoading, "user=", user?.role, user?.nama);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // ACCOUNT_MANAGER cannot access dashboard — redirect to presentation login
  if (user?.role === "ACCOUNT_MANAGER") {
    console.log("[ProtectedApp] ACCOUNT_MANAGER detected, redirecting to /presentation/login");
    window.location.href = "/presentation/login";
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not logged in — redirect to dashboard login
  if (!user) {
    console.log("[ProtectedApp] no user, redirecting to /login");
    window.location.href = "/login";
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <DashboardRouter />
    </DashboardLayout>
  );
}

// ─── App Router ─────────────────────────────────────────────────────────────────
// Public routes (login, otp, presentation) are OUTSIDE AuthProvider.
// Dashboard routes are INSIDE AuthProvider.
function AppRouter() {
  return (
    <Switch>
      {/* ── Presentation routes — NO AuthProvider, uses localStorage token ── */}
      <Route path="/presentation/login" component={PresentationLoginPage} />
      <Route path="/presentation" component={PresentationGuard} />
      <Route path="/auth/otp-verify/presentation"><OtpVerificationPage mode="presentation" /></Route>
      <Route path="/am-public/:slug" component={PublicAmPage} />
      <Route path="/embed/performa" component={EmbedPerforma} />

      {/* ── Auth / Login routes — OUTSIDE ProtectedApp, no auth check ── */}
      <Route path="/login" component={Login} />
      <Route path="/auth/otp-verify">{() => <OtpVerificationPage />}</Route>
      <Route path="/auth/telegram-link" component={TelegramLinkRequiredPage} />

      {/* ── Root route — redirect based on auth role ── */}
      <Route path="/"><RootPage /></Route>

      {/* ── Dashboard routes — wrapped in AuthProvider below ── */}
      <Route component={ProtectedApp} />
    </Switch>
  );
}

// ─── App ────────────────────────────────────────────────────────────────────────
const apiUrl = import.meta.env.VITE_API_URL || "";
setBaseUrl(apiUrl);

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <ErrorBoundary>
            <ImportGuardProvider>
              {/* AuthProvider wraps ONLY dashboard routes. */}
              {/* Presentation routes read from localStorage, not session cookies. */}
              <AuthProvider>
                <AppRouter />
              </AuthProvider>
            </ImportGuardProvider>
          </ErrorBoundary>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
