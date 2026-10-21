import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
