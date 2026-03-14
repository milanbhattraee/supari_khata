import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { ProductResponseDTO, CreateProductDTO, UpdateProductDTO } from "../types";
import { PaginationMeta } from "@/types/dto";

export function useProducts(params?: Record<string, string>) {
  return useQuery({
    queryKey: ["products", params],
    queryFn: () =>
      api.get<ProductResponseDTO[]>("/products", params).then((res) => ({
        data: res.data!,
        meta: res.meta as PaginationMeta,
      })),
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ["products", id],
    queryFn: () =>
      api.get<ProductResponseDTO>(`/products/${id}`).then((res) => res.data!),
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProductDTO) =>
      api.post<ProductResponseDTO>("/products", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product created");
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useUpdateProduct(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateProductDTO) =>
      api.put<ProductResponseDTO>(`/products/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product updated");
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product deleted");
    },
    onError: (err) => toast.error(err.message),
  });
}
