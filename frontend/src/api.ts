import { useQuery } from "@tanstack/react-query";
export type RecordData = Record<string, any>;
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T = RecordData>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new ApiError(
      body.error?.message ||
        body.message ||
        (typeof body.error === "string" ? body.error : undefined) ||
        `Request failed (${response.status})`,
      response.status,
    );
  return body as T;
}
export const send = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});
export function useApi(path: string, options: RecordData = {}) {
  return useQuery<RecordData>({
    queryKey: [path],
    queryFn: () => api(path),
    retry: 1,
    ...options,
  });
}
export const entries = (
  data: RecordData | RecordData[] | undefined,
): RecordData[] =>
  Array.isArray(data)
    ? data
    : data?.items ||
      data?.applications ||
      data?.alerts ||
      data?.scenarios ||
      data?.jobs ||
      data?.events ||
      data?.users ||
      [];
export const identifier = (item: RecordData) => item.id || item._id;
export const money = (n: number | undefined, currency = "INR") =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n || 0);
export const compactMoney = (n: number | undefined) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n || 0);
export const percent = (n: number | undefined) =>
  `${((n || 0) * 100).toFixed(1)}%`;
export const date = (n: string | undefined) =>
  n
    ? new Date(n).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
