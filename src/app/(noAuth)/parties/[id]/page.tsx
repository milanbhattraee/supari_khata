"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  Phone,
  MapPin,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Wallet,
  Pencil,
  Trash2,
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
  useParty,
  usePartyBalance,
  usePartyActivities,
  useDeleteParty,
} from "@/app/features/parties/hooks/useParties";
import { formatNepaliCurrency } from "@/lib/format";
import { toNepaliDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export default function PartyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const { data: party, isLoading, error, refetch } = useParty(id);
  const { data: balance } = usePartyBalance(id);
  const { data: activitiesData, isLoading: activitiesLoading } = usePartyActivities(
    id,
    { page: String(activityPage), limit: "10" }
  );
  const deleteParty = useDeleteParty();

  // Reset page when party changes
  useEffect(() => {
    setActivityPage(1);
  }, [id]);

  const handleDelete = () => {
    deleteParty.mutate(id, {
      onSuccess: () => router.push("/parties"),
    });
  };

  if (isLoading) return <DetailSkeleton />;
  if (error)
    return <ErrorState message={error.message} onRetry={() => refetch()} />;
  if (!party) return null;

  const canCreatePurchase = party.category === "supplier" || party.category === "both";
  const canCreateSale = party.category === "customer" || party.category === "both";
  const canPaymentOut = canCreatePurchase;
  const canPaymentIn = canCreateSale;

  return (
    <>
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        variant="destructive"
        title="Delete Party?"
        description="This party will be deactivated if it has financial history. Otherwise, it will be permanently deleted."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={deleteParty.isPending}
        onConfirm={handleDelete}
      />

      <PageHeader
        title={party.name}
        back
        action={
          <div className="flex gap-2">
            <Link href={`/parties/${id}/edit`}>
              <Button variant="ghost" size="icon">
                <Pencil className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={() => setShowDeleteDialog(true)}
              disabled={deleteParty.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="space-y-4 p-4">
        {/* Info Card */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-2">
            <Badge variant="secondary" className="capitalize">
              {party.category}
            </Badge>
            {!party.isActive && (
              <Badge variant="destructive">Inactive</Badge>
            )}
          </div>
          {party.phone && (
            <div
              className="px-4 py-3 flex items-center gap-3 text-[15px]"
              style={{ borderTop: "0.5px solid oklch(0 0 0 / 6%)" }}
            >
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{party.phone}</span>
            </div>
          )}
          {party.address && (
            <div
              className="px-4 py-3 flex items-center gap-3 text-[15px]"
              style={{ borderTop: "0.5px solid oklch(0 0 0 / 6%)" }}
            >
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{party.address}</span>
            </div>
          )}
          {/* Product-wise kg summary */}
          {balance && (balance.salesByProduct?.length || balance.purchasesByProduct?.length) ? (
            <div
              className="px-4 py-3"
              style={{ borderTop: "0.5px solid oklch(0 0 0 / 6%)" }}
            >
              <div className="flex flex-wrap gap-2">
                {balance.salesByProduct?.map((p) => (
                  <Badge key={`sale-${p.productId}`} variant="secondary" className="bg-green-500/10 text-green-600 border-0 text-[11px]">
                    {p.productName}: {p.kg.toFixed(2)} kg sold
                  </Badge>
                ))}
                {balance.purchasesByProduct?.map((p) => (
                  <Badge key={`purchase-${p.productId}`} variant="secondary" className="bg-red-500/10 text-red-600 border-0 text-[11px]">
                    {p.productName}: {p.kg.toFixed(2)} kg bought
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
          <div
            className="px-4 py-3 text-[13px] text-muted-foreground"
            style={{ borderTop: "0.5px solid oklch(0 0 0 / 6%)" }}
          >
            Added: {toNepaliDate(party.createdAt)}
          </div>
        </div>

        {/* Balance Card */}
        {balance && (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="px-4 py-3">
              <p className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wide">
                Balance Summary
              </p>
            </div>

            <div className="grid grid-cols-2 gap-px bg-foreground/5">
              <div className="bg-background/80 backdrop-blur-sm p-3 space-y-1">
                <p className="text-[12px] text-muted-foreground">Opening</p>
                <p className="text-[15px] font-semibold">
                  {formatNepaliCurrency(balance.openingBalance)}
                </p>
              </div>
              <div className="bg-background/80 backdrop-blur-sm p-3 space-y-1">
                <p className="text-[12px] text-muted-foreground">Net Payments</p>
                <p
                  className={cn(
                    "text-[15px] font-semibold",
                    balance.totalStandalonePayments > 0
                      ? "text-green-600"
                      : balance.totalStandalonePayments < 0
                      ? "text-red-600"
                      : "text-foreground"
                  )}
                >
                  {formatNepaliCurrency(balance.totalStandalonePayments)}
                </p>
              </div>
              <div className="bg-green-500/5 backdrop-blur-sm p-3 space-y-1">
                <p className="text-[12px] text-muted-foreground flex items-center gap-1">
                  <ArrowDownLeft className="h-3 w-3 text-green-600" />
                  Sales Due
                </p>
                <p className="text-[15px] font-semibold text-green-600">
                  {formatNepaliCurrency(balance.totalSalesDue)}
                </p>
                {balance.salesByProduct && balance.salesByProduct.length > 0 ? (
                  <div className="text-[11px] text-muted-foreground space-y-0.5">
                    {balance.salesByProduct.map((p) => (
                      <div key={p.productId}>{p.productName}: {p.kg.toFixed(2)} kg</div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    {(balance.totalSalesKg ?? 0).toFixed(2)} kg
                  </p>
                )}
              </div>
              <div className="bg-red-500/5 backdrop-blur-sm p-3 space-y-1">
                <p className="text-[12px] text-muted-foreground flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3 text-red-600" />
                  Purchase Due
                </p>
                <p className="text-[15px] font-semibold text-red-600">
                  {formatNepaliCurrency(balance.totalPurchasesDue)}
                </p>
                {balance.purchasesByProduct && balance.purchasesByProduct.length > 0 ? (
                  <div className="text-[11px] text-muted-foreground space-y-0.5">
                    {balance.purchasesByProduct.map((p) => (
                      <div key={p.productId}>{p.productName}: {p.kg.toFixed(2)} kg</div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    {(balance.totalPurchasesKg ?? 0).toFixed(2)} kg
                  </p>
                )}
              </div>
            </div>

            <div
              className="px-4 py-3"
              style={{ borderTop: "0.5px solid oklch(0 0 0 / 6%)" }}
            >
              <div className="space-y-3">
               
                <div className="space-y-1.5 text-[13px]">

                  <div
                    className="flex justify-between items-center pt-2 mt-2"
                    style={{ borderTop: "1px solid oklch(0 0 0 / 10%)" }}
                  >
                    <span className="font-semibold">Total Outstanding</span>
                    <div className="text-right">
                      <p
                        className={cn(
                          "text-lg font-bold",
                          balance.direction === "to-receive"
                            ? "text-green-600"
                            : balance.direction === "to-pay"
                            ? "text-red-600"
                            : "text-muted-foreground"
                        )}
                      >
                        {formatNepaliCurrency(Math.abs(balance.outstandingBalance))}
                      </p>
                      <p
                        className={cn(
                          "text-[11px] font-medium",
                          balance.direction === "to-receive"
                            ? "text-green-600"
                            : balance.direction === "to-pay"
                            ? "text-red-600"
                            : "text-muted-foreground"
                        )}
                      >
                        {balance.direction === "to-receive"
                          ? "To Receive"
                          : balance.direction === "to-pay"
                          ? "To Pay"
                          : "Settled"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Smart Actions */}
        <div className="glass-card rounded-2xl p-3 space-y-3">
          <p className="px-1 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Quick Actions
          </p>
          <div className="grid grid-cols-2 gap-2">
            {canPaymentOut ? (
              <Link href={`/payments/create?partyId=${id}&direction=payout`}>
                <Button className="w-full justify-start gap-2 rounded-xl" variant="secondary">
                  <ArrowUpRight className="h-4 w-4" />
                  Payment Out
                </Button>
              </Link>
            ) : null}
            {canCreatePurchase ? (
              <Link href={`/transactions/create?partyId=${id}&type=purchase`}>
                <Button className="w-full justify-start gap-2 rounded-xl" variant="secondary">
                  <ArrowLeftRight className="h-4 w-4" />
                  New Purchase
                </Button>
              </Link>
            ) : null}
            {canPaymentIn ? (
              <Link href={`/payments/create?partyId=${id}&direction=payin`}>
                <Button className="w-full justify-start gap-2 rounded-xl" variant="secondary">
                  <ArrowDownLeft className="h-4 w-4" />
                  Payment In
                </Button>
              </Link>
            ) : null}
            {canCreateSale ? (
              <Link href={`/transactions/create?partyId=${id}&type=sale`}>
                <Button className="w-full justify-start gap-2 rounded-xl" variant="secondary">
                  <ArrowLeftRight className="h-4 w-4" />
                  New Sale
                </Button>
              </Link>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Link href={`/transactions?partyId=${id}`}>
              <Button variant="outline" className="w-full rounded-xl text-[13px]">
                All Transactions
              </Button>
            </Link>
            <Link href={`/payments?partyId=${id}`}>
              <Button variant="outline" className="w-full rounded-xl text-[13px]">
                All Payments
              </Button>
            </Link>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
              Activity
            </p>
            <Wallet className="h-4 w-4 text-muted-foreground" />
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
              No activity yet for this party.
            </div>
          ) : (
            <>
              {activitiesData.data.map((activity, index) => {
                const isTransaction = activity.kind === "transaction";
                const href = isTransaction
                  ? `/transactions/${activity._id}`
                  : `/payments/${activity._id}`;
                const title = isTransaction
                  ? activity.type === "purchase"
                    ? "Purchase"
                    : "Sale"
                  : activity.direction === "payout"
                  ? "Payment Out"
                  : "Payment In";
                const subtitle = isTransaction
                  ? `${activity.product?.name} · ${activity.quantity} ${activity.product?.unit} @ ₹${activity.ratePerKg}`
                  : `Method: ${activity.method?.replace("_", " ")}`;
                const amountLabel = formatNepaliCurrency(
                  isTransaction ? activity.totalAmount ?? 0 : activity.amount ?? 0
                );
                const statusLabel = isTransaction
                  ? (activity.balanceAmount ?? 0) > 0
                    ? `Unpaid ${formatNepaliCurrency(activity.balanceAmount ?? 0)}`
                    : "Settled"
                  : activity.direction === "payout"
                  ? "Paid"
                  : "Received";
                const tone = isTransaction
                  ? (activity.balanceAmount ?? 0) > 0
                    ? "text-red-500"
                    : "text-green-600"
                  : activity.direction === "payout"
                  ? "text-amber-600"
                  : "text-green-600";

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
                          isTransaction ? "bg-blue-500/10" : "bg-amber-500/10"
                        )}
                      >
                        {isTransaction ? (
                          <ArrowLeftRight className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Wallet className="h-4 w-4 text-amber-600" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-medium text-wrap break-words">{title}</p>
                        <p className="text-[12px] text-muted-foreground text-wrap break-words">
                          {subtitle} · {toNepaliDate(activity.date)}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-[13px] font-semibold">{amountLabel}</p>
                        <p className={cn("text-[11px]", tone)}>{statusLabel}</p>
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
