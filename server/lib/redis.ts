import { Redis } from "@upstash/redis";
import { env } from "../env";

// Live run state lives in Redis so the Progress page can poll cheaply without
// hammering Postgres. Keys are namespaced with `cc:` since this DB is shared.
const redis =
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })
    : null;

const TTL_SECONDS = 60 * 60; // live state expires after an hour

export type LiveState = {
  status: string;
  progress: number;
  stage: string;
  logs: string[];
};

const stateKey = (runId: string) => `cc:run:${runId}:state`;
const logKey = (runId: string) => `cc:run:${runId}:log`;

export async function setLive(runId: string, patch: Partial<Omit<LiveState, "logs">>) {
  if (!redis) return;
  await redis.hset(stateKey(runId), patch as Record<string, unknown>);
  await redis.expire(stateKey(runId), TTL_SECONDS);
}

export async function pushLog(runId: string, line: string) {
  if (!redis) return;
  await redis.rpush(logKey(runId), line);
  await redis.expire(logKey(runId), TTL_SECONDS);
}

export async function getLive(runId: string): Promise<LiveState | null> {
  if (!redis) return null;
  const [state, logs] = await Promise.all([
    redis.hgetall<Record<string, string>>(stateKey(runId)),
    redis.lrange(logKey(runId), 0, -1),
  ]);
  if (!state || Object.keys(state).length === 0) return null;
  return {
    status: state.status ?? "running",
    progress: Number(state.progress ?? 0),
    stage: state.stage ?? "",
    logs: (logs as string[]) ?? [],
  };
}

export const redisAvailable = !!redis;
