"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NepaliDatePicker } from "@/components/ui/nepali-date-picker";
import { FormDrawerPage } from "@/components/form-drawer-page";
import { ListSkeleton } from "@/components/skeletons";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createPaymentSchema,
  CreatePaymentFormValues,
} from "@/app/features/payments/schema";
import { useCreatePayment } from "@/app/features/payments/hooks/usePayments";
import { useTransaction } from "@/app/features/transactions/hooks/useTransactions";
import { useParties, usePartyBalance } from "@/app/features/parties/hooks/useParties";
import { formatNepaliCurrency } from "@/lib/format";
import {
  getAllowedPaymentDirections,
  getDefaultPaymentDirection,
  getSuggestedAmountForDirection,
  PAYMENT_DIRECTION_DESCRIPTIONS,
  PAYMENT_DIRECTION_LABELS,
} from "@/lib/payment-utils";

export default function CreatePaymentPage() {
  return (
    <Suspense>
      <CreatePaymentContent />
    </Suspense>
  );
}

function CreatePaymentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createPayment = useCreatePayment();
  const { data: partiesData, isLoading: partiesLoading } = useParties();
  const prefilledPartyId = searchParams.get("partyId") ?? "";
  const prefilledAmount = Number(searchParams.get("amount") ?? "");
  const prefilledDirection = searchParams.get("direction");
  const transactionId = searchParams.get("transactionId") ?? "";
  const parsedAmount = Number.isFinite(prefilledAmount) && prefilledAmount > 0 ? prefilledAmount : undefined;
  const { data: linkedTransaction } = useTransaction(transactionId);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    watch,
    formState: { errors },
  } = useForm<CreatePaymentFormValues>({
    resolver: standardSchemaResolver(createPaymentSchema),
    defaultValues: {
      partyId: prefilledPartyId,
      amount: parsedAmount,
      transactionId: transactionId || undefined,
      direction:
        prefilledDirection === "payin" || prefilledDirection === "payout"
          ? prefilledDirection
          : "payin",
      method: "cash",
      notes: transactionId ? `Settlement for transaction #${transactionId.slice(-6)}` : "",
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const selectedPartyId = watch("partyId");
  const selectedDirection = watch("direction");
  const selectedParty = partiesData?.data.find((party) => party._id === selectedPartyId);
  const { data: balance } = usePartyBalance(selectedPartyId);

  const allowedDirections = useMemo(
    () => getAllowedPaymentDirections(selectedParty?.category, balance?.direction),
    [selectedParty?.category, balance?.direction]
  );

  useEffect(() => {
    if (!selectedParty) return;
    if (!allowedDirections.includes(selectedDirection)) {
      setValue(
        "direction",
        getDefaultPaymentDirection(selectedParty.category, balance?.direction),
        { shouldValidate: true }
      );
    }
  }, [allowedDirections, balance?.direction, selectedDirection, selectedParty, setValue]);

  const expectedTxnDirection =
    linkedTransaction?.type === "purchase" ? "payout" : "payin";
  const transactionSuggestedAmount =
    linkedTransaction &&
    selectedPartyId === linkedTransaction.party._id &&
    selectedDirection === expectedTxnDirection
      ? Math.max(0, linkedTransaction.balanceAmount)
      : null;

  const suggestedAmount =
    transactionSuggestedAmount !== null
      ? transactionSuggestedAmount
      : getSuggestedAmountForDirection(balance, selectedDirection);
  const paymentHeadline =
    selectedDirection === "payout" ? "Amount to pay" : "Amount to receive";

  const onSubmit = (data: CreatePaymentFormValues) => {
    createPayment.mutate(data, {
      onSuccess: () => router.push("/payments"),
    });
  };

  if (partiesLoading) return <ListSkeleton count={3} />;

  return (
    <FormDrawerPage title="Record Payment" subtitle="Log an incoming or outgoing payment" back>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="glass-card rounded-2xl p-4 space-y-4">
          <div className="space-y-2">
            <Label>Entry Type</Label>
            <Tabs value={selectedDirection} onValueChange={(value) => setValue("direction", value as "payin" | "payout", { shouldValidate: true })}>
              <TabsList className="w-full glass-card">
                {allowedDirections.map((direction) => (
                  <TabsTrigger key={direction} value={direction} className="flex-1">
                    {PAYMENT_DIRECTION_LABELS[direction]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <p className="text-xs text-muted-foreground">
              {PAYMENT_DIRECTION_DESCRIPTIONS[selectedDirection]}
            </p>
            {errors.direction && (
              <p className="text-xs text-destructive">{errors.direction.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Party *</Label>
            <Controller
              name="partyId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={(val: string | null) => field.onChange(val ?? "") }>
                  <SelectTrigger>
                    <SelectValue placeholder="Select party" />
                  </SelectTrigger>
                  <SelectContent>
                    {partiesData?.data.map((p) => (
                      <SelectItem key={p._id} value={p._id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.partyId && (
              <p className="text-xs text-destructive">
                {errors.partyId.message}
              </p>
            )}
          </div>

          {selectedParty && balance ? (
            <div className="rounded-2xl bg-white/45 p-3 backdrop-blur-sm dark:bg-white/6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {paymentHeadline}
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    {suggestedAmount ? formatNepaliCurrency(suggestedAmount) : "No pending due"}
                  </p>
                </div>
                {suggestedAmount ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="rounded-xl"
                    onClick={() => setValue("amount", suggestedAmount, { shouldValidate: true, shouldDirty: true })}
                  >
                    Use Full
                  </Button>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {transactionSuggestedAmount !== null
                  ? `Transaction due: ${formatNepaliCurrency(transactionSuggestedAmount)}.`
                  : balance.direction === "settled"
                    ? `${selectedParty.name} is currently settled.`
                    : balance.direction === "to-pay"
                      ? `You need to pay ${selectedParty.name}.`
                      : `${selectedParty.name} needs to pay you.`}
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="amount">{paymentHeadline} *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register("amount", { valueAsNumber: true })}
            />
            {errors.amount && (
              <p className="text-xs text-destructive">
                {errors.amount.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Controller
              name="method"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(val) =>
                    field.onChange(
                      (val as "cash" | "bank_transfer" | "cheque" | "upi" | "other") ?? "cash"
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
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
            <Label htmlFor="referenceNumber">Reference Number</Label>
            <Input
              id="referenceNumber"
              placeholder="Cheque no / UTR / UPI ref"
              {...register("referenceNumber")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder="Optional notes"
              {...register("notes")}
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={createPayment.isPending}
        >
          {createPayment.isPending ? "Recording..." : PAYMENT_DIRECTION_LABELS[selectedDirection]}
        </Button>
      </form>
    </FormDrawerPage>
  );
}
