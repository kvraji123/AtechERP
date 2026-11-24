import { LogOut, PackageCheck, Send, Warehouse } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

const modules = [
  { to: "/gate-entry", label: "Gate Entry", icon: Warehouse },
  { to: "/grn-inward", label: "GRN Inward", icon: PackageCheck },
  { to: "/material-outward", label: "GRN Outward", icon: Send },
  { to: "/gate-exit", label: "Gate Exit", icon: LogOut },
];

export default function MaterialMovementTabs() {
  const { pathname } = useLocation();

  return (
    <nav className="purchase-module-tabs material-movement-tabs" aria-label="Material movement workflow">
      {modules.map((module) => {
        const Icon = module.icon;
        const active = pathname === module.to || pathname.startsWith(`${module.to}/`);
        return (
          <NavLink key={module.to} to={module.to} className={active ? "active" : "upcoming"}>
            <Icon size={14} />
            <span>{module.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
