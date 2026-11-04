import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Cabeçalhos de segurança em todas as páginas (câmera e microfone não são restringidos,
  // porque a videochamada roda num quadro de outro domínio).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: "geolocation=()" },
        ],
      },
    ];
  },
  // Links curtos para o WhatsApp e a IA. Redirecionamento temporário (307),
  // para poder trocar o destino quando precisar sem o navegador "guardar" o antigo.
  async redirects() {
    return [
      {
        source: "/individual",
        destination: "https://totem.facilittasaude.com.br/totem/checkout?seller=FM-7&product=25",
        permanent: false,
      },
      {
        source: "/familiar",
        destination: "https://totem.facilittasaude.com.br/totem/checkout/light?seller=FM-7&product=26",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
