import { forwardRef } from "react";
import type { LucideProps } from "lucide-react";

const HighPriorityStampIcon = forwardRef<SVGSVGElement, LucideProps>(function HighPriorityStampIcon(
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
      className={`high-priority-stamp-icon ${className}`.trim()}
      {...props}
    >
      <circle cx="32" cy="32" r="29" strokeWidth="2.5" />
      <circle cx="32" cy="32" r="25" strokeWidth="1.2" />
      <g fill="currentColor" stroke="none">
        <path d="m32 7 1.2 3.1 3.3.2-2.5 2.1.8 3.2-2.8-1.8-2.8 1.8.8-3.2-2.5-2.1 3.3-.2L32 7Zm-23 25 3.1-1.2.2-3.3 2.1 2.5 3.2-.8-1.8 2.8 1.8 2.8-3.2-.8-2.1 2.5-.2-3.3L9 32Zm46 0-3.1-1.2-.2-3.3-2.1 2.5-3.2-.8 1.8 2.8-1.8 2.8 3.2-.8 2.1 2.5.2-3.3L55 32ZM32 49l-1.2-3.1-3.3-.2 2.5-2.1-.8-3.2 2.8 1.8 2.8-1.8-.8 3.2 2.5 2.1-3.3.2L32 49Z" />
        <path d="M28 18h8l-1.6 19h-4.8L28 18Zm0 23h8v7h-8v-7Z" />
      </g>
    </svg>
  );
});

export default HighPriorityStampIcon;
