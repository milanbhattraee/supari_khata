import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { AuthResponse } from "../types";
import { LoginFormValues, SignupFormValues } from "../schema";

export function useLogin() {
  const router = useRouter();

  return useMutation({
    mutationFn: (data: LoginFormValues) =>
      api.post<AuthResponse>("/auth/login", data),
    onSuccess: () => {
      toast.success("Login successful");
      router.push("/dashboard");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
}

export function useSignup() {
  const router = useRouter();

  return useMutation({
    mutationFn: (data: Omit<SignupFormValues, "confirmPassword">) =>
      api.post<AuthResponse>("/auth/signup", data),
    onSuccess: () => {
      toast.success("Account created! Please login.");
      router.push("/auth/login");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
}

export function useLogout() {
  const router = useRouter();

  return useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSuccess: () => {
      router.push("/auth/login");
    },
  });
}
