"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { Plus, Search, Receipt, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { ListSkeleton } from "@/components/skeletons";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { useExpenses } from "@/app/features/expenses/hooks/useExpenses";
import { formatNepaliCurrency, toNepaliDate } from "@/lib/format";

export default function ExpensesPage() {
  return (
    <Suspense>
      <ExpensesContent />
    </Suspense>
  );
}

function ExpensesContent() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const params: Record<string, string> = { page: String(page) };
  if (search) params.search = search;

  const { data, isLoading, error, refetch } = useExpenses(params);

  return (
    <>
      <PageHeader
        title="Expenses"
        subtitle="Business expenses"
        action={
          <Link href="/expenses/create">
            <Button size="icon" className="h-9 w-9 rounded-full">
              <Plus className="h-4 w-4" />
            </Button>
          </Link>
        }
      />

      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search expenses..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 ios-input"
          />
        </div>
      </div>

      {isLoading && <ListSkeleton />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}

      {data && data.data.length === 0 && (
        <EmptyState
          icon={<Receipt className="h-7 w-7" />}
          title="No expenses"
          description="Record your business expenses"
          action={
            <Link href="/expenses/create">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Expense
              </Button>
            </Link>
          }
        />
      )}

      {data && data.data.length > 0 && (
        <div className="px-4 pb-4">
          <div className="glass-card rounded-2xl overflow-hidden">
            {data.data.map((expense, i) => (
              <Link key={expense._id} href={`/expenses/${expense._id}`}>
                <div
                  className="flex items-center gap-3 px-4 py-3 active:bg-foreground/5 transition-colors"
                  style={
                    i < data.data.length - 1
                      ? { borderBottom: "0.5px solid oklch(0 0 0 / 6%)" }
                      : undefined
                  }
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-500/10">
                    <Receipt className="h-[18px] w-[18px] text-red-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium truncate">
                      {expense.description}
                    </p>
                    <p className="text-[13px] text-muted-foreground">
                      {toNepaliDate(expense.date)}
                    </p>
                  </div>
                  <p className="text-[14px] font-semibold shrink-0 mr-1 text-red-600">
                    {formatNepaliCurrency(expense.amount)}
                  </p>
                  <ChevronRight className="h-[18px] w-[18px] text-foreground/20 shrink-0" />
                </div>
              </Link>
            ))}
          </div>

          <PaginationControls
            currentPage={data.meta.page}
            totalPages={data.meta.totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
    </>
  );
}
