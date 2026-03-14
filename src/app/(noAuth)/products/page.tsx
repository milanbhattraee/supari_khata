"use client";

import Link from "next/link";
import { Plus, Package, Search, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { ListSkeleton } from "@/components/skeletons";
import { EmptyState, ErrorState } from "@/components/empty-state";
import { useProducts } from "@/app/features/products/hooks/useProducts";
import { formatNumber } from "@/lib/format";

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading, error, refetch } = useProducts(
    search ? { search } : undefined
  );

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Manage your inventory"
        action={
          <Link href="/products/create">
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
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 ios-input"
          />
        </div>
      </div>

      {isLoading && <ListSkeleton />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}

      {data && data.data.length === 0 && (
        <EmptyState
          icon={<Package className="h-7 w-7" />}
          title="No products yet"
          description="Add your first product to start tracking inventory"
          action={
            <Link href="/products/create">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Product
              </Button>
            </Link>
          }
        />
      )}

      {data && data.data.length > 0 && (
        <div className="px-4 pb-4">
          <div className="glass-card rounded-2xl overflow-hidden">
            {data.data.map((product, i) => (
              <Link key={product._id} href={`/products/${product._id}`}>
                <div
                  className="flex items-center gap-3 px-4 py-3 active:bg-foreground/5 transition-colors"
                  style={
                    i < data.data.length - 1
                      ? { borderBottom: "0.5px solid oklch(0 0 0 / 6%)" }
                      : undefined
                  }
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
                    <Package className="h-[18px] w-[18px] text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium truncate">
                      {product.name}
                    </p>
                    <p className="text-[13px] text-muted-foreground">
                      {product.unit} &middot;{" "}
                      <span
                        className={
                          product.currentStock <= 10
                            ? "text-red-500 font-medium"
                            : ""
                        }
                      >
                        {formatNumber(product.currentStock, 1)} in stock
                      </span>
                    </p>
                  </div>
                  <ChevronRight className="h-[18px] w-[18px] text-foreground/20 shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
