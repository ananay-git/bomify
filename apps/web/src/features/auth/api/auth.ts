/**
 * Auth API functions — login and fetch current user profile.
 */

import api from "@/lib/axios";
import type { AuthUser } from "@/app/store";

interface LoginPayload {
  username: string;
  password: string;
  /** Which login screen was used — the account must match it. */
  login_as?: "owner" | "staff";
}

interface TokenResponse {
  access_token: string;
  token_type: string;
}

export async function loginApi(data: LoginPayload): Promise<TokenResponse> {
  const res = await api.post<TokenResponse>("/users/login", data);
  return res.data;
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const res = await api.get<AuthUser>("/users/me");
  return res.data;
}
