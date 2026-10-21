/** @type {import('next').NextConfig} */
// On small build machines (Render's free plan has 512 MB), type-check and lint run as separate
// steps (`npm run typecheck`, `npm run lint`) instead of inside `next build`.
const lowMemoryBuild = process.env.LOW_MEMORY_BUILD === "1";

const nextConfig = {
  eslint: { ignoreDuringBuilds: lowMemoryBuild },
  typescript: { ignoreBuildErrors: lowMemoryBuild },
  // react-pdf ships its own font/layout engines; load it from node_modules instead of bundling.
  serverExternalPackages: ["@react-pdf/renderer"],
  // pdfkit loads its built-in fonts (Helvetica, Courier…) dynamically, so file tracing misses
  // them. Ship them with the PDF route explicitly or serverless deploys fail with MODULE_NOT_FOUND.
  outputFileTracingIncludes: {
    "/api/reports/projects": ["./node_modules/pdfkit/js/standard-fonts/**", "./node_modules/@react-pdf/pdfkit/**"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "3mb" }, // avatar uploads (2 MB cap + overhead)
    ...(lowMemoryBuild && { webpackMemoryOptimizations: true, cpus: 1, workerThreads: false }),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // SAMEORIGIN (not DENY) so the Reports page can preview its own PDFs in an iframe.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
