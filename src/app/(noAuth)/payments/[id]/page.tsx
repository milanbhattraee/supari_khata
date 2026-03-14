"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { DetailSkeleton } from "@/components/skeletons";
import { ErrorState } from "@/components/empty-state";
import {
  usePayment,
  useDeletePayment,
} from "@/app/features/payments/hooks/usePayments";
import { formatNepaliCurrency, toNepaliDate } from "@/lib/format";
import { PAYMENT_DIRECTION_LABELS } from "@/lib/payment-utils";

const methodLabels: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  cheque: "Cheque",
  upi: "UPI",
  other: "Other",
};

export default function PaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: payment, isLoading, error, refetch } = usePayment(id);
  const deletePayment = useDeletePayment();

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this payment?")) {
      deletePayment.mutate(id, {
        onSuccess: () => router.push("/payments"),
      });
    }
  };

  if (isLoading) return <DetailSkeleton />;
  if (error)
    return <ErrorState message={error.message} onRetry={() => refetch()} />;
  if (!payment) return null;

  const isPayIn = payment.direction === "payin";

  return (
    <>
      <PageHeader
        title="Payment Detail"
        back
        action={
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={handleDelete}
            disabled={deletePayment.isPending}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        }
      />

      <div className="space-y-4 p-4">
        <div className="glass-card rounded-2xl p-5 text-center space-y-2">
          <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${isPayIn ? "bg-green-500/10" : "bg-amber-500/10"}`}>
            {isPayIn ? (
              <ArrowDownLeft className="h-7 w-7 text-green-600" />
            ) : (
              <ArrowUpRight className="h-7 w-7 text-amber-600" />
            )}
          </div>
          <Badge variant="secondary" className={isPayIn ? "bg-green-500/10 text-green-700 border-0" : "bg-amber-500/10 text-amber-700 border-0"}>
            {PAYMENT_DIRECTION_LABELS[payment.direction]}
          </Badge>
          <p className={`text-2xl font-bold ${isPayIn ? "text-green-600" : "text-amber-600"}`}>
            {formatNepaliCurrency(payment.amount)}
          </p>
          <p className="text-[13px] text-muted-foreground">
            {toNepaliDate(payment.date)}
          </p>
        </div>

        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 text-[15px]">
            <span className="text-muted-foreground">Party</span>
            <span className="font-medium">{payment.party.name}</span>
          </div>
          <div
            className="flex justify-between items-center px-4 py-3 text-[15px]"
            style={{ borderTop: "0.5px solid oklch(0 0 0 / 6%)" }}
          >
            <span className="text-muted-foreground">Type</span>
            <Badge variant="outline">{PAYMENT_DIRECTION_LABELS[payment.direction]}</Badge>
          </div>
          <div
            className="flex justify-between items-center px-4 py-3 text-[15px]"
            style={{ borderTop: "0.5px solid oklch(0 0 0 / 6%)" }}
          >
            <span className="text-muted-foreground">Method</span>
            <Badge variant="outline">{methodLabels[payment.method]}</Badge>
          </div>
          {payment.referenceNumber && (
            <div
              className="flex justify-between items-center px-4 py-3 text-[15px]"
              style={{ borderTop: "0.5px solid oklch(0 0 0 / 6%)" }}
            >
              <span className="text-muted-foreground">Reference</span>
              <span className="font-mono text-[13px]">{payment.referenceNumber}</span>
            </div>
          )}
          {payment.notes && (
            <div
              className="px-4 py-3"
              style={{ borderTop: "0.5px solid oklch(0 0 0 / 6%)" }}
            >
              <p className="text-[12px] text-muted-foreground mb-1">Notes</p>
              <p className="text-[15px]">{payment.notes}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
