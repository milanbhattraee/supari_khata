import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import {
  TransactionResponseDTO,
  CreateTransactionDTO,
  UpdateTransactionDTO,
} from "../types";
import { PaginationMeta } from "@/types/dto";

export function useTransactions(params?: Record<string, string>) {
  return useQuery({
    queryKey: ["transactions", params],
    queryFn: () =>
      api
        .get<TransactionResponseDTO[]>("/transactions", params)
        .then((res) => ({
          data: res.data!,
          meta: res.meta as PaginationMeta,
        })),
  });
}

export function useTransaction(id: string) {
  return useQuery({
    queryKey: ["transactions", id],
    queryFn: () =>
      api
        .get<TransactionResponseDTO>(`/transactions/${id}`)
        .then((res) => res.data!),
    enabled: !!id,
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTransactionDTO) =>
      api.post<TransactionResponseDTO>("/transactions", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["parties"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Transaction recorded");
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useUpdateTransaction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateTransactionDTO) =>
      api.put<TransactionResponseDTO>(`/transactions/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["parties"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Transaction updated");
    },
    onError: (err) => toast.error(err.message),
  });
}
