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
  updatePartySchema,
  UpdatePartyFormValues,
} from "@/app/features/parties/schema";
import {
  useParty,
  useUpdateParty,
} from "@/app/features/parties/hooks/useParties";

export default function EditPartyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: party, isLoading } = useParty(id);
  const updateParty = useUpdateParty(id);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<UpdatePartyFormValues>({
    resolver: standardSchemaResolver(updatePartySchema),
  });

  useEffect(() => {
    if (party) {
      reset({
        name: party.name,
        phone: party.phone ?? "",
        address: party.address ?? "",
        category: party.category,
        openingBalance: party.openingBalance,
      });
    }
  }, [party, reset]);

  const onSubmit = (data: UpdatePartyFormValues) => {
    updateParty.mutate(data, {
      onSuccess: () => router.push(`/parties/${id}`),
    });
  };

  if (isLoading) return <DetailSkeleton />;

  return (
    <FormDrawerPage title="Edit Party" subtitle="Update party details" back>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="glass-card rounded-2xl p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="Party name" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              placeholder="Phone number"
              type="tel"
              {...register("phone")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              placeholder="Address"
              rows={2}
              {...register("address")}
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              defaultValue={party?.category}
              onValueChange={(val) =>
                setValue("category", val as "supplier" | "customer" | "both")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="supplier">Supplier</SelectItem>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="openingBalance">Opening Balance</Label>
            <Input
              id="openingBalance"
              type="number"
              step="0.01"
              {...register("openingBalance", { valueAsNumber: true })}
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={updateParty.isPending}
        >
          {updateParty.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </form>
    </FormDrawerPage>
  );
}
