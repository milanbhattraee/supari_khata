"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Users, Phone, MapPin, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { ListSkeleton } from "@/components/skeletons";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { useParties } from "@/app/features/parties/hooks/useParties";
import { formatNepaliCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const categoryColors: Record<string, string> = {
  supplier: "bg-blue-500/10 text-blue-600",
  customer: "bg-green-500/10 text-green-600",
  both: "bg-purple-500/10 text-purple-600",
};

export default function PartiesPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch } = useParties(
    search ? { search, page: String(page) } : { page: String(page) }
  );

  return (
    <>
      <PageHeader
        title="Parties"
        subtitle="Suppliers & Customers"
        action={
          <Link href="/parties/create">
            <Button size="icon" className="h-8 w-8 rounded-full">
              <Plus className="h-4 w-4" />
            </Button>
          </Link>
        }
      />

      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search parties..."
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
          icon={<Users className="h-7 w-7" />}
          title="No parties yet"
          description="Add your first supplier or customer to get started"
          action={
            <Link href="/parties/create">
              <Button size="sm" className="gap-2 rounded-xl">
                <Plus className="h-4 w-4" />
                Add Party
              </Button>
            </Link>
          }
        />
      )}

      {data && data.data.length > 0 && (
        <div className="px-4 pb-4">
          <div className="glass-card rounded-2xl overflow-hidden">
            {data.data.map((party, i) => (
              <Link key={party._id} href={`/parties/${party._id}`}>
                <div
                  className="flex items-center gap-3 px-4 py-3.5 active:bg-foreground/5 transition-colors"
                  style={{
                    borderBottom: i < data.data.length - 1
                      ? "0.5px solid oklch(0 0 0 / 6%)"
                      : "none",
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[15px] font-medium truncate">{party.name}</h3>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px] capitalize shrink-0 border-0",
                          categoryColors[party.category]
                        )}
                      >
                        {party.category}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground">
                      {party.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {party.phone}
                        </span>
                      )}
                      {party.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {party.address}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-3">
                    <div className="flex flex-col items-end justify-center">
                      {(() => {
                        const net = party.balance?.net ?? party.openingBalance;
                        if (net > 0) {
                          return (
                            <>
                              <span className="text-[10px] text-green-600 font-medium uppercase tracking-wider mb-0.5">To Receive</span>
                              <p className="text-[14px] font-semibold text-green-600">
                                {formatNepaliCurrency(net)}
                              </p>
                            </>
                          );
                        } else if (net < 0) {
                          return (
                            <>
                              <span className="text-[10px] text-red-500 font-medium uppercase tracking-wider mb-0.5">To Pay</span>
                              <p className="text-[14px] font-semibold text-red-500">
                                {formatNepaliCurrency(Math.abs(net))}
                              </p>
                            </>
                          );
                        } else {
                          return (
                            <>
                              <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider mb-0.5">Settled</span>
                              <p className="text-[13px] font-medium text-gray-500">
                                Rs. 0.00
                              </p>
                            </>
                          );
                        }
                      })()}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                  </div>
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
