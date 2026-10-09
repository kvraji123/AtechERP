import "./StageTabs.css";

import { Check } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

export type MarketingStage =
  | "Enquiry"
  | "Feasibility"
  | "Workout"
  | "Quotation";

type StageTabsProps = {
  active: MarketingStage;
  enquiryId?: number;
  partId?: number;
  allowedStages?: MarketingStage[];
  completedStages?: MarketingStage[];
};

const stages: MarketingStage[] = [
  "Enquiry",
  "Feasibility",
  "Workout",
  "Quotation",
];

export default function StageTabs({
  active,
  enquiryId,
  partId,
  allowedStages,
  completedStages,
}: StageTabsProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedMode = searchParams.get("mode");
  const modeSuffix =
    requestedMode === "edit" || requestedMode === "view"
      ? `?mode=${requestedMode}`
      : "";

  const activeIndex = stages.indexOf(active);

  const isDisabled = (stage: MarketingStage) => {
    if (allowedStages && !allowedStages.includes(stage)) {
      return true;
    }
    if (stage === "Enquiry") {
      return !enquiryId && active !== "Enquiry";
    }

    if (stage === "Feasibility") {
      return !partId;
    }

    if (stage === "Workout") {
      return !partId;
    }

    if (stage === "Quotation") {
      return !enquiryId;
    }

    return true;
  };

  const navigateToStage = (stage: MarketingStage) => {
    if (isDisabled(stage) || stage === active) {
      return;
    }

    if (stage === "Enquiry" && enquiryId) {
      navigate(`/marketing/enquiries/${enquiryId}${modeSuffix}`);
      return;
    }

    if (stage === "Feasibility" && partId) {
      navigate(
        `/marketing/enquiry-parts/${partId}/feasibility${modeSuffix}`
      );
      return;
    }

    if (stage === "Workout" && partId) {
      navigate(
        `/marketing/enquiry-parts/${partId}/workout${modeSuffix}`
      );
      return;
    }

    if (stage === "Quotation" && enquiryId) {
      navigate(
        `/marketing/enquiries/${enquiryId}/quotation${modeSuffix}`
      );
    }
  };

  return (
    <nav
      className="marketing-stage-tabs"
      aria-label="Marketing workflow stages"
    >
      {stages.map((stage, index) => {
        const activeStage = stage === active;
        const completed = completedStages
          ? completedStages.includes(stage)
          : index < activeIndex;

        const disabled =
          isDisabled(stage);

        return (
          <button
            key={stage}
            type="button"
            className={[
              "marketing-stage-tab",
              activeStage ? "active" : "",
              completed ? "completed" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            disabled={disabled}
            aria-current={
              activeStage ? "step" : undefined
            }
            onClick={() =>
              navigateToStage(stage)
            }
          >
            {completed && (
              <Check
                className="marketing-stage-check"
                size={15}
                strokeWidth={3}
              />
            )}

            <span>{stage}</span>
          </button>
        );
      })}
    </nav>
  );
}
