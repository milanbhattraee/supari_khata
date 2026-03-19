"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NepaliDatePicker } from "@/components/ui/nepali-date-picker";
import { FormDrawerPage } from "@/components/form-drawer-page";
import { DetailSkeleton } from "@/components/skeletons";
import { ErrorState } from "@/components/empty-state";
import {
  useTransaction,
  useUpdateTransaction,
} from "@/app/features/transactions/hooks/useTransactions";
import { formatNepaliCurrency } from "@/lib/format";

interface EditTransactionFormValues {
  paidAmount: number;
  date?: string;
  notes?: string;
}

export default function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: txn, isLoading, error, refetch } = useTransaction(id);
  const updateTransaction = useUpdateTransaction(id);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<EditTransactionFormValues>();

  // Populate form when transaction data loads
  useEffect(() => {
    if (txn) {
      reset({
        paidAmount: txn.paidAmount,
        date: txn.date,
        notes: txn.notes ?? "",
      });
    }
  }, [txn, reset]);

  const paidAmount = watch("paidAmount") || 0;
  const balance = txn ? txn.totalAmount - paidAmount : 0;

  const onSubmit = (data: EditTransactionFormValues) => {
    if (!txn) return;

    const partyId = txn.party._id;
    updateTransaction.mutate(
      {
        paidAmount: data.paidAmount,
        date: data.date,
        notes: data.notes,
      },
      {
        onSuccess: () => router.push(`/parties/${partyId}`),
      }
    );
  };

  if (isLoading) return <DetailSkeleton />;
  if (error)
    return <ErrorState message={error.message} onRetry={() => refetch()} />;
  if (!txn) return null;

  return (
    <FormDrawerPage title="Edit Transaction" subtitle="Update transaction details" back>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Read-only transaction info */}
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
            Transaction Info (Read Only)
          </p>
          <div className="grid grid-cols-2 gap-3 text-[14px]">
            <div>
              <span className="text-muted-foreground">Type</span>
              <p className="font-medium capitalize">{txn.type}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Party</span>
              <p className="font-medium">{txn.party.name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Product</span>
              <p className="font-medium">{txn.product.name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Quantity</span>
              <p className="font-medium">{txn.quantity} {txn.product.unit}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Rate/kg</span>
              <p className="font-medium">{formatNepaliCurrency(txn.ratePerKg)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Total Amount</span>
              <p className="font-semibold">{formatNepaliCurrency(txn.totalAmount)}</p>
            </div>
          </div>
        </div>

        {/* Editable fields */}
        <div className="glass-card rounded-2xl p-4 space-y-4">
          <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
            Editable Fields
          </p>

          <div className="space-y-2">
            <Label htmlFor="paidAmount">Paid Amount</Label>
            <Input
              id="paidAmount"
              type="number"
              step="0.01"
              min="0"
              max={txn.totalAmount}
              {...register("paidAmount", {
                valueAsNumber: true,
                min: { value: 0, message: "Paid amount cannot be negative" },
                max: { value: txn.totalAmount, message: `Cannot exceed total of ${formatNepaliCurrency(txn.totalAmount)}` },
              })}
            />
            {errors.paidAmount && (
              <p className="text-xs text-destructive">{errors.paidAmount.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Controller
              name="date"
              control={control}
              render={({ field }) => (
                <NepaliDatePicker
                  id="date"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={3}
              placeholder="Optional notes"
              {...register("notes")}
            />
          </div>
        </div>

        {/* Balance summary */}
        <div className="glass-card rounded-2xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Amount</span>
            <span className="font-semibold">{formatNepaliCurrency(txn.totalAmount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Paid</span>
            <span>{formatNepaliCurrency(paidAmount)}</span>
          </div>
          <div className="flex justify-between text-sm font-medium">
            <span>Balance Due</span>
            <span className={balance > 0 ? "text-red-600" : "text-green-600"}>
              {formatNepaliCurrency(Math.max(0, balance))}
            </span>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={updateTransaction.isPending}
        >
          {updateTransaction.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </form>
    </FormDrawerPage>
  );
}
