/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next 15: experimental에서 최상위로 이동
  serverExternalPackages: ["adm-zip"],
  outputFileTracingExcludes: {
    "/api/**": [
      "./node_modules/googleapis/build/src/apis/!(sheets|oauth2)/**/*",
      "./node_modules/**/*.md",
      "./node_modules/**/README*",
      "./node_modules/**/CHANGELOG*",
      "./node_modules/**/docs/**",
      "./node_modules/**/test/**",
      "./node_modules/**/tests/**",
      "./node_modules/**/*.map",
    ],
  },
};

export default nextConfig;
