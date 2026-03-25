/**
 * KIS API 동시성 제어 — 세마포어 방식
 *
 * 기존 글로벌 400ms throttle 은 Promise.all() 내부에서도 모든 호출을 직렬화하여
 * 14~20개 호출 × 400ms = 5.6~8초 이상의 대기를 유발했습니다.
 *
 * 개선: 최대 KIS_CONCURRENCY 개 동시 요청을 허용하는 세마포어로 교체합니다.
 * - KIS API 권고: 초당 최대 10~20회. 기본값 5로 설정해 안전 마진 확보.
 * - 동시 5개 허용 시: 14호출 → ceil(14/5) × ~300ms ≈ 0.9초 (기존 5.6초 대비 ~6배 향상)
 * - 환경변수 KIS_CONCURRENCY 로 조정 가능 (0 이하 = 제한 없음)
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
 * 세마포어 획득: 동시 실행 수가 KIS_CONCURRENCY 미만이면 즉시 진행,
 * 초과면 대기열에 등록 후 슬롯이 해제될 때까지 대기합니다.
 */
export async function waitKisThrottle(): Promise<void> {
  if (KIS_CONCURRENCY <= 0) return; // 제한 없음

  const sem = getSemaphore();
  if (sem.running < KIS_CONCURRENCY) {
    sem.running++;
    return;
  }

  // 슬롯이 없으면 큐에서 대기
  await new Promise<void>((resolve) => {
    sem.queue.push(resolve);
  });
  sem.running++;
}

/**
 * 세마포어 해제: 다음 대기자에게 슬롯을 양도합니다.
 * kisGet() 완료 후 반드시 호출해야 합니다.
 */
export function releaseKisThrottle(): void {
  if (KIS_CONCURRENCY <= 0) return;

  const sem = getSemaphore();
  const next = sem.queue.shift();
  if (next) {
    next(); // 대기 중이던 호출 즉시 진행 (running 수는 유지)
  } else {
    sem.running = Math.max(0, sem.running - 1);
  }
}

// 하위 호환: 기존 KIS_THROTTLE_MS export 유지 (외부 참조 코드 대비)
export const KIS_THROTTLE_MS = 0;
