import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { DashboardSummaryDTO } from "@/types/dto";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () =>
      api.get<DashboardSummaryDTO>("/dashboard").then((res) => res.data!),
  });
}
