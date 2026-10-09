import { BadgeCheck, ClipboardCheck, ClipboardPlus, FileSearch, PackageCheck, RadioTower, Scale, ShoppingBag, Warehouse } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

const steps = [
  { to: "/purchase/requests", label: "Purchase Request", icon: ClipboardPlus },
  { to: "/purchase/approvals", label: "PR Approval", icon: ClipboardCheck },
  { to: "/purchase/enquiries/new", label: "Create RFQ", icon: FileSearch },
  { to: "/purchase/rfqs", label: "RFQ Tracking", icon: RadioTower },
  { to: "/purchase/quotation-comparison", label: "Quote Comparison", icon: Scale },
  { to: "/purchase/orders", label: "Purchase Order", icon: ShoppingBag },
  { to: "/purchase/orders/approval", label: "PO Approval", icon: BadgeCheck },
  { to: "/purchase/gate-entries", label: "Gate Entry", icon: Warehouse },
  { to: "/purchase/grn", label: "GRN & Receipt", icon: PackageCheck },
];

type PurchaseModuleTabsProps = { activeIndex?: number };

export default function PurchaseModuleTabs({ activeIndex }: PurchaseModuleTabsProps = {}) {
  const { pathname } = useLocation();
  const routeIndex = steps.reduce((matchedIndex, step, index) => {
    const matched = pathname === step.to || pathname.startsWith(`${step.to}/`);
    if (!matched) return matchedIndex;
    return matchedIndex < 0 || step.to.length > steps[matchedIndex].to.length ? index : matchedIndex;
  }, -1);
  const currentIndex = activeIndex ?? routeIndex;
  return (
    <nav className="purchase-module-tabs" aria-label="Purchase workflow">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const state = index < currentIndex ? "completed" : index === currentIndex ? "active" : "upcoming";
        return <NavLink key={step.to} to={step.to} className={state}><Icon size={14} /><span>{step.label}</span></NavLink>;
      })}
    </nav>
  );
}
