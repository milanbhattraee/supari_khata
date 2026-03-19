"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Receipt, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { DetailSkeleton } from "@/components/skeletons";
import { ErrorState } from "@/components/empty-state";
import {
  useExpense,
  useDeleteExpense,
} from "@/app/features/expenses/hooks/useExpenses";
import { formatNepaliCurrency, toNepaliDate } from "@/lib/format";

export default function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { data: expense, isLoading, error, refetch } = useExpense(id);
  const deleteExpense = useDeleteExpense();

  const handleDelete = () => {
    deleteExpense.mutate(id, {
      onSuccess: () => router.push("/expenses"),
    });
  };

  if (isLoading) return <DetailSkeleton />;
  if (error)
    return <ErrorState message={error.message} onRetry={() => refetch()} />;
  if (!expense) return null;

  return (
    <>
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        variant="destructive"
        title="Delete Expense?"
        description="This expense will be permanently deleted."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={deleteExpense.isPending}
        onConfirm={handleDelete}
      />

      <PageHeader
        title="Expense Detail"
        back
        action={
          <div className="flex gap-2">
            <Link href={`/expenses/${id}/edit`}>
              <Button variant="ghost" size="icon">
                <Pencil className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={() => setShowDeleteDialog(true)}
              disabled={deleteExpense.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="space-y-4 p-4">
        <div className="glass-card rounded-2xl p-5 text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
            <Receipt className="h-7 w-7 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-red-600">
            {formatNepaliCurrency(expense.amount)}
          </p>
          <p className="text-[13px] text-muted-foreground">
            {toNepaliDate(expense.date)}
          </p>
        </div>

        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-4 py-3">
            <p className="text-[12px] text-muted-foreground mb-1">Description</p>
            <p className="text-[15px]">{expense.description}</p>
          </div>
        </div>
      </div>
    </>
  );
}
