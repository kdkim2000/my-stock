/** 세션 만료 등 인증 오류를 나타내는 에러 타입 */
export class AuthError extends Error {
  readonly isAuthError = true as const;
  constructor(message = "세션이 만료되었습니다. 페이지를 새로고침하거나 다시 로그인해 주세요.") {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * 로그인 세션 쿠키를 포함해 API를 호출합니다.
 * 401 응답 시 AuthError를 throw합니다 (페이지 전체 리다이렉트 없음).
 * 컴포넌트에서 AuthError.isAuthError를 확인해 재로그인 안내를 표시하세요.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, {
    ...init,
    credentials: "include",
  });
  if (res.status === 401) {
    throw new AuthError();
  }
  return res;
}
