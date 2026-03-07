/**
 * 로그인 세션 쿠키를 포함해 API를 호출합니다.
 * 401 응답 시 로그인 페이지로 리다이렉트합니다.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const res = await fetch(input, {
    ...init,
    credentials: "include",
  });
  if (res.status === 401 && typeof window !== "undefined") {
    const callbackUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/api/auth/signin?callbackUrl=${callbackUrl}`;
    return res;
  }
  return res;
}
