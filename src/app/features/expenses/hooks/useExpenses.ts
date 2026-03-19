import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { ExpenseResponseDTO, CreateExpenseDTO, UpdateExpenseDTO } from "../types";
import { PaginationMeta } from "@/types/dto";

export function useExpenses(params?: Record<string, string>) {
  return useQuery({
    queryKey: ["expenses", params],
    queryFn: () =>
      api.get<ExpenseResponseDTO[]>("/expenses", params).then((res) => ({
        data: res.data!,
        meta: res.meta as PaginationMeta,
      })),
  });
}

export function useExpense(id: string) {
  return useQuery({
    queryKey: ["expenses", id],
    queryFn: () =>
      api.get<ExpenseResponseDTO>(`/expenses/${id}`).then((res) => res.data!),
    enabled: !!id,
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateExpenseDTO) =>
      api.post<ExpenseResponseDTO>("/expenses", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Expense recorded");
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useUpdateExpense(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateExpenseDTO) =>
      api.put<ExpenseResponseDTO>(`/expenses/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Expense updated");
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Expense deleted");
    },
    onError: (err) => toast.error(err.message),
  });
}
