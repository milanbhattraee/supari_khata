"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormDrawerPage } from "@/components/form-drawer-page";
import { DetailSkeleton } from "@/components/skeletons";
import {
  updateProductSchema,
  UpdateProductFormValues,
} from "@/app/features/products/schema";
import {
  useProduct,
  useUpdateProduct,
} from "@/app/features/products/hooks/useProducts";

export default function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: product, isLoading } = useProduct(id);
  const updateProduct = useUpdateProduct(id);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<UpdateProductFormValues>({
    resolver: standardSchemaResolver(updateProductSchema),
  });

  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        unit: product.unit,
        description: product.description ?? "",
      });
    }
  }, [product, reset]);

  const onSubmit = (data: UpdateProductFormValues) => {
    updateProduct.mutate(data, {
      onSuccess: () => router.push(`/products/${id}`),
    });
  };

  if (isLoading) return <DetailSkeleton />;

  return (
    <FormDrawerPage title="Edit Product" subtitle="Update product details" back>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="glass-card rounded-2xl p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="Product name" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Unit</Label>
            <Select
              defaultValue={product?.unit}
              onValueChange={(val) =>
                setValue("unit", val as "kg" | "quintal")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kg">KG</SelectItem>
                <SelectItem value="quintal">Quintal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional description"
              rows={2}
              {...register("description")}
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={updateProduct.isPending}
        >
          {updateProduct.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </form>
    </FormDrawerPage>
  );
}
