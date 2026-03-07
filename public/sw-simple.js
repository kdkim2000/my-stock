/**
 * 최소 서비스 워커 — 외부 도구/확장 프로그램이 /sw-simple.js 를 요청할 때 404를 방지합니다.
 * 이 앱에서는 PWA/오프라인 기능을 사용하지 않습니다.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});
self.addEventListener("activate", () => {
  self.clients.claim();
});
