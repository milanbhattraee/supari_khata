import { ApiResponse } from "@/types/dto";

const BASE_URL = "/api";

class ApiError extends Error {
  status: number;
  data?: ApiResponse;

  constructor(message: string, status: number, data?: ApiResponse) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function handleResponse<T>(res: Response): Promise<ApiResponse<T>> {
  const contentType = res.headers.get("content-type") || "";

  // Centralized unauthorized handling: force navigation to login.
  if (res.status === 401 && typeof window !== "undefined") {
    const path = window.location.pathname;
    if (!path.startsWith("/auth/login")) {
      window.location.href = "/auth/login";
      // Intentionally halt execution here to prevent parsing errors
      // while the browser handles the redirect navigation.
      return new Promise<never>(() => {}); 
    }
  }

  if (!contentType.includes("application/json")) {
    throw new ApiError(
      `Server returned ${res.status}: ${res.statusText}`,
      res.status
    );
  }
  const data: ApiResponse<T> = await res.json();
  if (!res.ok || !data.success) {
    throw new ApiError(data.message || "Request failed", res.status, data as ApiResponse);
  }
  return data;
}

export const api = {
  async get<T>(path: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    const url = new URL(`${BASE_URL}${path}`, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== "") url.searchParams.set(k, v);
      });
    }
    const res = await fetch(url.toString(), {
      credentials: "include",
    });
    return handleResponse<T>(res);
  },

  async post<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(res);
  },

  async put<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(res);
  },

  async delete<T>(path: string): Promise<ApiResponse<T>> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "DELETE",
      credentials: "include",
    });
    return handleResponse<T>(res);
  },
};

export { ApiError };
