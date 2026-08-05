import React, { createContext, useContext, useEffect, useRef } from "react";
import { useGetMe, useLogin, useLogout, type AuthResponse, type LoginBody } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useToast } from "@/shared/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

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

  const { data: user, isLoading: isUserLoading, isFetching } = useGetMe({
    query: {
      retry: false,
      staleTime: Infinity,
    }
  });

  const loginMutation = useLogin();
  const logoutMutation = useLogout();

  const login = async (data: LoginBody) => {
    hasLoginStarted.current = true;
    try {
      await loginMutation.mutateAsync({ data });
      toast({ title: "Login berhasil", description: "Selamat datang kembali.", variant: "success" });
      // Invalidate getMe so React Query refetches and all consumers (including ProtectedApp) update
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      // Give the refetch a moment to complete before navigation
      await new Promise(r => setTimeout(r, 80));
      setLocation("/import");
    } catch (err: any) {
      hasLoginStarted.current = false;
      toast({
        title: "Login gagal",
        description: err.error || "Email atau password salah",
        variant: "destructive"
      });
      throw err;
    }
  };

  const logout = async () => {
    hasLoginStarted.current = false;
    try {
      await logoutMutation.mutateAsync();
      queryClient.clear();
      setLocation("/login");
    } catch (err) {
      toast({ title: "Logout gagal", variant: "destructive" });
    }
  };

  return (
    <AuthContext.Provider value={{ user: user || null, isLoading: isUserLoading || (isFetching && hasLoginStarted.current), login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
