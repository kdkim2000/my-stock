/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 15: experimental에서 최상위로 이동
  serverExternalPackages: ["adm-zip"],
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/icon.svg" }];
  },
  outputFileTracingExcludes: {
    "/api/**": [
      // --- 핵심: .next/cache/webpack (346MB) — 빌드 캐시가 서버리스에 포함되는 문제 ---
      "./.next/cache/**",

      // --- googleapis 미사용 API, 문서/테스트/소스맵 ---
      "./node_modules/googleapis/build/src/apis/!(sheets|oauth2)/**/*",
      "./node_modules/**/*.md",
      "./node_modules/**/README*",
      "./node_modules/**/CHANGELOG*",
      "./node_modules/**/docs/**",
      "./node_modules/**/test/**",
      "./node_modules/**/tests/**",
      "./node_modules/**/*.map",

      // --- lucide-react (35.3MB) — 서버에서 불필요한 UMD/ESM 번들 ---
      "./node_modules/lucide-react/dist/umd/**",
      "./node_modules/lucide-react/dist/esm/**",

      // --- openai (7.2MB) — 미사용 리소스 제외 (chat.completions만 사용) ---
      "./node_modules/openai/resources/beta/**",
      "./node_modules/openai/resources/fine_tuning/**",
      "./node_modules/openai/resources/audio/**",
      "./node_modules/openai/resources/images/**",
      "./node_modules/openai/resources/moderations*",
      "./node_modules/openai/resources/uploads*",
      "./node_modules/openai/resources/batches*",
      "./node_modules/openai/resources/files*",
      "./node_modules/openai/resources/vector_stores/**",

      // --- recharts + d3 (6.1MB+) — 클라이언트 전용 차트 라이브러리 ---
      "./node_modules/recharts/**",
      "./node_modules/d3-*/**",
      "./node_modules/victory-vendor/**",

      // --- @tanstack/react-query (2.8MB) — 클라이언트 전용 ---
      "./node_modules/@tanstack/**",

      // --- 기타 클라이언트 전용 ---
      "./node_modules/react-markdown/**",
      "./node_modules/tailwindcss-animate/**",
    ],
    // 비-API 페이지에서도 빌드 캐시/UMD/소스맵 제외
    "/**": [
      "./.next/cache/**",
      "./node_modules/lucide-react/dist/umd/**",
      "./node_modules/**/*.map",
    ],
  },
};

export default nextConfig;
