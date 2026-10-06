/**
 * Pre-configured Axios instance.
 * Automatically injects the JWT Authorization header.
 */

import axios from "axios";
import { getToken, clearAuth } from "@/app/store";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Request interceptor — attach token
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle 401 (redirect to login), surface 403 properly
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // On the login page a 401 just means "wrong password" — let the form show it
    // instead of reloading the page and losing the message.
    if (error.response?.status === 401 && !window.location.pathname.startsWith("/login")) {
      clearAuth();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default api;
