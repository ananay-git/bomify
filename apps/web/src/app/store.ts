/**
 * Minimal auth store using React context.
 * Stores JWT token and user info in localStorage.
 */

/** "owner" sees everything; "staff" only sees the shared task dashboard. */
export type UserRole = "owner" | "staff";

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  module_permissions: string[];
}

const TOKEN_KEY = "qs_token";
const USER_KEY = "qs_user";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const user = JSON.parse(raw);
    // Evict stale pre-RBAC entries that lack module_permissions
    if (!Array.isArray(user?.module_permissions)) {
      clearAuth();
      return null;
    }
    // Sessions saved before staff accounts existed always belonged to owners
    if (user.role !== "owner" && user.role !== "staff") {
      user.role = "owner";
    }
    return user;
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

/** Check if the current user has access to the given module. */
export function hasModule(module: string): boolean {
  const user = getUser();
  return !!user && Array.isArray(user.module_permissions) && user.module_permissions.includes(module);
}

/** True when the signed-in user is a staff member (task dashboard only). */
export function isStaff(): boolean {
  return getUser()?.role === "staff";
}

/** Where a user lands after signing in. */
export function homePathFor(user: AuthUser | null): string {
  return user?.role === "staff" ? "/staff" : "/app/home";
}
