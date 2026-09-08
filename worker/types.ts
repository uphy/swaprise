import type {
  DurableObjectNamespace,
  Fetcher,
} from "@cloudflare/workers-types";
export interface Env {
  ROOMS: DurableObjectNamespace;
  COORDINATOR: DurableObjectNamespace;
  ASSETS: Fetcher;
  ONLINE_ENABLED: string;
  TEST_MODE?: string;
}
