import type { ReactNode } from "react";
type Props = { eyebrow: string; title: string; subtitle?: string; actions?: ReactNode };
export default function PageHeader({ eyebrow, title, subtitle, actions }: Props) {
  return <section className="page-heading-row"><div><p className="page-eyebrow">{eyebrow}</p><h1>{title}</h1>{subtitle && <span>{subtitle}</span>}</div>{actions && <div className="page-header-actions">{actions}</div>}</section>;
}
