export type AuthInfo = {
  access_token: string;
  role: string;
  display_name: string;
  username: string;
};

const TOKEN_KEY = "cso_token";
const AUTH_KEY = "cso_auth";

export function saveAuth(auth: AuthInfo) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, auth.access_token);
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(AUTH_KEY);
}

export function getAuth(): AuthInfo | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthInfo;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(path.startsWith("/api") ? path : `/api${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    let detail = `请求失败 (${res.status})`;
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function login(username: string, password: string): Promise<AuthInfo> {
  const auth = await api<AuthInfo>("/api/auth/login-json", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  saveAuth(auth);
  return auth;
}

export function roleHome(role: string): string {
  switch (role) {
    case "agent":
      return "/agent";
    case "rep":
      return "/rep";
    case "compliance":
      return "/dashboard";
    case "admin":
      return "/admin";
    case "academy":
      return "/courses";
    default:
      return "/";
  }
}
