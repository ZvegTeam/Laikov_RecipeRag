import { getServerEnv } from "./env";

/** Validated server env (single instance). Prefer this over calling getServerEnv() repeatedly. */
export const serverEnv = getServerEnv();

export type { ServerEnv } from "./env";
export { getServerEnv, validateServerEnv } from "./env";
