import type {
  DurableObjectNamespace,
  Fetcher,
  D1Database,
} from "@cloudflare/workers-types";
export interface Env {
  ROOMS: DurableObjectNamespace;
  COORDINATOR: DurableObjectNamespace;
  ASSETS: Fetcher;
  SCORES_DB: D1Database;
  ONLINE_ENABLED: string;
  TEST_MODE?: string;
}
