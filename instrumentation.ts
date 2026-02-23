import { validateServerEnv } from "./lib/env";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      validateServerEnv();
    } catch (error) {
      console.error((error as Error).message);
      process.exit(1);
    }
  }
}
