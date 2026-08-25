/**
 * Tiny API client. The base URL is configurable via NEXT_PUBLIC_API_URL and
 * defaults to the local FastAPI backend. Feature-specific calls are added in
 * later phases; this file stays thin.
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type HealthResponse = {
  status: string;
  service: string;
  version: string;
  database: { connected: boolean; engine: string; error: string | null };
};

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_URL}/health`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Health check failed (${res.status})`);
  return res.json();
}
