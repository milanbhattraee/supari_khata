import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between py-2 px-1 text-sm text-muted-foreground">
      <Button
        variant="ghost"
        size="sm"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="gap-1 rounded-xl"
      >
        <ChevronLeft className="h-4 w-4" />
        Prev
      </Button>
      <span>
        Page {currentPage} of {totalPages}
      </span>
      <Button
        variant="ghost"
        size="sm"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="gap-1 rounded-xl"
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}