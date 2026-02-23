import { z } from "zod";

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
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Validate server-side env vars. Call from instrumentation (Node runtime) so the app fails fast on startup.
 * Throws with a clear message if validation fails.
 */
export function validateServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  });

  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ⚠️  ${i.path.join(".")}: ${i.message}`);
    // ANSI red color for the error message
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
