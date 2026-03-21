"use client";

import { Suspense, useMemo } from "react";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { NepaliDatePicker } from "@/components/ui/nepali-date-picker";
import { FormDrawerPage } from "@/components/form-drawer-page";
import { ListSkeleton } from "@/components/skeletons";
import {
  createTransactionSchema,
  CreateTransactionFormValues,
} from "@/app/features/transactions/schema";
import { useCreateTransaction } from "@/app/features/transactions/hooks/useTransactions";
import { useParties } from "@/app/features/parties/hooks/useParties";
import { useProducts } from "@/app/features/products/hooks/useProducts";
import { formatNepaliCurrency } from "@/lib/format";

export default function CreateTransactionPage() {
  return (
    <Suspense>
      <CreateTransactionContent />
    </Suspense>
  );
}

function CreateTransactionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createTxn = useCreateTransaction();
  const { data: partiesData, isLoading: partiesLoading } = useParties({ limit: "100" });
  const { data: productsData, isLoading: productsLoading } = useProducts();
  const prefilledPartyId = searchParams.get("partyId") ?? "";
  const prefilledType = searchParams.get("type");

  const initialType: "purchase" | "sale" =
    prefilledType === "sale" ? "sale" : "purchase";

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<CreateTransactionFormValues>({
    resolver: standardSchemaResolver(createTransactionSchema),
    defaultValues: {
      partyId: prefilledPartyId,
      productId: "",
      type: initialType,
      paidAmount: 0,
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const quantity = watch("quantity") || 0;
  const rate = watch("ratePerKg") || 0;
  const totalAmount = quantity * rate;
  const paidAmount = watch("paidAmount") || 0;
  const balance = totalAmount - paidAmount;

  // Create lookup maps for displaying names
  const partyMap = useMemo(() => {
    const map = new Map<string, string>();
    partiesData?.data.forEach((p) => map.set(p._id, p.name));
    return map;
  }, [partiesData]);

  const productMap = useMemo(() => {
    const map = new Map<string, string>();
    productsData?.data.forEach((p) => map.set(p._id, `${p.name} (${p.currentStock} ${p.unit})`));
    return map;
  }, [productsData]);

  const onSubmit = (data: CreateTransactionFormValues) => {
    createTxn.mutate(data, {
      onSuccess: () => router.push(`/parties/${data.partyId}`),
    });
  };

  if (partiesLoading || productsLoading) return <ListSkeleton count={3} />;

  return (
    <FormDrawerPage title="New Transaction" subtitle="Record a purchase or sale" back>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="glass-card rounded-2xl p-4 space-y-4">
          <div className="space-y-2">
            <Label>Type *</Label>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(val) =>
                    field.onChange(val as "purchase" | "sale")
                  }
                >
                  <SelectTrigger>
                    <SelectValue>
                      {field.value === "purchase" ? "Purchase (Buying)" : "Sale (Selling)"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="purchase">Purchase (Buying)</SelectItem>
                    <SelectItem value="sale">Sale (Selling)</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.type && (
              <p className="text-xs text-destructive">{errors.type.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Party *</Label>
            <Controller
              name="partyId"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select party"
                  searchPlaceholder="Search parties..."
                  options={
                    partiesData?.data.map((p) => ({
                      value: p._id,
                      label: p.name,
                    })) ?? []
                  }
                />
              )}
            />
            {errors.partyId && (
              <p className="text-xs text-destructive">
                {errors.partyId.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Product *</Label>
            <Controller
              name="productId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(val: string | null) => field.onChange(val ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product">
                      {field.value ? productMap.get(field.value) ?? "Select product" : "Select product"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {productsData?.data.map((p) => (
                      <SelectItem key={p._id} value={p._id}>
                        {p.name} ({p.currentStock} {p.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.productId && (
              <p className="text-xs text-destructive">
                {errors.productId.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity (kg) *</Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                placeholder="0"
                {...register("quantity", { valueAsNumber: true })}
              />
              {errors.quantity && (
                <p className="text-xs text-destructive">
                  {errors.quantity.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ratePerKg">Rate/kg *</Label>
              <Input
                id="ratePerKg"
                type="number"
                step="0.01"
                placeholder="0"
                {...register("ratePerKg", { valueAsNumber: true })}
              />
              {errors.ratePerKg && (
                <p className="text-xs text-destructive">
                  {errors.ratePerKg.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paidAmount">Paid Amount</Label>
            <Input
              id="paidAmount"
              type="number"
              step="0.01"
              placeholder="0"
              {...register("paidAmount", { valueAsNumber: true })}
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
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder="Optional notes"
              {...register("notes")}
            />
          </div>
        </div>

        {/* Summary */}
        <div className="glass-card rounded-2xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Amount</span>
            <span className="font-semibold">
              {formatNepaliCurrency(totalAmount)}
            </span>
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
          disabled={createTxn.isPending}
        >
          {createTxn.isPending ? "Recording..." : "Record Transaction"}
        </Button>
      </form>
    </FormDrawerPage>
  );
}
