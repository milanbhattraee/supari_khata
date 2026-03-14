import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { PaymentResponseDTO, CreatePaymentDTO, UpdatePaymentDTO } from "../types";
import { PaginationMeta } from "@/types/dto";

export function usePayments(params?: Record<string, string>) {
  return useQuery({
    queryKey: ["payments", params],
    queryFn: () =>
      api.get<PaymentResponseDTO[]>("/payments", params).then((res) => ({
        data: res.data!,
        meta: res.meta as PaginationMeta,
      })),
  });
}

export function usePayment(id: string) {
  return useQuery({
    queryKey: ["payments", id],
    queryFn: () =>
      api.get<PaymentResponseDTO>(`/payments/${id}`).then((res) => res.data!),
    enabled: !!id,
  });
}

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePaymentDTO) =>
      api.post<PaymentResponseDTO>("/payments", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["parties"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Payment recorded");
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useUpdatePayment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdatePaymentDTO) =>
      api.put<PaymentResponseDTO>(`/payments/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["parties"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Payment updated");
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useDeletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/payments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["parties"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Payment deleted");
    },
    onError: (err) => toast.error(err.message),
  });
}
