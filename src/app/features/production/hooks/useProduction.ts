import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import {
  ProductionEntryResponseDTO,
  CreateProductionEntryDTO,
} from "../types";
import { PaginationMeta } from "@/types/dto";

export function useProductionEntries(params?: Record<string, string>) {
  return useQuery({
    queryKey: ["production", params],
    queryFn: () =>
      api
        .get<ProductionEntryResponseDTO[]>("/production", params)
        .then((res) => ({
          data: res.data!,
          meta: res.meta as PaginationMeta,
        })),
  });
}

export function useProductionEntry(id: string) {
  return useQuery({
    queryKey: ["production", id],
    queryFn: () =>
      api
        .get<ProductionEntryResponseDTO>(`/production/${id}`)
        .then((res) => res.data!),
    enabled: !!id,
  });
}

export function useCreateProductionEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProductionEntryDTO) =>
      api.post<ProductionEntryResponseDTO>("/production", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["production"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Production entry recorded");
    },
    onError: (err) => toast.error(err.message),
  });
}
