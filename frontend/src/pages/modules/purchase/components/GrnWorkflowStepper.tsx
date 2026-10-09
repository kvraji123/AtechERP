import { ClipboardCheck, PackageCheck, ScanSearch } from "lucide-react";

type Props = { stage: "INWARD" | "INSPECTION" | "STOCK" };

export default function GrnWorkflowStepper({ stage }: Props) {
  const current = stage === "INWARD" ? 0 : stage === "INSPECTION" ? 1 : 2;
  const steps = [{ label: "GRN Inward", icon: ClipboardCheck }, { label: "Inspection", icon: ScanSearch }, { label: "Stock Receipt", icon: PackageCheck }];
  return <nav className="purchase-grn-stepper" aria-label="GRN workflow">{steps.map((step, index) => { const Icon = step.icon; const state = index < current ? "completed" : index === current ? "active" : "upcoming"; return <div key={step.label} className={state}><span><Icon size={16} /></span><strong>{step.label}</strong></div>; })}</nav>;
}
