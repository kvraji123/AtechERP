import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

import type { User } from "../types";
import { Permissions } from "../utils/permissions";

const configuredPermissions = String(
  import.meta.env.VITE_USER_PERMISSIONS || ""
)
  .split(",")
  .map((permission) => permission.trim().toUpperCase())
  .filter(Boolean);

const user: User = {
  empCode: import.meta.env.VITE_USER_CODE || "EM7778",
  empName: "System Administrator",
  roleName: "Administrator",
  permissions:
    configuredPermissions.length > 0
      ? configuredPermissions
      : [Permissions.editEnquiryAllStages],
  menus: [
    {
      menuCode: "DASH",
      menuName: "Dashboard",
      route: "/dashboard",
      icon: "dashboard",
      displayOrder: 1,
      canView: true,
    },
    {
      menuCode: "MKT",
      menuName: "Marketing",
      route: "/marketing",
      icon: "marketing",
      displayOrder: 2,
      canView: true,
    },
    {
      menuCode: "MST",
      menuName: "Masters",
      route: "/masters/customers",
      icon: "masters",
      displayOrder: 3,
      canView: true,
    },
    {
      menuCode: "RPT",
      menuName: "Reports",
      route: "/reports",
      icon: "reports",
      displayOrder: 4,
      canView: true,
    },
  ],
};

const AuthContext = createContext({
  user,
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const value = useMemo(
    () => ({ user, logout: () => location.reload() }),
    []
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
