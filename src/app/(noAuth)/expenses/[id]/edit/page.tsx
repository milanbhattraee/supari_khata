"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NepaliDatePicker } from "@/components/ui/nepali-date-picker";
import { FormDrawerPage } from "@/components/form-drawer-page";
import { DetailSkeleton } from "@/components/skeletons";
import { ErrorState } from "@/components/empty-state";
import {
  updateExpenseSchema,
  UpdateExpenseFormValues,
} from "@/app/features/expenses/schema";
import {
  useExpense,
  useUpdateExpense,
} from "@/app/features/expenses/hooks/useExpenses";

export default function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: expense, isLoading, error, refetch } = useExpense(id);
  const updateExpense = useUpdateExpense(id);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<UpdateExpenseFormValues>({
    resolver: standardSchemaResolver(updateExpenseSchema),
  });

  useEffect(() => {
    if (expense) {
      reset({
        amount: expense.amount,
        description: expense.description,
        date: expense.date.split("T")[0],
      });
    }
  }, [expense, reset]);

  const onSubmit = (data: UpdateExpenseFormValues) => {
    updateExpense.mutate(data, {
      onSuccess: () => router.push(`/expenses/${id}`),
    });
  };

  if (isLoading) return <DetailSkeleton />;
  if (error)
    return <ErrorState message={error.message} onRetry={() => refetch()} />;
  if (!expense) return null;

  return (
    <FormDrawerPage title="Edit Expense" subtitle="Update expense details" back>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="glass-card rounded-2xl p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount *</Label>
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
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              rows={2}
              placeholder="What was this expense for?"
              {...register("description")}
            />
            {errors.description && (
              <p className="text-xs text-destructive">
                {errors.description.message}
              </p>
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
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={updateExpense.isPending}
        >
          {updateExpense.isPending ? "Updating..." : "Update Expense"}
        </Button>
      </form>
    </FormDrawerPage>
  );
}
