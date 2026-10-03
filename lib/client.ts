"use client";

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: { message: string; code?: string };
}

/** fetch wrapper for the admin API. Sends JSON, always resolves (never throws). */
export async function api<T = unknown>(path: string, init: { method?: string; json?: unknown } = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: init.method ?? (init.json ? "POST" : "GET"),
      headers: init.json ? { "Content-Type": "application/json" } : undefined,
      body: init.json ? JSON.stringify(init.json) : undefined,
      credentials: "same-origin",
    });
    const body = (await res.json().catch(() => null)) as ApiResult<T> | null;
    if (res.status === 401 && body?.error?.code === "UNAUTHENTICATED" && window.location.pathname !== "/login") {
      window.location.replace("/login");
      return { success: false, error: { message: "Please sign in again." } };
    }
    return body ?? { success: false, error: { message: `Request failed (${res.status}).` } };
  } catch {
    return { success: false, error: { message: "Network error. Check your connection and try again." } };
  }
}
