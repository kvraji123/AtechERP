import type { ReactNode } from "react";

type PurchaseFormSectionProps = {
  title: string;
  description: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
};

export default function PurchaseFormSection({
  title,
  description,
  icon,
  action,
  children,
}: PurchaseFormSectionProps) {
  return (
    <section className="purchase-form-section">
      <header className="purchase-section-header">
        <div className="purchase-section-heading">
          <span className="purchase-section-icon">{icon}</span>
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
