const RENDER_API_BASE =
  process.env.FASTAPI_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "https://criminal-network-api-latest.onrender.com";

export function renderApiUrl(path: string) {
  const cleanBase = RENDER_API_BASE.replace(/\/$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

export async function fetchRenderJson<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<{ ok: true; data: T } | { ok: false; status?: number; error: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init?.timeoutMs ?? 4000);

  try {
    const response = await fetch(renderApiUrl(path), {
      ...init,
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers || {}),
      },
    });
    const text = await response.text();
    if (!response.ok) {
      return { ok: false, status: response.status, error: text || response.statusText };
    }

    return { ok: true, data: (text ? JSON.parse(text) : null) as T };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Render API request failed";
    return { ok: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}
