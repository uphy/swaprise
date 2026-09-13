import type {
  DurableObjectNamespace,
  Fetcher,
  D1Database,
  AnalyticsEngineDataset,
} from "@cloudflare/workers-types";
export interface Env {
  ROOMS: DurableObjectNamespace;
  COORDINATOR: DurableObjectNamespace;
  ASSETS: Fetcher;
  SCORES_DB: D1Database;
  ONLINE_ENABLED: string;
  TEST_MODE?: string;
  /** 利用の計測（worker/track.ts）。ローカルやテストでは未設定で、その場合は何も書かない。 */
  EVENTS?: AnalyticsEngineDataset;
}
