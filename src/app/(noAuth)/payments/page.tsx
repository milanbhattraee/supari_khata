"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, Search, Wallet, ArrowDownLeft, ArrowUpRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { ListSkeleton } from "@/components/skeletons";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { usePayments } from "@/app/features/payments/hooks/usePayments";
import { formatNepaliCurrency, toNepaliDate } from "@/lib/format";
import { PAYMENT_DIRECTION_LABELS } from "@/lib/payment-utils";

const methodLabels: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank",
  cheque: "Cheque",
  upi: "UPI",
  other: "Other",
};

export default function PaymentsPage() {
  return (
    <Suspense>
      <PaymentsContent />
    </Suspense>
  );
}

function PaymentsContent() {
  const searchParams = useSearchParams();
  const partyId = searchParams.get("partyId") ?? "";
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const params: Record<string, string> = { page: String(page) };
  if (search) params.search = search;
  if (partyId) params.partyId = partyId;

  const { data, isLoading, error, refetch } = usePayments(params);

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Payment records"
        action={
          <Link href="/payments/create">
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
            placeholder="Search payments..."
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
          icon={<Wallet className="h-7 w-7" />}
          title="No payments"
          description="Record a payment to settle dues"
          action={
            <Link href="/payments/create">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Record Payment
              </Button>
            </Link>
          }
        />
      )}

      {data && data.data.length > 0 && (
        <div className="px-4 pb-4">
          <div className="glass-card rounded-2xl overflow-hidden">
            {data.data.map((payment, i) => (
              <Link key={payment._id} href={`/payments/${payment._id}`}>
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
                      payment.direction === "payin" ? "bg-green-500/10" : "bg-amber-500/10"
                    }`}
                  >
                    {payment.direction === "payin" ? (
                      <ArrowDownLeft className="h-[18px] w-[18px] text-green-600" />
                    ) : (
                      <ArrowUpRight className="h-[18px] w-[18px] text-amber-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium truncate">
                      {payment.party.name}
                    </p>
                    <p className="text-[13px] text-muted-foreground">
                      {PAYMENT_DIRECTION_LABELS[payment.direction]} &middot; {methodLabels[payment.method]} &middot;{" "}
                      {toNepaliDate(payment.date)}
                    </p>
                  </div>
                  <p className={`text-[14px] font-semibold shrink-0 mr-1 ${payment.direction === "payin" ? "text-green-600" : "text-amber-600"}`}>
                    {formatNepaliCurrency(payment.amount)}
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
