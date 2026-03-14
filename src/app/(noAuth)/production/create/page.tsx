"use client";

import { useRouter } from "next/navigation";
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
import {
  createProductionSchema,
  CreateProductionFormValues,
} from "@/app/features/production/schema";
import { useCreateProductionEntry } from "@/app/features/production/hooks/useProduction";
import { useProducts } from "@/app/features/products/hooks/useProducts";
import { formatNumber } from "@/lib/format";

export default function CreateProductionPage() {
  const router = useRouter();
  const createEntry = useCreateProductionEntry();
  const { data: productsData, isLoading } = useProducts();

  const {
    register,
    handleSubmit,
    setValue,
    control,
    watch,
    formState: { errors },
  } = useForm<CreateProductionFormValues>({
    resolver: standardSchemaResolver(createProductionSchema),
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const inputQty = watch("inputQuantity") || 0;
  const outputQty = watch("outputQuantity") || 0;
  const loss = Math.max(0, inputQty - outputQty);

  const onSubmit = (data: CreateProductionFormValues) => {
    createEntry.mutate(data, {
      onSuccess: () => router.push("/production"),
    });
  };

  if (isLoading) return <ListSkeleton count={3} />;

  return (
    <FormDrawerPage title="New Production Entry" subtitle="Track raw input and processed output" back>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="glass-card rounded-2xl p-4 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground">
            INPUT (Raw Material)
          </h3>

          <div className="space-y-2">
            <Label>Product *</Label>
            <Select
              onValueChange={(val: string | null) => val && setValue("inputProductId", val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select input product" />
              </SelectTrigger>
              <SelectContent>
                {productsData?.data.map((p) => (
                  <SelectItem key={p._id} value={p._id}>
                    {p.name} ({formatNumber(p.currentStock, 1)} {p.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.inputProductId && (
              <p className="text-xs text-destructive">
                {errors.inputProductId.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="inputQuantity">Quantity (kg) *</Label>
            <Input
              id="inputQuantity"
              type="number"
              step="0.01"
              placeholder="0"
              {...register("inputQuantity", { valueAsNumber: true })}
            />
            {errors.inputQuantity && (
              <p className="text-xs text-destructive">
                {errors.inputQuantity.message}
              </p>
            )}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4 space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground">
            OUTPUT (Processed)
          </h3>

          <div className="space-y-2">
            <Label>Product *</Label>
            <Select
              onValueChange={(val: string | null) => val && setValue("outputProductId", val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select output product" />
              </SelectTrigger>
              <SelectContent>
                {productsData?.data.map((p) => (
                  <SelectItem key={p._id} value={p._id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.outputProductId && (
              <p className="text-xs text-destructive">
                {errors.outputProductId.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="outputQuantity">Quantity (kg) *</Label>
            <Input
              id="outputQuantity"
              type="number"
              step="0.01"
              placeholder="0"
              {...register("outputQuantity", { valueAsNumber: true })}
            />
            {errors.outputQuantity && (
              <p className="text-xs text-destructive">
                {errors.outputQuantity.message}
              </p>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="glass-card rounded-2xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Yield Loss</span>
            <span className="font-semibold text-orange-600">
              {formatNumber(loss, 1)} kg
            </span>
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

        <Button
          type="submit"
          className="w-full"
          disabled={createEntry.isPending}
        >
          {createEntry.isPending ? "Recording..." : "Record Production"}
        </Button>
      </form>
    </FormDrawerPage>
  );
}
