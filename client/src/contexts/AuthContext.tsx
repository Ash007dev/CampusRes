"use client";

import * as React from "react";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";

// Types
export interface User {
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "FACULTY" | "ADMIN" | "LAB_ADMIN";
  departmentId?: string;
  departmentName?: string;
  reputationScore: number;
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  updateUser: (data: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  role: "STUDENT" | "FACULTY";
  departmentId?: string;
}

// Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const router = useRouter();

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("accessToken");
      const storedUser = localStorage.getItem("user");

      console.log("[Auth] Checking auth, token exists:", !!token);

      if (token && storedUser) {
        // Load stored user immediately so UI shows correct name right away
        try {
          const parsedUser = JSON.parse(storedUser);
          console.log("[Auth] Loaded stored user:", parsedUser?.name);
          if (parsedUser && parsedUser.name) {
            setUser(parsedUser);
          }
        } catch {
          // Invalid stored user, will be cleared below
        }

        try {
          // Verify token is still valid and refresh user data
          console.log("[Auth] Fetching /auth/me...");
          const response = await authApi.getMe();
          const apiUser = response.data.data;
          console.log("[Auth] Got user from API:", apiUser);
          // Map API user to context User type
          const userData: User = {
            id: apiUser.id,
            name: `${apiUser.firstName} ${apiUser.lastName}`,
            email: apiUser.email,
            role: apiUser.role,
            departmentId: apiUser.departmentId,
            reputationScore: apiUser.reputationScore,
          };
          setUser(userData);
          localStorage.setItem("user", JSON.stringify(userData));
          console.log("[Auth] Updated user to:", userData.name);
        } catch (error) {
          // Token invalid, clear storage
          console.error("[Auth] Failed to fetch /auth/me:", error);
          localStorage.removeItem("accessToken");
          localStorage.removeItem("user");
          document.cookie = 'accessToken=; path=/; max-age=0';
          setUser(null);
        }
      }

      setIsLoading(false);
      setIsInitialized(true);
    };

    checkAuth();
  }, []);

  // Login
  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);

    try {
      const response = await authApi.login(email, password);
      console.log("[Auth] Login response:", response.data);
      const apiUser = response.data.data.user;
      const token = response.data.data.tokens.accessToken;

      // Set cookie FIRST (for middleware SSR checks)
      document.cookie = `accessToken=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
      localStorage.setItem("accessToken", token);

      console.log("[Auth] API User from login:", apiUser);
      // Map API user to context User type
      const userData: User = {
        id: apiUser.id,
        name: `${apiUser.firstName} ${apiUser.lastName}`,
        email: apiUser.email,
        role: apiUser.role,
        departmentId: apiUser.departmentId,
        reputationScore: apiUser.reputationScore || 0,
      };
      console.log("[Auth] Mapped user data:", userData);
      localStorage.setItem("user", JSON.stringify(userData));

      setUser(userData);

      // Use window.location.replace for a clean navigation that ensures 
      // the browser reads the newly set cookie for the middleware
      window.location.replace("/dashboard");
    } catch (error) {
      setIsLoading(false);
      throw error;
    }
    // Note: Don't set isLoading to false here since we're navigating away
  }, []);

  // Register
  const register = useCallback(async (data: RegisterData) => {
    setIsLoading(true);

    try {
      await authApi.register({ firstName: data.name, lastName: data.name, email: data.email, password: data.password, departmentId: data.departmentId || '' });
      router.push("/auth/login?registered=true");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  // Logout
  const logout = useCallback(() => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    // Clear cookie
    document.cookie = 'accessToken=; path=/; max-age=0; SameSite=Lax';
    setUser(null);
    router.push("/");
  }, [router]);

  // Update user
  const updateUser = useCallback(async (data: Partial<User>) => {
    if (!user) return;

    // TODO: Implement updateProfile in authApi
    const updatedUser = { ...user, ...data };
    setUser(updatedUser);
    localStorage.setItem("user", JSON.stringify(updatedUser));
  }, [user]);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    try {
      const response = await authApi.getMe();
      const apiUser = response.data.data;
      // Map API user to context User type
      const userData: User = {
        id: apiUser.id,
        name: `${apiUser.firstName} ${apiUser.lastName}`,
        email: apiUser.email,
        role: apiUser.role,
        departmentId: apiUser.departmentId,
        reputationScore: apiUser.reputationScore,
      };
      setUser(userData);
      localStorage.setItem("user", JSON.stringify(userData));
    } catch {
      logout();
    }
  }, [logout]);

  const value: AuthContextType = {
    user,
    isLoading,
    isInitialized,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    updateUser,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Protected Route HOC
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  options: { redirectTo?: string; allowedRoles?: string[] } = {}
) {
  const { redirectTo = "/auth/login", allowedRoles } = options;

  return function ProtectedRoute(props: P) {
    const { user, isLoading, isAuthenticated } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!isLoading && !isAuthenticated) {
        router.push(redirectTo);
      }

      if (!isLoading && isAuthenticated && allowedRoles) {
        if (user && !allowedRoles.includes(user.role)) {
          router.push("/unauthorized");
        }
      }
    }, [isLoading, isAuthenticated, user, router]);

    if (isLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      );
    }

    if (!isAuthenticated) {
      return null;
    }

    return <Component {...props} />;
  };
}
