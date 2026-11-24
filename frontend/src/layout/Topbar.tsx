import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CircleX,
  ClipboardList,
  ChevronDown,
  Cog,
  Database,
  Boxes,
  Factory,
  LayoutDashboard,
  MapPin,
  Menu,
  Package,
  PackagePlus,
  PackageOpen,
  PackageCheck,
  Ruler,
  Search,
  Send,
  Settings2,
  ShieldAlert,
  ShoppingCart,
  Users,
  Warehouse,
  Gauge,
  Wrench,
  LogOut,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

import CompanyMark from "../components/CompanyMark";
import { useAuth } from "../context/AuthContext";

type TopbarProps = {
  onMenuClick: () => void;
};

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const grnMenuRef = useRef<HTMLDivElement>(null);
  const inventoryMenuRef = useRef<HTMLDivElement>(null);
  const toolingMenuRef = useRef<HTMLDivElement>(null);
  const mastersMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [grnOpen, setGrnOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [toolingOpen, setToolingOpen] = useState(false);
  const [mastersOpen, setMastersOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const marketingActive = location.pathname.startsWith("/marketing");
  const mastersActive = location.pathname.startsWith("/masters");
  const reportsActive = location.pathname.startsWith("/reports");
  const purchaseActive = location.pathname.startsWith("/purchase");
  const grnActive = location.pathname.startsWith("/gate-entry")
    || location.pathname.startsWith("/grn-inward")
    || location.pathname.startsWith("/material-outward")
    || location.pathname.startsWith("/gate-exit");
  const inventoryActive = location.pathname.startsWith("/inventory");
  const toolingActive = location.pathname.startsWith("/tooling");
  const operationsActive = location.pathname.startsWith("/operations");

  useEffect(() => {
    setGrnOpen(false);
    setInventoryOpen(false);
    setToolingOpen(false);
    setMastersOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (grnMenuRef.current && !grnMenuRef.current.contains(target)) {
        setGrnOpen(false);
      }
      if (inventoryMenuRef.current && !inventoryMenuRef.current.contains(target)) {
        setInventoryOpen(false);
      }
      if (toolingMenuRef.current && !toolingMenuRef.current.contains(target)) {
        setToolingOpen(false);
      }
      if (mastersMenuRef.current && !mastersMenuRef.current.contains(target)) {
        setMastersOpen(false);
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  if (!user) return null;

  const avatarInitial = user.empName.trim().charAt(0).toUpperCase() || "U";

  return (
    <header className="app-topbar">
      <div className="topbar-brand">
        <CompanyMark className="topbar-company-mark" />
      </div>

      <button
        type="button"
        className="mobile-menu-button"
        aria-label="Open navigation menu"
        onClick={onMenuClick}
      >
        <Menu size={22} />
      </button>

      <nav className="topbar-navigation" aria-label="Main navigation">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `topbar-nav-link ${isActive ? "active" : ""}`
          }
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/marketing/enquiries"
          className={`topbar-nav-link ${marketingActive ? "active" : ""}`}
        >
          <MegaphoneIcon />
          <span>Marketing</span>
        </NavLink>

        <NavLink
          to="/purchase"
          className={`topbar-nav-link ${purchaseActive ? "active" : ""}`}
        >
          <ShoppingCart size={18} />
          <span>Purchase</span>
        </NavLink>

        <div className="topbar-menu-group" ref={grnMenuRef}>
          <button
            type="button"
            className={`topbar-nav-link topbar-menu-trigger ${grnActive ? "active" : ""}`}
            aria-expanded={grnOpen}
            aria-haspopup="menu"
            onClick={() => {
              setGrnOpen((current) => !current);
              setInventoryOpen(false);
              setToolingOpen(false);
              setMastersOpen(false);
            }}
          >
            <Warehouse size={18} />
            <span>GRN</span>
            <ChevronDown size={16} className={grnOpen ? "expanded" : ""} />
          </button>

          {grnOpen && (
            <div className="topbar-dropdown topbar-grn-dropdown" role="menu">
              <NavLink to="/gate-entry" role="menuitem">
                <Warehouse size={17} />
                <span>Gate Entry</span>
              </NavLink>
              <NavLink to="/grn-inward" role="menuitem">
                <PackageCheck size={17} />
                <span>GRN Inward</span>
              </NavLink>
              <NavLink to="/material-outward" role="menuitem">
                <Send size={17} />
                <span>GRN Outward</span>
              </NavLink>
              <NavLink to="/gate-exit" role="menuitem">
                <LogOut size={17} />
                <span>Gate Exit</span>
              </NavLink>
            </div>
          )}
        </div>

        <div className="topbar-menu-group" ref={inventoryMenuRef}>
          <button
            type="button"
            className={`topbar-nav-link topbar-menu-trigger ${
              inventoryActive ? "active" : ""
            }`}
            aria-expanded={inventoryOpen}
            aria-haspopup="menu"
            onClick={() => {
              setInventoryOpen((current) => !current);
              setToolingOpen(false);
              setMastersOpen(false);
            }}
          >
            <Boxes size={18} />
            <span>Inventory</span>
            <ChevronDown size={16} className={inventoryOpen ? "expanded" : ""} />
          </button>

          {inventoryOpen && (
            <div className="topbar-dropdown topbar-inventory-dropdown" role="menu">
              <NavLink to="/inventory" end role="menuitem">
                <Boxes size={17} />
                <span>Inventory Dashboard</span>
              </NavLink>
              <NavLink to="/inventory/stock" role="menuitem">
                <Package size={17} />
                <span>Available Stock</span>
              </NavLink>
              <NavLink to="/inventory/quality-hold" role="menuitem">
                <ShieldAlert size={17} />
                <span>Quality Hold</span>
              </NavLink>
              <NavLink to="/inventory/rejection-inventory" role="menuitem">
                <CircleX size={17} />
                <span>Rejection Inventory</span>
              </NavLink>
              <NavLink to="/inventory/outsourcing-wip" role="menuitem">
                <Factory size={17} />
                <span>Outsourcing WIP</span>
              </NavLink>
              <NavLink to="/inventory/customer-material" role="menuitem">
                <PackageOpen size={17} />
                <span>Customer Material</span>
              </NavLink>
              <NavLink to="/inventory/transactions" role="menuitem">
                <ClipboardList size={17} />
                <span>Stock Transactions</span>
              </NavLink>
              <NavLink to="/inventory/reorder-alerts" role="menuitem">
                <AlertTriangle size={17} />
                <span>Reorder Alerts</span>
              </NavLink>
            </div>
          )}
        </div>

        <div className="topbar-menu-group" ref={toolingMenuRef}>
          <button
            type="button"
            className={`topbar-nav-link topbar-menu-trigger ${toolingActive ? "active" : ""}`}
            aria-expanded={toolingOpen}
            aria-haspopup="menu"
            onClick={() => {
              setToolingOpen((current) => !current);
              setGrnOpen(false);
              setInventoryOpen(false);
              setMastersOpen(false);
            }}
          >
            <Wrench size={18} />
            <span>Tooling</span>
            <ChevronDown size={16} className={toolingOpen ? "expanded" : ""} />
          </button>

          {toolingOpen && (
            <div className="topbar-dropdown" role="menu">
              <NavLink to="/tooling" end role="menuitem">
                <Wrench size={17} />
                <span>Tool Lifecycle</span>
              </NavLink>
            </div>
          )}
        </div>

        <NavLink
          to="/operations/work-order-inspection"
          className={`topbar-nav-link ${operationsActive ? "active" : ""}`}
        >
          <Factory size={18} />
          <span>Operations</span>
        </NavLink>

        <div className="topbar-menu-group" ref={mastersMenuRef}>
          <button
            type="button"
            className={`topbar-nav-link topbar-menu-trigger ${
              mastersActive ? "active" : ""
            }`}
            aria-expanded={mastersOpen}
            aria-haspopup="menu"
            onClick={() => {
              setMastersOpen((current) => !current);
              setInventoryOpen(false);
              setToolingOpen(false);
            }}
          >
            <Database size={18} />
            <span>Masters</span>
            <ChevronDown
              size={16}
              className={mastersOpen ? "expanded" : ""}
            />
          </button>

          {mastersOpen && (
            <div className="topbar-dropdown topbar-masters-dropdown" role="menu">
              <NavLink to="/masters/customers" role="menuitem">
                <Users size={17} />
                <span>Customer Master</span>
              </NavLink>
              <NavLink to="/masters/suppliers" role="menuitem">
                <Users size={17} />
                <span>Supplier Master</span>
              </NavLink>
              <NavLink to="/masters/parts" role="menuitem">
                <Package size={17} />
                <span>Part Master</span>
              </NavLink>
              <NavLink to="/masters/items" role="menuitem">
                <PackagePlus size={17} />
                <span>Item Master</span>
              </NavLink>
              <NavLink to="/masters/tools" role="menuitem">
                <Wrench size={17} />
                <span>Tool Master</span>
              </NavLink>
              <NavLink to="/masters/locations" role="menuitem">
                <MapPin size={17} />
                <span>Location Master</span>
              </NavLink>
              <NavLink to="/masters/machines" role="menuitem">
                <Cog size={17} />
                <span>Machine Master</span>
              </NavLink>
              <NavLink to="/masters/operations" role="menuitem">
                <Settings2 size={17} />
                <span>Operation Name Master</span>
              </NavLink>
              <NavLink to="/masters/tolerance-grades" role="menuitem">
                <Ruler size={17} />
                <span>Tolerance Grade Master</span>
              </NavLink>
              <NavLink to="/masters/instruments" role="menuitem">
                <Gauge size={17} />
                <span>Instrument Master</span>
              </NavLink>
              <NavLink to="/masters/gauges" role="menuitem">
                <Gauge size={17} />
                <span>Gauge Master</span>
              </NavLink>
              <NavLink to="/masters/gauges/workflow" role="menuitem">
                <ClipboardList size={17} />
                <span>Calibration Workflow</span>
              </NavLink>
            </div>
          )}
        </div>

        <NavLink
          to="/reports"
          className={`topbar-nav-link ${reportsActive ? "active" : ""}`}
        >
          <BarChart3 size={18} />
          <span>Reports</span>
        </NavLink>
      </nav>

      <div className="topbar-spacer" />

      <div className="topbar-search">
        <Search size={18} />
        <input aria-label="Search anything" placeholder="Search anything..." />
        <span className="search-shortcut">Ctrl + K</span>
      </div>

      <div className="topbar-actions">
        <div className="topbar-profile-menu" ref={profileMenuRef}>
          <button
            type="button"
            className="topbar-profile"
            aria-label={`Open account menu for ${user.empName}`}
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            onClick={() => {
              setProfileOpen((current) => !current);
              setGrnOpen(false);
              setInventoryOpen(false);
              setToolingOpen(false);
              setMastersOpen(false);
            }}
          >
            <div className="topbar-avatar">{avatarInitial}</div>
            <div className="topbar-profile-text">
              <strong>{user.empName}</strong>
              <span>{user.roleName}</span>
            </div>
            <ChevronDown
              size={18}
              strokeWidth={2.75}
              className={`topbar-profile-chevron ${profileOpen ? "expanded" : ""}`}
            />
          </button>

          {profileOpen && (
            <div className="topbar-account-dropdown" role="menu">
              <div className="topbar-account-summary">
                <div className="topbar-avatar">{avatarInitial}</div>
                <div>
                  <strong>{user.empName}</strong>
                  <span>{user.roleName}</span>
                </div>
              </div>

              {String(user.roleName).trim().toUpperCase() === "ADMINISTRATOR" && (
                <NavLink
                  to="/admin/users"
                  className="topbar-account-menu-item"
                  role="menuitem"
                  onClick={() => setProfileOpen(false)}
                >
                  <Users size={17} />
                  <span>User accounts</span>
                </NavLink>
              )}

              <div className="topbar-account-divider" />
              <button
                type="button"
                className="topbar-account-menu-item logout"
                role="menuitem"
                onClick={() => {
                  setProfileOpen(false);
                  void logout();
                }}
              >
                <LogOut size={17} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function MegaphoneIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3 11 18-5v12L3 14v-3Z" />
      <path d="M11.6 16.7 13 21H8l-1.2-5.4" />
    </svg>
  );
}
