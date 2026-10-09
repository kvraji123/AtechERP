import { ArrowRight, CheckCircle2 } from "lucide-react";

export type PurchasePipelineStage = {
  id: string;
  label: string;
  detail: string;
  count: number;
  route: string;
};

type PurchasePipelineProps = {
  stages: PurchasePipelineStage[];
  onOpen: (route: string) => void;
};

export default function PurchasePipeline({ stages, onOpen }: PurchasePipelineProps) {
  return (
    <section className="purchase-command-panel purchase-command-pipeline">
      <header><div><h2>Purchase Pipeline</h2><p>Open records across the purchasing lifecycle</p></div><span>{stages.reduce((total, stage) => total + stage.count, 0)} active</span></header>
      <div className="purchase-command-pipeline-list">
        {stages.map((stage, index) => (
          <button type="button" key={stage.id} className="purchase-command-pipeline-stage" onClick={() => onOpen(stage.route)}>
            <span className="purchase-command-stage-marker"><CheckCircle2 size={15} /></span>
            <span><strong>{stage.label}</strong><small>{stage.detail}</small></span>
            <b>{stage.count}</b>
            <ArrowRight size={15} />
            {index < stages.length - 1 && <i aria-hidden="true" />}
          </button>
        ))}
      </div>
    </section>
  );
}
