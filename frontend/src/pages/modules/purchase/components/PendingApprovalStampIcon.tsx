import { forwardRef } from "react";
import type { LucideProps } from "lucide-react";

const PendingApprovalStampIcon = forwardRef<SVGSVGElement, LucideProps>(function PendingApprovalStampIcon(
  { size = 24, className = "", ...props },
  ref,
) {
  return (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      className={`pending-approval-stamp-icon ${className}`.trim()}
      {...props}
    >
      <g transform="rotate(-8 32 32)">
        <ellipse cx="32" cy="32" rx="29" ry="22" strokeWidth="2.5" />
        <ellipse cx="32" cy="32" rx="25.5" ry="18.5" strokeWidth="1.2" />
        <path d="M10 24.5h44M10 39.5h44" strokeWidth="1.5" />
        <text x="32" y="31" fill="currentColor" stroke="none" textAnchor="middle" fontSize="9" fontWeight="800" letterSpacing=".7">PENDING</text>
        <text x="32" y="38" fill="currentColor" stroke="none" textAnchor="middle" fontSize="7" fontWeight="800" letterSpacing=".55">APPROVAL</text>
      </g>
    </svg>
  );
});

export default PendingApprovalStampIcon;
