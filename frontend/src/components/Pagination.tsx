import "./Pagination.css";
import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
  page: number;
  total: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
  disabled?: boolean;
};

export const PAGE_SIZE = 20;

export default function Pagination({
  page,
  total,
  pageSize = PAGE_SIZE,
  onPageChange,
  itemLabel = "records",
  disabled = false,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const first = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const last = Math.min(safePage * pageSize, total);

  return (
    <nav className="app-pagination" aria-label={`${itemLabel} pagination`}>
      <span className="app-pagination-summary" aria-live="polite">
        {total === 0
          ? `No ${itemLabel}`
          : `Showing ${first}–${last} of ${total} ${itemLabel}`}
      </span>
      <div className="app-pagination-controls">
        <span>
          Page {safePage} of {totalPages}
        </span>
        <button
          type="button"
          title="Previous page"
          aria-label="Previous page"
          onClick={() => onPageChange(safePage - 1)}
          disabled={disabled || safePage <= 1}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          title="Next page"
          aria-label="Next page"
          onClick={() => onPageChange(safePage + 1)}
          disabled={disabled || safePage >= totalPages}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </nav>
  );
}
