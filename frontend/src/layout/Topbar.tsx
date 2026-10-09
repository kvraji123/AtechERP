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
  Menu,
  Package,
  PackagePlus,
  PackageOpen,
  Ruler,
  Search,
  Send,
  Settings2,
  ShieldAlert,
  ShoppingCart,
  Users,
  Gauge,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

import logo from "../assets/atech-logo.jpeg";
import { useAuth } from "../context/AuthContext";

type TopbarProps = {
  onMenuClick: () => void;
};

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { user } = useAuth();
  const location = useLocation();
  const inventoryMenuRef = useRef<HTMLDivElement>(null);
  const mastersMenuRef = useRef<HTMLDivElement>(null);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [mastersOpen, setMastersOpen] = useState(false);

  const marketingActive = location.pathname.startsWith("/marketing");
  const mastersActive = location.pathname.startsWith("/masters");
  const reportsActive = location.pathname.startsWith("/reports");
  const purchaseActive = location.pathname.startsWith("/purchase");
  const inventoryActive = location.pathname.startsWith("/inventory");

  useEffect(() => {
    setInventoryOpen(false);
    setMastersOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (inventoryMenuRef.current && !inventoryMenuRef.current.contains(target)) {
        setInventoryOpen(false);
      }
      if (mastersMenuRef.current && !mastersMenuRef.current.contains(target)) {
        setMastersOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <header className="app-topbar">
      <div className="topbar-brand">
        <img src={logo} alt="A Tech Automation" />
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
              <NavLink to="/inventory/return-to-customer" role="menuitem">
                <Send size={17} />
                <span>Return to Customer</span>
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
            <div className="topbar-dropdown" role="menu">
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
        <button
          type="button"
          className="topbar-profile"
          aria-label={`Signed in as ${user.empName}`}
        >
          <div className="topbar-avatar">{user.empName[0]}</div>
          <div className="topbar-profile-text">
            <strong>{user.empName}</strong>
            <span>{user.roleName}</span>
          </div>
          <ChevronDown size={17} />
        </button>
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
