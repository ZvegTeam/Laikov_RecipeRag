import { z } from "zod";

/**
 * Shared env schemas and getters. For a single validated instance use:
 * - Server: import { serverEnv } from "@/lib/env.server"
 * - Client: import { browserEnv } from "@/lib/env.client"
 */

const serverEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(
      1,
      "DATABASE_URL is required (e.g. postgresql://postgres:postgres@127.0.0.1:55322/postgres)"
    ),
  GEMINI_API_KEY: z
    .string()
    .min(1, "GEMINI_API_KEY is required (get from https://makersuite.google.com/app/apikey)"),
  GEMINI_MODEL: z
    .string()
    .min(1, "GEMINI_MODEL is required (e.g. gemini-2.5-flash-lite or gemini-2.0-flash)"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Browser-safe env (NEXT_PUBLIC_*). Add keys here when needed. */
const browserEnvSchema = z.object({
  // e.g. NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

export type BrowserEnv = z.infer<typeof browserEnvSchema>;

/**
 * Get validated browser env. Use this instead of process.env in client code.
 * Only include NEXT_PUBLIC_* vars. Throws with a clear message if validation fails.
 */
export function getBrowserEnv(): BrowserEnv {
  const result = browserEnvSchema.safeParse({
    // Map process.env when adding vars, e.g. NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ⚠️  ${i.path.join(".")}: ${i.message}`);
    const errorMessage = `
      \x1b[31m❌ Invalid browser environment variables:\n
      ${issues.join("\n      ")}\n
      📄 Check .env.local (use NEXT_PUBLIC_* for client).
      \x1b[0m
      `;
    throw new Error(errorMessage);
  }

  return result.data;
}

/** Validate browser env (e.g. in a client-side guard). Calls getBrowserEnv(). */
export function validateBrowserEnv(): BrowserEnv {
  return getBrowserEnv();
}

/**
 * Get validated server env. Use this instead of process.env so types are correct and validation runs.
 * Throws with a clear message if validation fails.
 */
export function getServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
  });

  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ⚠️  ${i.path.join(".")}: ${i.message}`);
    const errorMessage = `
      \x1b[31m❌ Invalid environment variables:\n
      ${issues.join("\n      ")}\n
      📄 Check .env.local (see .env.example).
      \x1b[0m
      `;
    throw new Error(errorMessage);
  }

  return result.data;
}

/** Validate env at startup (e.g. in instrumentation). Calls getServerEnv(). */
export function validateServerEnv(): ServerEnv {
  return getServerEnv();
}
