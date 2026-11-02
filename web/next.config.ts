import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    const common = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
    ];
    return [
      // The board prints the census through a hidden same-origin frame, so the print pages may be framed by this site.
      { source: "/print/:kind(census|patient/[^/]+)", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }, ...common] },
      {
        source: "/:path((?!print/(?:census|patient/[^/]+)$).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          ...common,
        ],
      },
    ];
  },
};

export default nextConfig;
