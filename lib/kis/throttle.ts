/**
 * KIS API 동시성 제어 — 세마포어 방식 (버그 수정版)
 *
 * ★ 수정 내용 (버그 원인):
 *   기존 구현에서 큐 대기 후 재개 시 sem.running++ 을 실행했는데,
 *   releaseKisThrottle() 이 next() 호출 시 running 을 감소시키지 않아
 *   매 슬롯 양도마다 running 이 +1씩 증가하는 누수가 발생했습니다.
 *   결과: concurrency=5 → 실제로는 제한 없이 모든 요청이 동시 실행됨.
 *
 * 올바른 세마포어 동작:
 *   - 즉시 획득(running < KIS_CONCURRENCY): running++
 *   - 큐 대기 후 획득(슬롯 직접 양도):      running 변경 없음
 *   - 해제(대기자 있음): running 변경 없음, next() 로 슬롯 직접 양도
 *   - 해제(대기자 없음): running--
 *
 * 환경변수 KIS_CONCURRENCY 로 조정 가능 (기본값 5, 0 이하 = 제한 없음)
 */
const KIS_CONCURRENCY = Math.max(0, Number(process.env.KIS_CONCURRENCY) || 5);

const GLOBAL_SEMAPHORE_KEY = "__KIS_SEMAPHORE__" as const;

interface SemaphoreState {
  running: number;
  queue: Array<() => void>;
}

function getSemaphore(): SemaphoreState {
  const g = globalThis as unknown as Record<string, SemaphoreState>;
  if (!g[GLOBAL_SEMAPHORE_KEY]) {
    g[GLOBAL_SEMAPHORE_KEY] = { running: 0, queue: [] };
  }
  return g[GLOBAL_SEMAPHORE_KEY];
}

/**
 * 세마포어 획득:
 *  - running < KIS_CONCURRENCY: running++ 후 즉시 반환
 *  - running >= KIS_CONCURRENCY: 큐에서 대기. 슬롯은 releaseKisThrottle() 이 직접 양도.
 *    이 경우 running 은 변경하지 않음(슬롯 수 그대로 유지).
 */
export async function waitKisThrottle(): Promise<void> {
  if (KIS_CONCURRENCY <= 0) return;

  const sem = getSemaphore();
  if (sem.running < KIS_CONCURRENCY) {
    sem.running++;
    return;
  }

  // 슬롯 부족 → 큐에서 대기. 슬롯은 releaseKisThrottle이 양도하므로 running은 건드리지 않음.
  await new Promise<void>((resolve) => {
    sem.queue.push(resolve);
  });
  // ★ sem.running++ 하지 않음 — releaseKisThrottle에서 running을 감소시키지 않고
  //    슬롯을 직접 양도했기 때문에 running 값은 유지된 상태.
}

/**
 * 세마포어 해제:
 *  - 대기자 있음: running 변경 없이 next() 로 슬롯 직접 양도
 *  - 대기자 없음: running--
 */
export function releaseKisThrottle(): void {
  if (KIS_CONCURRENCY <= 0) return;

  const sem = getSemaphore();
  const next = sem.queue.shift();
  if (next) {
    // 슬롯을 대기자에게 직접 양도: running은 그대로 (1 out → 1 in)
    next();
  } else {
    sem.running = Math.max(0, sem.running - 1);
  }
}

// 하위 호환: 기존 KIS_THROTTLE_MS export 유지
export const KIS_THROTTLE_MS = 0;
