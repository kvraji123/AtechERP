import { X } from "lucide-react";
import type { ReactNode } from "react";
type Props = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  onClose?: () => void;
  closeDisabled?: boolean;
  closeLabel?: string;
};
export default function PageHeader({ eyebrow, title, subtitle, actions, onClose, closeDisabled = false, closeLabel = "Close form" }: Props) {
  return <section className="page-heading-row"><div><p className="page-eyebrow">{eyebrow}</p><h1>{title}</h1>{subtitle && <span>{subtitle}</span>}</div>{(actions || onClose) && <div className="page-header-actions">{actions}{onClose && <button type="button" className="page-header-close-button" aria-label={closeLabel} title={closeLabel} disabled={closeDisabled} onClick={onClose}><X size={18} /></button>}</div>}</section>;
}
