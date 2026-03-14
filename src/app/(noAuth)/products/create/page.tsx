"use client";

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
import {
  createProductSchema,
  CreateProductFormValues,
} from "@/app/features/products/schema";
import { useCreateProduct } from "@/app/features/products/hooks/useProducts";

export default function CreateProductPage() {
  const router = useRouter();
  const createProduct = useCreateProduct();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CreateProductFormValues>({
    resolver: standardSchemaResolver(createProductSchema),
    defaultValues: { unit: "kg", currentStock: 0 },
  });

  const onSubmit = (data: CreateProductFormValues) => {
    createProduct.mutate(data, {
      onSuccess: () => router.push("/products"),
    });
  };

  return (
    <FormDrawerPage title="Add Product" subtitle="Create a product entry" back>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="glass-card rounded-2xl p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" placeholder="Product name" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Unit</Label>
            <Select
              defaultValue="kg"
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

          <div className="space-y-2">
            <Label htmlFor="currentStock">Initial Stock</Label>
            <Input
              id="currentStock"
              type="number"
              step="0.01"
              placeholder="0"
              {...register("currentStock", { valueAsNumber: true })}
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={createProduct.isPending}
        >
          {createProduct.isPending ? "Creating..." : "Create Product"}
        </Button>
      </form>
    </FormDrawerPage>
  );
}
