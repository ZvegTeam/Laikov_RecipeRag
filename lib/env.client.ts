import { getBrowserEnv } from "./env";

/** Validated browser env (single instance). Prefer this over calling getBrowserEnv() repeatedly. */
export const browserEnv = getBrowserEnv();

export type { BrowserEnv } from "./env";
export { getBrowserEnv, validateBrowserEnv } from "./env";
