import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api, apiMessage } from "../api/client";
import type { User } from "../types";
import LoginPage from "../pages/LoginPage";

const menus: User["menus"] = [
  { menuCode: "DASH", menuName: "Dashboard", route: "/dashboard", icon: "dashboard", displayOrder: 1, canView: true },
  { menuCode: "MKT", menuName: "Marketing", route: "/marketing", icon: "marketing", displayOrder: 2, canView: true },
  { menuCode: "MST", menuName: "Masters", route: "/masters/customers", icon: "masters", displayOrder: 3, canView: true },
  { menuCode: "RPT", menuName: "Reports", route: "/reports", icon: "reports", displayOrder: 4, canView: true },
];

type Identity = {
  userCode?: string;
  employeeName?: string;
  role?: string;
  permissions?: string[];
};

function toUser(identity: Identity): User {
  return {
    empCode: String(identity.userCode || ""),
    empName: String(identity.employeeName || identity.userCode || ""),
    roleName: String(identity.role || ""),
    permissions: Array.isArray(identity.permissions) ? identity.permissions : [],
    menus,
  };
}

type AuthContextValue = {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");

  useEffect(() => {
    let current = true;
    api.get("/auth/me")
      .then((response) => {
        const identity = response.data?.data;
        if (!identity?.userCode || !identity?.role) {
          throw new Error("The login session returned an incomplete user profile.");
        }
        if (current) setUser(toUser(identity));
      })
      .catch((error) => {
        const status = error?.response?.status;
        if (current && status !== 401) setSessionError(apiMessage(error));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => { current = false; };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const response = await api.post("/auth/login", { username, password });
    const identity = response.data?.data;
    if (!identity?.userCode || !identity?.role) {
      throw new Error("The login response did not include a valid user profile.");
    }
    setSessionError("");
    setUser(toUser(identity));
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);

  if (loading) {
    return <main role="status" aria-live="polite" style={{ padding: 32 }}>Checking sign-in…</main>;
  }

  if (!user) {
    return <LoginPage onLogin={login} startupError={sessionError} />;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
