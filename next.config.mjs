/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // 용량 축소: 무거운 패키지는 번들에 넣지 않고 node_modules에서 로드
    serverComponentsExternalPackages: ["googleapis", "adm-zip"],
    // 서버리스 트레이스에서 불필요한 파일 제외 (배포 용량 절감)
    outputFileTracingExcludes: {
      "/api/**": [
        "./node_modules/**/*.md",
        "./node_modules/**/README*",
        "./node_modules/**/CHANGELOG*",
        "./node_modules/**/docs/**",
        "./node_modules/**/test/**",
        "./node_modules/**/tests/**",
        "./node_modules/**/*.map",
      ],
    },
  },
};

export default nextConfig;
