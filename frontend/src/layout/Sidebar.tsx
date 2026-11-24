import "./Sidebar.css";

import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import {
  BarChart3,
  Boxes,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Cog,
  Database,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Package,
  PackagePlus,
  Ruler,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  FileCheck2,
  Users,
  X,
  Gauge,
} from "lucide-react";

import logo from "../assets/atech-logo.jpeg";
import { useAuth } from "../context/AuthContext";

type SidebarProps = {
  mobileOpen: boolean;
  onClose: () => void;
};

type MenuItem = {
  menuCode: string;
  menuName: string;
  route: string;
  icon?: string;
  canView: boolean;
};

const normalize = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const isDashboardMenu = (menu: MenuItem): boolean => {
  const code = normalize(menu.menuCode);
  const name = normalize(menu.menuName);
  const route = normalize(menu.route);

  return (
    code === "dashboard" ||
    name === "dashboard" ||
    route === "/dashboard"
  );
};

const isMarketingMenu = (menu: MenuItem): boolean => {
  const code = normalize(menu.menuCode);
  const name = normalize(menu.menuName);
  const route = normalize(menu.route);
  const icon = normalize(menu.icon);

  return (
    code === "marketing" ||
    name === "marketing" ||
    icon === "marketing" ||
    route.startsWith("/marketing")
  );
};

const isMastersMenu = (menu: MenuItem): boolean => {
  const code = normalize(menu.menuCode);
  const name = normalize(menu.menuName);
  const route = normalize(menu.route);
  const icon = normalize(menu.icon);

  return (
    code === "masters" ||
    name === "masters" ||
    icon === "masters" ||
    route.startsWith("/masters")
  );
};

const isReportsMenu = (menu: MenuItem): boolean => {
  const code = normalize(menu.menuCode);
  const name = normalize(menu.menuName);
  const route = normalize(menu.route);
  const icon = normalize(menu.icon);

  return (
    code === "reports" ||
    name === "reports" ||
    icon === "reports" ||
    route.startsWith("/reports")
  );
};

export default function Sidebar({
  mobileOpen,
  onClose,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const mastersRouteActive =
    location.pathname.startsWith("/masters");

  const marketingRouteActive =
    location.pathname.startsWith("/marketing");

  const reportsRouteActive =
    location.pathname.startsWith("/reports");

  const purchaseRouteActive =
    location.pathname.startsWith("/purchase");

  const inventoryRouteActive =
    location.pathname.startsWith("/inventory");

  const salesRouteActive =
    location.pathname.startsWith("/sales");
  const gaugeMasterRouteActive = location.pathname === "/masters/gauges"
    || location.pathname === "/masters/gauges/register"
    || /^\/masters\/gauges\/\d+/.test(location.pathname);

  const [mastersOpen, setMastersOpen] = useState(
    mastersRouteActive
  );

  useEffect(() => {
    if (mastersRouteActive) {
      setMastersOpen(true);
    }
  }, [mastersRouteActive]);

  const visibleMenus = useMemo<MenuItem[]>(() => {
    const menus = Array.isArray(user?.menus)
      ? user.menus
      : [];

    return menus.filter(
      (menu: MenuItem) => menu.canView
    );
  }, [user?.menus]);

  const dashboardMenu = visibleMenus.find(isDashboardMenu);
  const marketingMenu = visibleMenus.find(isMarketingMenu);
  const mastersMenu = visibleMenus.find(isMastersMenu);
  const reportsMenu = visibleMenus.find(isReportsMenu);

  const employeeName =
    String(user?.empName ?? "System Administrator").trim() ||
    "System Administrator";

  const roleName =
    String(user?.roleName ?? "Administrator").trim() ||
    "Administrator";

  const employeeInitial =
    employeeName.charAt(0).toUpperCase() || "S";

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close sidebar"
          onClick={onClose}
        />
      )}

      <aside
        className={`app-sidebar ${
          mobileOpen ? "mobile-open" : ""
        }`}
      >
        <div className="sidebar-brand">
          <img
            src={logo}
            alt="A Tech Automation"
            className="sidebar-company-logo"
          />

          <button
            type="button"
            className="sidebar-mobile-close"
            aria-label="Close menu"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        

        <nav className="sidebar-navigation">
          <NavLink
            to={dashboardMenu?.route || "/dashboard"}
            onClick={onClose}
            className={({ isActive }) =>
              `sidebar-link ${
                isActive ? "active" : ""
              }`
            }
          >
            <span className="sidebar-link-icon">
              <LayoutDashboard size={18} />
            </span>

            <span className="sidebar-link-text">
              {dashboardMenu?.menuName || "Dashboard"}
            </span>
          </NavLink>

          <NavLink
            to="/marketing/enquiries"
            onClick={onClose}
            className={`sidebar-link ${
              marketingRouteActive ? "active" : ""
            }`}
          >
            <span className="sidebar-link-icon">
              <Megaphone size={18} />
            </span>

            <span className="sidebar-link-text">
              {marketingMenu?.menuName || "Marketing"}
            </span>
          </NavLink>

          <NavLink
            to="/purchase"
            onClick={onClose}
            className={`sidebar-link ${purchaseRouteActive ? "active" : ""}`}
          >
            <span className="sidebar-link-icon">
              <ShoppingCart size={18} />
            </span>
            <span className="sidebar-link-text">Purchase</span>
          </NavLink>

          <NavLink
            to="/sales/customer-pos"
            onClick={onClose}
            className={`sidebar-link ${salesRouteActive ? "active" : ""}`}
          >
            <span className="sidebar-link-icon">
              <FileCheck2 size={18} />
            </span>
            <span className="sidebar-link-text">Sales</span>
          </NavLink>

          <NavLink
            to="/inventory"
            onClick={onClose}
            className={`sidebar-link ${inventoryRouteActive ? "active" : ""}`}
          >
            <span className="sidebar-link-icon">
              <Boxes size={18} />
            </span>
            <span className="sidebar-link-text">Inventory</span>
          </NavLink>

          <div className="sidebar-menu-group">
            <button
              type="button"
              className={`sidebar-link sidebar-parent-link ${
                mastersRouteActive
                  ? "active-parent"
                  : ""
              }`}
              onClick={() =>
                setMastersOpen(
                  (current) => !current
                )
              }
            >
              <span className="sidebar-link-icon">
                <Database size={18} />
              </span>

              <span className="sidebar-link-text">
                {mastersMenu?.menuName || "Masters"}
              </span>

              <span className="sidebar-expand-icon">
                {mastersOpen ? (
                  <ChevronDown size={17} />
                ) : (
                  <ChevronRight size={17} />
                )}
              </span>
            </button>

            {mastersOpen && (
              <div className="sidebar-submenu">
                <NavLink
                  to="/masters/customers/new"
                  onClick={onClose}
                  className={() =>
                    `sidebar-submenu-link ${
                      location.pathname.startsWith(
                        "/masters/customers"
                      )
                        ? "active"
                        : ""
                    }`
                  }
                >
                  <Users size={16} />
                  <span>Customer Master</span>
                </NavLink>
<NavLink
                  to="/masters/suppliers/new"
                  onClick={onClose}
                  className={() =>
                    `sidebar-submenu-link ${
                      location.pathname.startsWith(
                        "/masters/suppliers"
                      )
                        ? "active"
                        : ""
                    }`
                  }
                >
                  <Users size={16} />
                  <span>Supplier Master</span>
                </NavLink>

                <NavLink
                  to="/masters/parts/new"
                  onClick={onClose}
                  className={() =>
                    `sidebar-submenu-link ${
                      location.pathname.startsWith(
                        "/masters/parts"
                      )
                        ? "active"
                        : ""
                    }`
                  }
                >
                  <Package size={16} />
                  <span>Part Master</span>
                </NavLink>

                <NavLink
                  to="/masters/items/new"
                  onClick={onClose}
                  className={() =>
                    `sidebar-submenu-link ${
                      location.pathname.startsWith("/masters/items")
                        ? "active"
                        : ""
                    }`
                  }
                >
                  <PackagePlus size={16} />
                  <span>Item Master</span>
                </NavLink>

                <NavLink
                  to="/masters/machines/new"
                  onClick={onClose}
                  className={() =>
                    `sidebar-submenu-link ${
                      location.pathname.startsWith("/masters/machines")
                        ? "active"
                        : ""
                    }`
                  }
                >
                  <Cog size={16} />
                  <span>Machine Master</span>
                </NavLink>

                <NavLink to="/masters/operations" onClick={onClose}
                  className={() => `sidebar-submenu-link ${location.pathname.startsWith("/masters/operations") ? "active" : ""}`}>
                  <Settings2 size={16} /><span>Operation Name Master</span>
                </NavLink>

                <NavLink to="/masters/tolerance-grades" onClick={onClose}
                  className={() => `sidebar-submenu-link ${location.pathname.startsWith("/masters/tolerance-grades") ? "active" : ""}`}>
                  <Ruler size={16} /><span>Tolerance Grade Master</span>
                </NavLink>

                <NavLink to="/masters/instruments" onClick={onClose}
                  className={() => `sidebar-submenu-link ${location.pathname.startsWith("/masters/instruments") ? "active" : ""}`}>
                  <Gauge size={16} /><span>Instrument Master</span>
                </NavLink>
                <NavLink to="/masters/gauges" onClick={onClose}
                  className={() => `sidebar-submenu-link ${gaugeMasterRouteActive ? "active" : ""}`}>
                  <Gauge size={16} /><span>Gauge Master</span>
                </NavLink>
                <NavLink to="/masters/gauges/workflow" onClick={onClose}
                  className={() => `sidebar-submenu-link ${location.pathname === "/masters/gauges/workflow" ? "active" : ""}`}>
                  <ClipboardList size={16} /><span>Calibration Workflow</span>
                </NavLink>
              </div>
            )}
          </div>

          <NavLink
            to={reportsMenu?.route || "/reports"}
            onClick={onClose}
            className={`sidebar-link ${
              reportsRouteActive ? "active" : ""
            }`}
          >
            <span className="sidebar-link-icon">
              <BarChart3 size={18} />
            </span>

            <span className="sidebar-link-text">
              {reportsMenu?.menuName || "Reports"}
            </span>
          </NavLink>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-message">
            <ShieldCheck size={25} />

            <div>
              <strong>Excellence Through</strong>
              <span>Automation</span>
            </div>
          </div>

          <div className="sidebar-user-area">
            <div className="sidebar-user-avatar">
              {employeeInitial}
            </div>

            <div className="sidebar-user-details">
              <strong>{employeeName}</strong>
              <span>{roleName}</span>
            </div>

            <button
              type="button"
              className="sidebar-logout"
              aria-label="Logout"
              title="Logout"
              onClick={logout}
            >
              <LogOut size={17} />
            </button>
          </div>

          <p className="sidebar-copyright">
            © 2026 A Tech Automation Pvt. Ltd.
          </p>
        </div>
      </aside>
    </>
  );
}
