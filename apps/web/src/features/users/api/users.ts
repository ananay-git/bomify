/**
 * Users API hooks — CRUD operations for user management.
 */

import api from "@/lib/axios";

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  /** "owner" sees everything; "staff" only gets the task dashboard. */
  role: "owner" | "staff";
  module_permissions: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserListResponse {
  users: User[];
  total: number;
}

export interface CreateUserPayload {
  username: string;
  email: string;
  full_name: string;
  password: string;
  role?: "owner" | "staff";
  /** Ignored for staff accounts. */
  module_permissions?: string[];
}

export interface UpdateUserPayload {
  email?: string;
  full_name?: string;
  module_permissions?: string[];
  is_active?: boolean;
}

export async function fetchUsers(
  skip = 0,
  limit = 50,
): Promise<UserListResponse> {
  const res = await api.get<UserListResponse>("/users/", {
    params: { skip, limit },
  });
  return res.data;
}

export async function createUser(data: CreateUserPayload): Promise<User> {
  const res = await api.post<User>("/users/", data);
  return res.data;
}

export async function updateUser(
  userId: number,
  data: UpdateUserPayload,
): Promise<User> {
  const res = await api.patch<User>(`/users/${userId}`, data);
  return res.data;
}

export async function resetUserPassword(
  userId: number,
  newPassword: string,
): Promise<User> {
  const res = await api.post<User>(`/users/${userId}/reset-password`, {
    new_password: newPassword,
  });
  return res.data;
}

export async function deleteUser(userId: number): Promise<void> {
  await api.delete(`/users/${userId}`);
}
