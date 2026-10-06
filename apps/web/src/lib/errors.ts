/**
 * @module lib/errors
 *
 * Shared error-handling utilities for API responses.
 * Use these helpers in page components and feature hooks to
 * extract human-readable messages from Axios errors.
 */

/**
 * Extract the `detail` string from an Axios error response.
 * Falls back to `fallback` if the response shape is unexpected.
 *
 * @example
 * ```ts
 * try { await createUser(data); }
 * catch (err) { message.error(extractApiError(err, "Failed to create user")); }
 * ```
 */
export function extractApiError(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
    fallback
  );
}
