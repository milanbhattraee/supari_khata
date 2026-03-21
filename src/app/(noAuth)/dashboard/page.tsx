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
  IndianRupee,
  Receipt,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { ListSkeleton } from "@/components/skeletons";
import { ErrorState } from "@/components/empty-state";
import { useDashboard } from "@/app/features/dashboard/hooks/useDashboard";
import { CashflowChart } from "@/components/cashflow-chart";
import { formatDashboardCurrency, formatNumber, todayNepali } from "@/lib/format";

export default function DashboardPage() {
  const { data, isLoading, error, refetch } = useDashboard();

  if (isLoading) return <ListSkeleton count={4} />;
  if (error)
    return <ErrorState message={error.message} onRetry={() => refetch()} />;
  if (!data) return null;

  return (
    <>
      <PageHeader
        title="Supari Khata"
        subtitle={todayNepali()}
      />

      <div className="space-y-4 p-4">
        {/* Quick Stats */}
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

        {/* ── Section 1: Financial Summary (This Year) ────────────────────
             P&L metrics - how much was bought/sold this year.
             Uses totalAmount (full trade value). */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 pt-4 pb-3">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="text-[13px] font-semibold">Financial Summary <span className="font-normal text-muted-foreground">(This Year)</span></h3>
          </div>

          {/* Purchases & Sales */}
          <div className="grid grid-cols-2 gap-px bg-border/30">
            <div className="bg-background/40 p-3.5">
              <p className="text-[10px] text-muted-foreground mb-1">Total Purchases</p>
              <p className="text-[15px] font-bold text-red-500">{formatDashboardCurrency(data.totalPurchasesYearly)}</p>
            </div>
            <div className="bg-background/40 p-3.5">
              <p className="text-[10px] text-muted-foreground mb-1">Total Sales</p>
              <p className="text-[15px] font-bold text-green-600">{formatDashboardCurrency(data.totalSalesYearly)}</p>
            </div>
          </div>

          {/* Profit/Loss */}
          <div className="border-t border-border/30 bg-background/40 px-4 py-3 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Gross Profit / Loss</span>
            <span className={`text-[14px] font-bold ${data.grossProfitYearly >= 0 ? "text-green-600" : "text-red-500"}`}>
              {formatDashboardCurrency(data.grossProfitYearly)}
            </span>
          </div>

          {/* Total Expenses */}
          <Link href="/expenses">
            <div className="border-t border-border/30 bg-background/40 px-4 py-3 flex items-center justify-between active:bg-foreground/5">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Receipt className="h-3 w-3 text-red-500" />
                Total Expenses
              </span>
              <span className="text-[14px] font-bold text-red-500">
                {formatDashboardCurrency(data.totalExpensesYearly)}
              </span>
            </div>
          </Link>

          {/* Net Profit */}
          <div className="border-t border-border/30 bg-primary/5 px-4 py-3 flex items-center justify-between">
            <span className="text-[11px] font-medium">Net Profit / Loss</span>
            <span className={`text-[15px] font-bold ${data.netProfitYearly >= 0 ? "text-green-600" : "text-red-500"}`}>
              {formatDashboardCurrency(data.netProfitYearly)}
            </span>
          </div>
        </div>

        {/* ── Section 2: Outstanding Balance (All-Time) ─────────────────
             Sum of all party ledger balances - matches party pages exactly.
             Uses: openingBalance + transactionDues - standalonePayments */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 pt-4 pb-3">
            <ArrowLeftRight className="h-4 w-4 text-primary" />
            <h3 className="text-[13px] font-semibold">Outstanding Balance <span className="font-normal text-muted-foreground">(All Parties)</span></h3>
          </div>

          <div className="grid grid-cols-2 gap-px bg-border/30">
            <div className="bg-background/40 p-3.5">
              <div className="flex items-center gap-1 mb-1">
                <ArrowDownLeft className="h-3 w-3 text-green-600" />
                <p className="text-[10px] text-muted-foreground">To Receive</p>
              </div>
              <p className="text-[15px] font-bold text-green-700 dark:text-green-400">{formatDashboardCurrency(data.totalOutstandingReceivable)}</p>
            </div>
            <div className="bg-background/40 p-3.5">
              <div className="flex items-center gap-1 mb-1">
                <ArrowUpRight className="h-3 w-3 text-red-500" />
                <p className="text-[10px] text-muted-foreground">To Pay</p>
              </div>
              <p className="text-[15px] font-bold text-red-600 dark:text-red-400">{formatDashboardCurrency(data.totalOutstandingPayable)}</p>
            </div>
          </div>
        </div>

        {/* ── Section: Products Stock ────────────────────────────────────
             Current stock levels for all products */}
        {data.allProducts.length > 0 && (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 pt-4 pb-2">
              <Package className="h-4 w-4 text-purple-600" />
              <h3 className="text-[13px] font-semibold">Products Stock</h3>
            </div>
            {data.allProducts.map((product, i) => (
              <Link key={product._id} href={`/products/${product._id}`}>
                <div className="flex items-center justify-between px-4 py-3 active:bg-foreground/5"
                  style={{
                    borderBottom: i < data.allProducts.length - 1
                      ? "0.5px solid oklch(0 0 0 / 6%)"
                      : "none",
                  }}
                >
                  <span className="text-[15px]">{product.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={`border-0 text-xs ${
                        product.currentStock < 100
                          ? "bg-orange-500/10 text-orange-600"
                          : "bg-purple-500/10 text-purple-600"
                      }`}
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

        {/* ── Section 2: Cash Position ────────────────────────────────────
             Actual cash movement — money that physically came in/went out.
             Uses paidAmount from transactions + standalone payments. */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 pt-4 pb-3">
            <IndianRupee className="h-4 w-4 text-primary" />
            <h3 className="text-[13px] font-semibold">Cash Position <span className="font-normal text-muted-foreground">(This Year)</span></h3>
          </div>

          <div className="grid grid-cols-2 gap-px bg-border/30">
            <div className="bg-background/40 p-3.5">
              <p className="text-[10px] text-muted-foreground mb-1">Payments Received</p>
              <p className="text-[15px] font-bold text-emerald-600">{formatDashboardCurrency(data.totalMoneyInYearly)}</p>
            </div>
            <div className="bg-background/40 p-3.5">
              <p className="text-[10px] text-muted-foreground mb-1">Payments Made</p>
              <p className="text-[15px] font-bold text-red-500">{formatDashboardCurrency(data.totalMoneyOutYearly)}</p>
            </div>
          </div>

          <div className="border-t border-border/30 bg-background/40 px-4 py-3 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Net Cash {data.netCashflowYearly >= 0 ? "Surplus" : "Deficit"}</span>
            <span className={`text-[14px] font-bold ${data.netCashflowYearly >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {formatDashboardCurrency(data.netCashflowYearly)}
            </span>
          </div>
        </div>

        {/* ── Section 3: Cashflow Trend ─────────────────────────────────────
             Daily/monthly trend chart — shows the pattern of cash movement.
             Cash Position above = yearly totals. This = daily/monthly breakdown. */}
        <CashflowChart data={data.cashflow} />

        {/* Low Stock Alert */}
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

        {/* Quick Actions */}
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
          <Link href="/expenses/create">
            <div className="glass-card rounded-2xl p-4 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 mb-2">
                <Receipt className="h-5 w-5 text-red-600" />
              </div>
              <p className="text-xs font-medium">Record Expense</p>
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
