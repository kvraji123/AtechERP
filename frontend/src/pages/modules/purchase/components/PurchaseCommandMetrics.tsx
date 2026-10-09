import type { LucideIcon } from "lucide-react";

export type PurchaseCommandMetric = {
  label: string;
  value: number;
  detail: string;
  route: string;
  icon: LucideIcon;
  tone?: "danger" | "warning" | "success" | "purple";
};

type PurchaseCommandMetricsProps = {
  metrics: PurchaseCommandMetric[];
  onOpen: (route: string) => void;
};

export default function PurchaseCommandMetrics({ metrics, onOpen }: PurchaseCommandMetricsProps) {
  return (
    <section className="purchase-command-metrics" aria-label="Purchase workload summary">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <button
            type="button"
            key={metric.label}
            className={`purchase-command-metric ${metric.tone || ""}`}
            onClick={() => onOpen(metric.route)}
          >
            <span className="purchase-command-metric-icon"><Icon size={18} /></span>
            <span className="purchase-command-metric-copy">
              <small>{metric.label}</small>
              <span className="purchase-command-metric-value"><strong>{metric.value}</strong><em>{metric.detail}</em></span>
            </span>
          </button>
        );
      })}
    </section>
  );
}
