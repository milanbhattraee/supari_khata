"use client";

import Link from "next/link";
import {
  Users,
  Package,
  ArrowLeftRight,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  AlertTriangle,
  Factory,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { ListSkeleton } from "@/components/skeletons";
import { ErrorState } from "@/components/empty-state";
import { useDashboard } from "@/app/features/dashboard/hooks/useDashboard";
import { formatNepaliCurrency, formatNumber, todayNepali } from "@/lib/format";

export default function DashboardPage() {
  const { data, isLoading, error, refetch } = useDashboard();

  if (isLoading) return <ListSkeleton count={4} />;
  if (error)
    return <ErrorState message={error.message} onRetry={() => refetch()} />;
  if (!data) return null;

  return (
    <>
      <PageHeader
        title="सुपारी खाता"
        subtitle={todayNepali()}
      />

      <div className="space-y-4 p-4">
        {/* Quick Stats — iOS widget grid */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/parties">
            <div className="glass-card rounded-2xl p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 mb-2.5">
                <Users className="h-[18px] w-[18px] text-blue-600" />
              </div>
              <p className="text-2xl font-bold tracking-tight">{data.totalParties}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Parties</p>
            </div>
          </Link>

          <Link href="/products">
            <div className="glass-card rounded-2xl p-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 mb-2.5">
                <Package className="h-[18px] w-[18px] text-purple-600" />
              </div>
              <p className="text-2xl font-bold tracking-tight">{data.totalProducts}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Products</p>
            </div>
          </Link>
        </div>

        {/* Today's Activity — grouped card */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 pt-4 pb-3">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="text-[13px] font-semibold">Today&apos;s Activity</h3>
          </div>
          <div className="grid grid-cols-3 gap-px bg-border/30">
            <div className="bg-background/40 p-3.5 text-center">
              <p className="text-xl font-bold">{data.totalTransactionsToday}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Total</p>
            </div>
            <div className="bg-background/40 p-3.5 text-center">
              <p className="text-xl font-bold text-red-500">{data.totalPurchasesToday}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Purchases</p>
            </div>
            <div className="bg-background/40 p-3.5 text-center">
              <p className="text-xl font-bold text-green-600">{data.totalSalesToday}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Sales</p>
            </div>
          </div>
        </div>

        {/* Outstanding Balance */}
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <h3 className="text-[13px] font-semibold">Outstanding Balance</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-green-500/8 p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <ArrowDownLeft className="h-3.5 w-3.5 text-green-600" />
                <span className="text-[11px] text-muted-foreground">To Receive</span>
              </div>
              <p className="text-[15px] font-bold text-green-700 dark:text-green-400">
                {formatNepaliCurrency(data.totalOutstandingReceivable)}
              </p>
            </div>
            <div className="rounded-xl bg-red-500/8 p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <ArrowUpRight className="h-3.5 w-3.5 text-red-500" />
                <span className="text-[11px] text-muted-foreground">To Pay</span>
              </div>
              <p className="text-[15px] font-bold text-red-600 dark:text-red-400">
                {formatNepaliCurrency(data.totalOutstandingPayable)}
              </p>
            </div>
          </div>
        </div>

        {/* Low Stock — iOS grouped list */}
        {data.lowStockProducts.length > 0 && (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 pt-4 pb-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <h3 className="text-[13px] font-semibold">Low Stock Alert</h3>
            </div>
            {data.lowStockProducts.map((product, i) => (
              <Link key={product._id} href={`/products/${product._id}`}>
                <div className="flex items-center justify-between px-4 py-3 active:bg-foreground/5"
                  style={{
                    borderBottom: i < data.lowStockProducts.length - 1
                      ? "0.5px solid oklch(0 0 0 / 6%)"
                      : "none",
                  }}
                >
                  <span className="text-[15px]">{product.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="bg-orange-500/10 text-orange-600 border-0 text-xs"
                    >
                      {formatNumber(product.currentStock, 1)} {product.unit}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Quick Actions — iOS widget grid */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/transactions/create">
            <div className="glass-card rounded-2xl p-4 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 mb-2">
                <ArrowLeftRight className="h-5 w-5 text-primary" />
              </div>
              <p className="text-xs font-medium">New Transaction</p>
            </div>
          </Link>
          <Link href="/payments/create">
            <div className="glass-card rounded-2xl p-4 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10 mb-2">
                <Wallet className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-xs font-medium">Record Payment</p>
            </div>
          </Link>
          <Link href="/production/create">
            <div className="glass-card rounded-2xl p-4 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 mb-2">
                <Factory className="h-5 w-5 text-orange-600" />
              </div>
              <p className="text-xs font-medium">New Production</p>
            </div>
          </Link>
          <Link href="/parties/create">
            <div className="glass-card rounded-2xl p-4 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 mb-2">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-xs font-medium">Add Party</p>
            </div>
          </Link>
        </div>
      </div>
    </>
  );
}
