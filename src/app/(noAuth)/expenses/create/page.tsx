"use client";

import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NepaliDatePicker } from "@/components/ui/nepali-date-picker";
import { FormDrawerPage } from "@/components/form-drawer-page";
import {
  createExpenseSchema,
  CreateExpenseFormValues,
} from "@/app/features/expenses/schema";
import { useCreateExpense } from "@/app/features/expenses/hooks/useExpenses";

export default function CreateExpensePage() {
  const router = useRouter();
  const createExpense = useCreateExpense();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateExpenseFormValues>({
    resolver: standardSchemaResolver(createExpenseSchema),
    defaultValues: {
      amount: undefined,
      description: "",
    },
  });

  const onSubmit = (data: CreateExpenseFormValues) => {
    createExpense.mutate(data, {
      onSuccess: () => router.push("/expenses"),
    });
  };

  return (
    <FormDrawerPage title="Add Expense" subtitle="Record a business expense" back>
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
          disabled={createExpense.isPending}
        >
          {createExpense.isPending ? "Recording..." : "Record Expense"}
        </Button>
      </form>
    </FormDrawerPage>
  );
}
