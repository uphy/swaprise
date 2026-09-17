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
/**
 * DO は最初に触った Worker の近くに作られる。部屋は Coordinator の /init で最初に触られるので、
 * 指定がないと Coordinator と同じ場所に置かれ、日本の利用者からは遠い（2026/9/17 の計測で
 * edge からさらに往復 75〜115ms）。利用者は国内が基準なので、作成先を apac に寄せる。
 * 既に作られた DO には効かない。
 */
const PLACEMENT = { locationHint: "apac" } as const;
export const roomStub = (env: Env, id: string) =>
  env.ROOMS.get(env.ROOMS.idFromName(id), PLACEMENT);
export const coordinatorStub = (env: Env) =>
  env.COORDINATOR.get(env.COORDINATOR.idFromName("global"), PLACEMENT);
