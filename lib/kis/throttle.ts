export const KIS_THROTTLE_MS = Math.max(0, Number(process.env.KIS_THROTTLE_MS) || 400);

const GLOBAL_THROTTLE_KEY = "__KIS_THROTTLE_LAST__" as const;
function getThrottleLast(): { lastAt: number } {
  const g = globalThis as unknown as Record<string, { lastAt: number }>;
  if (!g[GLOBAL_THROTTLE_KEY]) g[GLOBAL_THROTTLE_KEY] = { lastAt: 0 };
  return g[GLOBAL_THROTTLE_KEY];
}

export async function waitKisThrottle(): Promise<void> {
  if (KIS_THROTTLE_MS <= 0) return;
  const t = getThrottleLast();
  const now = Date.now();
  const elapsed = now - t.lastAt;
  if (elapsed < KIS_THROTTLE_MS) {
    await new Promise((r) => setTimeout(r, KIS_THROTTLE_MS - elapsed));
  }
  getThrottleLast().lastAt = Date.now();
}
