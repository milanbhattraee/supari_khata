"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { DetailSkeleton } from "@/components/skeletons";
import { ErrorState } from "@/components/empty-state";
import {
  useProduct,
  useDeleteProduct,
} from "@/app/features/products/hooks/useProducts";
import { formatNumber } from "@/lib/format";
import { toNepaliDate } from "@/lib/format";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { data: product, isLoading, error, refetch } = useProduct(id);
  const deleteProduct = useDeleteProduct();

  const handleDelete = () => {
    deleteProduct.mutate(id, {
      onSuccess: () => router.push("/products"),
    });
  };

  if (isLoading) return <DetailSkeleton />;
  if (error)
    return <ErrorState message={error.message} onRetry={() => refetch()} />;
  if (!product) return null;

  return (
    <>
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        variant="destructive"
        title="Delete Product?"
        description="This product will be deactivated if it has transaction history. Otherwise, it will be permanently deleted."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={deleteProduct.isPending}
        onConfirm={handleDelete}
      />

      <PageHeader
        title={product.name}
        back
        action={
          <div className="flex gap-2">
            <Link href={`/products/${id}/edit`}>
              <Button variant="ghost" size="icon">
                <Pencil className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={() => setShowDeleteDialog(true)}
              disabled={deleteProduct.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <div className="space-y-4 p-4">
        <div className="glass-card rounded-2xl p-5 text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10">
            <Package className="h-7 w-7 text-blue-600" />
          </div>
          <p
            className={`text-3xl font-bold ${
              product.currentStock <= 10 ? "text-red-500" : ""
            }`}
          >
            {formatNumber(product.currentStock, 1)}
          </p>
          <p className="text-[13px] text-muted-foreground">
            {product.unit} in stock
          </p>
        </div>

        <div className="glass-card rounded-2xl overflow-hidden">
          <div
            className="flex justify-between items-center px-4 py-3 text-[15px]"
          >
            <span className="text-muted-foreground">Unit</span>
            <Badge variant="secondary" className="uppercase">
              {product.unit}
            </Badge>
          </div>
          {product.description && (
            <div
              className="flex justify-between items-center px-4 py-3 text-[15px]"
              style={{ borderTop: "0.5px solid oklch(0 0 0 / 6%)" }}
            >
              <span className="text-muted-foreground">Description</span>
              <span>{product.description}</span>
            </div>
          )}
          <div
            className="flex justify-between items-center px-4 py-3 text-[15px]"
            style={{ borderTop: "0.5px solid oklch(0 0 0 / 6%)" }}
          >
            <span className="text-muted-foreground">Status</span>
            <Badge variant={product.isActive ? "default" : "destructive"}>
              {product.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <div
            className="flex justify-between items-center px-4 py-3 text-[15px]"
            style={{ borderTop: "0.5px solid oklch(0 0 0 / 6%)" }}
          >
            <span className="text-muted-foreground">Added</span>
            <span>{toNepaliDate(product.createdAt)}</span>
          </div>
        </div>
      </div>
    </>
  );
}
