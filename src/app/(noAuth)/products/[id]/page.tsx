"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Trash2,
  Package,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { PageHeader } from "@/components/page-header";
import { DetailSkeleton } from "@/components/skeletons";
import { ErrorState } from "@/components/empty-state";
import {
  useProduct,
  useDeleteProduct,
  useProductActivities,
} from "@/app/features/products/hooks/useProducts";
import { formatNumber, formatNepaliCurrency, toNepaliDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const { data: product, isLoading, error, refetch } = useProduct(id);
  const { data: activitiesData, isLoading: activitiesLoading } = useProductActivities(
    id,
    { page: String(activityPage), limit: "10" }
  );
  const deleteProduct = useDeleteProduct();

  // Reset page when product changes
  useEffect(() => {
    setActivityPage(1);
  }, [id]);

  const handleDelete = () => {
    deleteProduct.mutate(id, {
      onSuccess: () => router.push("/products"),
    });
  };

  if (isLoading) return <DetailSkeleton />;
  if (error)
    return <ErrorState message={error.message} onRetry={() => refetch()} />;
  if (!product) return null;

  return (
    <>
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        variant="destructive"
        title="Delete Product?"
        description="This product will be deactivated if it has transaction history. Otherwise, it will be permanently deleted."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={deleteProduct.isPending}
        onConfirm={handleDelete}
      />

      <PageHeader
        title={product.name}
        back
        action={
          <div className="flex gap-2">
            <Link href={`/products/${id}/edit`}>
              <Button variant="ghost" size="icon">
                <Pencil className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={() => setShowDeleteDialog(true)}
              disabled={deleteProduct.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="space-y-4 p-4">
        <div className="glass-card rounded-2xl p-5 text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10">
            <Package className="h-7 w-7 text-blue-600" />
          </div>
          <p
            className={`text-3xl font-bold ${
              product.currentStock <= 10 ? "text-red-500" : ""
            }`}
          >
            {formatNumber(product.currentStock, 1)}
          </p>
          <p className="text-[13px] text-muted-foreground">
            {product.unit} in stock
          </p>
        </div>

        <div className="glass-card rounded-2xl overflow-hidden">
          <div
            className="flex justify-between items-center px-4 py-3 text-[15px]"
          >
            <span className="text-muted-foreground">Unit</span>
            <Badge variant="secondary" className="uppercase">
              {product.unit}
            </Badge>
          </div>
          {product.description && (
            <div
              className="flex justify-between items-center px-4 py-3 text-[15px]"
              style={{ borderTop: "0.5px solid oklch(0 0 0 / 6%)" }}
            >
              <span className="text-muted-foreground">Description</span>
              <span>{product.description}</span>
            </div>
          )}
          <div
            className="flex justify-between items-center px-4 py-3 text-[15px]"
            style={{ borderTop: "0.5px solid oklch(0 0 0 / 6%)" }}
          >
            <span className="text-muted-foreground">Status</span>
            <Badge variant={product.isActive ? "default" : "destructive"}>
              {product.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <div
            className="flex justify-between items-center px-4 py-3 text-[15px]"
            style={{ borderTop: "0.5px solid oklch(0 0 0 / 6%)" }}
          >
            <span className="text-muted-foreground">Added</span>
            <span>{toNepaliDate(product.createdAt)}</span>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
              Recent Activity
            </p>
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          </div>

          {activitiesLoading ? (
            <div
              className="px-4 py-6 text-center text-sm text-muted-foreground"
              style={{ borderTop: "0.5px solid oklch(0 0 0 / 6%)" }}
            >
              Loading activities...
            </div>
          ) : !activitiesData?.data.length ? (
            <div
              className="px-4 py-6 text-center text-sm text-muted-foreground"
              style={{ borderTop: "0.5px solid oklch(0 0 0 / 6%)" }}
            >
              No activity yet for this product.
            </div>
          ) : (
            <>
              {activitiesData.data.map((activity, index) => {
                const isPurchase = activity.type === "purchase";
                const href = `/transactions/${activity._id}`;

                return (
                  <Link key={activity._id} href={href}>
                    <div
                      className="px-4 py-3 flex items-center gap-3 active:bg-foreground/5 transition-colors"
                      style={{
                        borderTop: index === 0 ? "0.5px solid oklch(0 0 0 / 6%)" : undefined,
                        borderBottom:
                          index < activitiesData.data.length - 1
                            ? "0.5px solid oklch(0 0 0 / 6%)"
                            : "none",
                      }}
                    >
                      <div
                        className={cn(
                          "h-9 w-9 rounded-xl flex items-center justify-center shrink-0",
                          isPurchase ? "bg-red-500/10" : "bg-green-500/10"
                        )}
                      >
                        {isPurchase ? (
                          <ArrowUpRight className="h-4 w-4 text-red-600" />
                        ) : (
                          <ArrowDownLeft className="h-4 w-4 text-green-600" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[14px] font-medium text-wrap break-words">
                            {activity.party.name}
                          </p>
                          <Badge
                            variant={isPurchase ? "destructive" : "default"}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {isPurchase ? "Purchase" : "Sale"}
                          </Badge>
                        </div>
                        <p className="text-[12px] text-muted-foreground text-wrap break-words">
                          {activity.quantity} {product.unit} @ ₹{activity.ratePerKg} · {toNepaliDate(activity.date)}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-[13px] font-semibold">
                          {formatNepaliCurrency(activity.totalAmount)}
                        </p>
                        <p
                          className={cn(
                            "text-[11px]",
                            activity.balanceAmount > 0 ? "text-red-500" : "text-green-600"
                          )}
                        >
                          {activity.balanceAmount > 0
                            ? `Due ${formatNepaliCurrency(activity.balanceAmount)}`
                            : "Settled"}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    </div>
                  </Link>
                );
              })}
              {activitiesData.meta.totalPages > 1 && (
                <div
                  className="px-4 py-2"
                  style={{ borderTop: "0.5px solid oklch(0 0 0 / 6%)" }}
                >
                  <PaginationControls
                    currentPage={activitiesData.meta.page}
                    totalPages={activitiesData.meta.totalPages}
                    onPageChange={setActivityPage}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
