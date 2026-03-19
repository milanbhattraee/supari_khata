"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Search,
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { ListSkeleton } from "@/components/skeletons";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { useTransactions } from "@/app/features/transactions/hooks/useTransactions";
import { formatNepaliCurrency, toNepaliDate } from "@/lib/format";

export default function TransactionsPage() {
  return (
    <Suspense>
      <TransactionsContent />
    </Suspense>
  );
}

function TransactionsContent() {
  const searchParams = useSearchParams();
  const partyId = searchParams.get("partyId") ?? "";
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const params: Record<string, string> = { page: String(page) };
  if (search) params.search = search;
  if (typeFilter !== "all") params.type = typeFilter;
  if (partyId) params.partyId = partyId;

  const { data, isLoading, error, refetch } = useTransactions(params);

  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle="Purchases & Sales"
        action={
          <Link href="/transactions/create">
            <Button size="icon" className="h-9 w-9 rounded-full">
              <Plus className="h-4 w-4" />
            </Button>
          </Link>
        }
      />

      <div className="px-4 space-y-3 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 ios-input"
          />
        </div>

        <Tabs value={typeFilter} onValueChange={(val) => { setTypeFilter(val); setPage(1); }}>
          <TabsList className="w-full glass-card">
            <TabsTrigger value="all" className="flex-1">
              All
            </TabsTrigger>
            <TabsTrigger value="purchase" className="flex-1">
              Purchase
            </TabsTrigger>
            <TabsTrigger value="sale" className="flex-1">
              Sale
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading && <ListSkeleton />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}

      {data && data.data.length === 0 && (
        <EmptyState
          icon={<ArrowLeftRight className="h-7 w-7" />}
          title="No transactions"
          description="Record your first purchase or sale"
          action={
            <Link href="/transactions/create">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                New Transaction
              </Button>
            </Link>
          }
        />
      )}

      {data && data.data.length > 0 && (
        <div className="px-4 pb-4">
          <div className="glass-card rounded-2xl overflow-hidden">
            {data.data.map((txn, i) => (
              <Link key={txn._id} href={`/transactions/${txn._id}`}>
                <div
                  className="flex items-center gap-3 px-4 py-3 active:bg-foreground/5 transition-colors"
                  style={
                    i < data.data.length - 1
                      ? { borderBottom: "0.5px solid oklch(0 0 0 / 6%)" }
                      : undefined
                  }
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      txn.type === "purchase"
                        ? "bg-red-500/10"
                        : "bg-green-500/10"
                    }`}
                  >
                    {txn.type === "purchase" ? (
                      <ArrowUpRight className="h-[18px] w-[18px] text-red-500" />
                    ) : (
                      <ArrowDownLeft className="h-[18px] w-[18px] text-green-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium text-wrap break-words">
                      {txn.party.name}
                    </p>
                    <p className="text-[13px] text-muted-foreground text-wrap break-words">
                      {txn.product.name} &middot; {txn.quantity} {txn.product.unit} &middot;{" "}
                      {toNepaliDate(txn.date)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 mr-1">
                    <p className="text-[14px] font-semibold">
                      {formatNepaliCurrency(txn.totalAmount)}
                    </p>
                    <p
                      className={`text-[11px] ${
                        txn.balanceAmount > 0 ? "text-red-500" : "text-green-600"
                      }`}
                    >
                      {txn.balanceAmount > 0
                        ? `Unpaid: ${formatNepaliCurrency(txn.balanceAmount)}`
                        : "Settled"}
                    </p>
                  </div>
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
