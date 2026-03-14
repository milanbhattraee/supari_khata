"use client";

import { use } from "react";
import { ArrowRight, Factory } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DetailSkeleton } from "@/components/skeletons";
import { ErrorState } from "@/components/empty-state";
import { useProductionEntry } from "@/app/features/production/hooks/useProduction";
import { formatNumber, toNepaliDate } from "@/lib/format";

export default function ProductionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: entry, isLoading, error, refetch } = useProductionEntry(id);

  if (isLoading) return <DetailSkeleton />;
  if (error)
    return <ErrorState message={error.message} onRetry={() => refetch()} />;
  if (!entry) return null;

  return (
    <>
      <PageHeader title="Production Detail" back />

      <div className="space-y-4 p-4">
        <div className="glass-card rounded-2xl p-5 text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10">
            <Factory className="h-7 w-7 text-orange-600" />
          </div>
          <div className="flex items-center justify-center gap-4 text-[15px]">
            <div>
              <p className="font-semibold">{entry.inputProduct.name}</p>
              <p className="text-[13px] text-muted-foreground">
                {formatNumber(entry.inputQuantity, 1)} {entry.inputProduct.unit}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-semibold">{entry.outputProduct.name}</p>
              <p className="text-[13px] text-muted-foreground">
                {formatNumber(entry.outputQuantity, 1)}{" "}
                {entry.outputProduct.unit}
              </p>
            </div>
          </div>
          <p className="text-[13px] font-medium text-orange-600">
            Yield Loss: {formatNumber(entry.yieldLoss, 1)} kg
          </p>
        </div>

        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 text-[15px]">
            <span className="text-muted-foreground">Date</span>
            <span>{toNepaliDate(entry.date)}</span>
          </div>
          {entry.notes && (
            <div
              className="px-4 py-3"
              style={{ borderTop: "0.5px solid oklch(0 0 0 / 6%)" }}
            >
              <p className="text-[12px] text-muted-foreground mb-1">Notes</p>
              <p className="text-[15px]">{entry.notes}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
