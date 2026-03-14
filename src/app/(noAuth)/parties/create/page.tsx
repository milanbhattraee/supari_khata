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
  createPartySchema,
  CreatePartyFormValues,
} from "@/app/features/parties/schema";
import { useCreateParty } from "@/app/features/parties/hooks/useParties";

export default function CreatePartyPage() {
  const router = useRouter();
  const createParty = useCreateParty();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<CreatePartyFormValues>({
    resolver: standardSchemaResolver(createPartySchema),
    defaultValues: {
      category: "both",
      openingBalance: 0,
    },
  });

  const onSubmit = (data: CreatePartyFormValues) => {
    createParty.mutate(data, {
      onSuccess: () => router.push("/parties"),
    });
  };

  return (
    <FormDrawerPage title="Add Party" subtitle="Create a new supplier or customer" back>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="glass-card rounded-2xl p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="Party name"
              {...register("name")}
            />
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
            <Label>Category *</Label>
            <Select
              defaultValue="both"
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
            {errors.category && (
              <p className="text-xs text-destructive">
                {errors.category.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="openingBalance">Opening Balance</Label>
            <Input
              id="openingBalance"
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register("openingBalance", { valueAsNumber: true })}
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={createParty.isPending}
        >
          {createParty.isPending ? "Creating..." : "Create Party"}
        </Button>
      </form>
    </FormDrawerPage>
  );
}
