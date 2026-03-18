"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Factory, ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { ListSkeleton } from "@/components/skeletons";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { useProductionEntries } from "@/app/features/production/hooks/useProduction";
import { formatNumber, toNepaliDate } from "@/lib/format";

export default function ProductionPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useProductionEntries({ page: String(page) });

  return (
    <>
      <PageHeader
        title="Production"
        subtitle="Processing entries"
        action={
          <Link href="/production/create">
            <Button size="icon" className="h-9 w-9 rounded-full">
              <Plus className="h-4 w-4" />
            </Button>
          </Link>
        }
      />

      {isLoading && <ListSkeleton />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}

      {data && data.data.length === 0 && (
        <EmptyState
          icon={<Factory className="h-7 w-7" />}
          title="No production entries"
          description="Record when you process raw betel nuts"
          action={
            <Link href="/production/create">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                New Entry
              </Button>
            </Link>
          }
        />
      )}

      {data && data.data.length > 0 && (
        <div className="px-4 pb-4 pt-3">
          <div className="glass-card rounded-2xl overflow-hidden">
            {data.data.map((entry, i) => (
              <Link key={entry._id} href={`/production/${entry._id}`}>
                <div
                  className="flex items-center gap-3 px-4 py-3 active:bg-foreground/5 transition-colors"
                  style={
                    i < data.data.length - 1
                      ? { borderBottom: "0.5px solid oklch(0 0 0 / 6%)" }
                      : undefined
                  }
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/10">
                    <Factory className="h-[18px] w-[18px] text-orange-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-[15px] font-medium">
                      <span className="truncate">{entry.inputProduct.name}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{entry.outputProduct.name}</span>
                    </div>
                    <p className="text-[13px] text-muted-foreground">
                      {formatNumber(entry.inputQuantity, 1)} {entry.inputProduct.unit}{" "}
                      &rarr; {formatNumber(entry.outputQuantity, 1)} {entry.outputProduct.unit}{" "}
                      &middot; Loss: {formatNumber(entry.yieldLoss, 1)} kg
                      &middot; {toNepaliDate(entry.date)}
                    </p>
                  </div>
                  <ChevronRight className="h-[18px] w-[18px] text-foreground/20 shrink-0" />
                </div>
              </Link>
            ))}
          </div>

          <PaginationControls
            currentPage={data.meta.page}
            totalPages={data.meta.totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </>
  );
}
