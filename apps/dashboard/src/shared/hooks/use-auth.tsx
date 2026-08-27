import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/shared/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import type { AuthResponse, LoginBody } from "@workspace/api-client-react";

interface AuthContextType {
  user: AuthResponse | null;
  isLoading: boolean;
  login: (data: LoginBody) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const hasLoginStarted = useRef(false);

  // Direct fetch instead of useQuery/useGetMe to avoid React Query state transitions
  // that can cause React Error #185 (cannot update during render) in React 19.
  // Using a simple useState + useEffect avoids the complex state machine of React Query.
  const [user, setUser] = useState<AuthResponse | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    fetch("/api/auth/me", {
      credentials: "include",
      signal: controller.signal,
    }).then(async (res) => {
      if (cancelled) return;
      // 304 = session valid but no body (Express session caching).
      // 200 = normal session response with user JSON.
      // Treat both as "valid session" — treat any other status as unauthenticated.
      if (res.ok || res.status === 304) {
        try {
          const data = await res.json();
          setUser(data as AuthResponse);
        } catch {
          // 304 has empty body — session exists but no parsed data.
          // Treat as unauthenticated (no user object to work with).
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    }).catch((err) => {
      if (cancelled || err.name === "AbortError") return;
      setUser(null);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const loginMutation = useCallback(async (data: LoginBody) => {
    hasLoginStarted.current = true;
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) {
      hasLoginStarted.current = false;
      throw { error: result.error || "Email atau password salah" };
    }
    queryClient.invalidateQueries();
    setUser(result as AuthResponse);
    toast({ title: "Login berhasil", description: "Selamat datang kembali.", variant: "success" });
    await new Promise(r => setTimeout(r, 80));
    setLocation("/import");
  }, [queryClient, toast, setLocation]);

  const logoutMutation = useCallback(async () => {
    hasLoginStarted.current = false;
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch { /* ignore */ }
    queryClient.clear();
    setUser(null);
    window.location.href = "/login";
  }, [queryClient]);

  const login = useCallback(async (data: LoginBody) => {
    await loginMutation(data);
  }, [loginMutation]);

  const logout = useCallback(async () => {
    await logoutMutation();
  }, [logoutMutation]);

  const contextValue = useMemo<AuthContextType>(() => ({
    user: user ?? null,
    isLoading: user === undefined,
    login,
    logout,
  }), [user, login, logout]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
