import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";

interface AuthContextType {
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("adminToken"));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkToken = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await fetch("/api/stats", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) {
          throw new Error("Invalid token");
        }
      } catch (err) {
        console.error("Token verification failed:", err);
        setToken(null);
        localStorage.removeItem("adminToken");
        toast.error("Session expired. Please log in again.");
      } finally {
        setIsLoading(false);
      }
    };
    checkToken();
  }, [token]);

  const login = (newToken: string) => {
    setToken(newToken);
    localStorage.setItem("adminToken", newToken);
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem("adminToken");
    toast.success("Logged out successfully");
  };

  return (
    <AuthContext.Provider value={{ token, login, logout, isAuthenticated: !!token, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
