"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ArrowDownLeft,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { DetailSkeleton } from "@/components/skeletons";
import { ErrorState } from "@/components/empty-state";
import { useTransaction, useDeleteTransaction } from "@/app/features/transactions/hooks/useTransactions";
import { usePartyBalance } from "@/app/features/parties/hooks/useParties";
import { formatNepaliCurrency, toNepaliDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { data: txn, isLoading, error, refetch } = useTransaction(id);
  const deleteTransaction = useDeleteTransaction();
  // Must be called before any conditional returns (Rules of Hooks)
  // usePartyBalance is disabled when partyId is empty so it won't fetch while loading
  const { data: partyBalance } = usePartyBalance(txn?.party._id ?? "");

  const handleDelete = () => {
    deleteTransaction.mutate(id, {
      onSuccess: () => router.push("/transactions"),
    });
  };

  if (isLoading) return <DetailSkeleton />;
  if (error)
    return <ErrorState message={error.message} onRetry={() => refetch()} />;
  if (!txn) return null;

  const isPurchase = txn.type === "purchase";

  // Use live party balance
  const outstandingAmount = partyBalance ? Math.abs(partyBalance.outstandingBalance) : 0;

  return (
    <>
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        variant="destructive"
        title="Delete Transaction?"
        description="This will delete the transaction, reverse stock changes, and remove any linked payments. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={deleteTransaction.isPending}
        onConfirm={handleDelete}
      />

      <PageHeader
        title="Transaction Detail"
        back
        action={
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={() => setShowDeleteDialog(true)}
            disabled={deleteTransaction.isPending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        }
      />

      <div className="space-y-4 p-4">
        {/* Header Card */}
        <div className="glass-card rounded-2xl p-5 text-center space-y-2">
          <div
            className={cn(
              "mx-auto flex h-14 w-14 items-center justify-center rounded-2xl",
              isPurchase ? "bg-red-500/10" : "bg-green-500/10"
            )}
          >
            {isPurchase ? (
              <ArrowUpRight className="h-7 w-7 text-red-500" />
            ) : (
              <ArrowDownLeft className="h-7 w-7 text-green-500" />
            )}
          </div>
          <Badge
            variant="secondary"
            className={cn(
              "capitalize",
              isPurchase
                ? "bg-red-500/10 text-red-600 border-0"
                : "bg-green-500/10 text-green-600 border-0"
            )}
          >
            {txn.type}
          </Badge>
          <p className="text-2xl font-bold">
            {formatNepaliCurrency(txn.totalAmount)}
          </p>
          <p className="text-[13px] text-muted-foreground">
            {toNepaliDate(txn.date)}
          </p>
        </div>

        {/* Details Card */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 text-[15px]">
            <span className="text-muted-foreground">Party</span>
            <span className="font-medium">{txn.party.name}</span>
          </div>
          <div
            className="flex justify-between items-center px-4 py-3 text-[15px]"
            style={{ borderTop: "0.5px solid oklch(0 0 0 / 6%)" }}
          >
            <span className="text-muted-foreground">Product</span>
            <span className="font-medium">{txn.product.name}</span>
          </div>
          <div
            className="flex justify-between items-center px-4 py-3 text-[15px]"
            style={{ borderTop: "0.5px solid oklch(0 0 0 / 6%)" }}
          >
            <span className="text-muted-foreground">Quantity</span>
            <span>
              {txn.quantity} {txn.product.unit}
            </span>
          </div>
          <div
            className="flex justify-between items-center px-4 py-3 text-[15px]"
            style={{ borderTop: "0.5px solid oklch(0 0 0 / 6%)" }}
          >
            <span className="text-muted-foreground">Rate / kg</span>
            <span>{formatNepaliCurrency(txn.ratePerKg)}</span>
          </div>
          <div
            className="flex justify-between items-center px-4 py-3 text-[15px]"
            style={{ borderTop: "0.5px solid oklch(0 0 0 / 6%)" }}
          >
            <span className="text-muted-foreground">Total Amount</span>
            <span className="font-semibold">
              {formatNepaliCurrency(txn.totalAmount)}
            </span>
          </div>
          <div
            className="flex justify-between items-center px-4 py-3 text-[15px]"
            style={{ borderTop: "0.5px solid oklch(0 0 0 / 6%)" }}
          >
            <span className="text-muted-foreground">Paid</span>
            <span>{formatNepaliCurrency(txn.paidAmount)}</span>
          </div>
          <div
            className="flex justify-between items-center px-4 py-3 text-[15px]"
            style={{ borderTop: "0.5px solid oklch(0 0 0 / 6%)" }}
          >
            <span className="text-muted-foreground">Transaction Balance Due</span>
            <span
              className={cn(
                "font-semibold",
                txn.balanceAmount > 0 ? "text-red-500" : "text-green-600"
              )}
            >
              {formatNepaliCurrency(txn.balanceAmount)}
            </span>
          </div>
          {partyBalance && partyBalance.direction !== "settled" && (
            <div
              className="flex justify-between items-center px-4 py-3 text-[15px]"
              style={{ borderTop: "0.5px solid oklch(0 0 0 / 6%)" }}
            >
              <span className="text-muted-foreground">Party Outstanding</span>
              <span
                className={cn(
                  "font-semibold",
                  partyBalance.direction === "to-receive"
                    ? "text-green-600"
                    : "text-red-500"
                )}
              >
                {partyBalance.direction === "to-pay" ? "To Pay · " : "To Receive · "}
                {formatNepaliCurrency(outstandingAmount)}
              </span>
            </div>
          )}
          {txn.notes && (
            <div
              className="px-4 py-3"
              style={{ borderTop: "0.5px solid oklch(0 0 0 / 6%)" }}
            >
              <p className="text-[12px] text-muted-foreground mb-1">Notes</p>
              <p className="text-[15px]">{txn.notes}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
