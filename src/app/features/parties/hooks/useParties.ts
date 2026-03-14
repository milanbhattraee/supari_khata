import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import {
  PartyResponseDTO,
  PartyBalanceResponseDTO,
  CreatePartyDTO,
  UpdatePartyDTO,
} from "../types";
import { PaginationMeta } from "@/types/dto";

export function useParties(params?: Record<string, string>) {
  return useQuery({
    queryKey: ["parties", params],
    queryFn: () =>
      api.get<PartyResponseDTO[]>("/parties", params).then((res) => ({
        data: res.data!,
        meta: res.meta as PaginationMeta,
      })),
  });
}

export function useParty(id: string) {
  return useQuery({
    queryKey: ["parties", id],
    queryFn: () =>
      api.get<PartyResponseDTO>(`/parties/${id}`).then((res) => res.data!),
    enabled: !!id,
  });
}

export function usePartyBalance(id: string) {
  return useQuery({
    queryKey: ["parties", id, "balance"],
    queryFn: () =>
      api
        .get<PartyBalanceResponseDTO>(`/parties/${id}/balance`)
        .then((res) => res.data!),
    enabled: !!id,
  });
}

export function useCreateParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePartyDTO) =>
      api.post<PartyResponseDTO>("/parties", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parties"] });
      toast.success("Party created");
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useUpdateParty(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdatePartyDTO) =>
      api.put<PartyResponseDTO>(`/parties/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parties"] });
      toast.success("Party updated");
    },
    onError: (err) => toast.error(err.message),
  });
}

export function useDeleteParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/parties/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parties"] });
      toast.success("Party deleted");
    },
    onError: (err) => toast.error(err.message),
  });
}
