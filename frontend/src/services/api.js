const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  "https://fedshield-3vpc.onrender.com";

export async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${response.status})`);
  }
  return response.json();
}

export function reportUrl(format) {
  return `${API_BASE}/api/reports/export?format=${encodeURIComponent(format)}`;
}
