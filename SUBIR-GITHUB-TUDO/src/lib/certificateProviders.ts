/**
 * Certificados digitais em nuvem aceitos na Facilitta.
 * Para incluir um novo certificado, basta acrescentar um item em CERTIFICATES:
 * telas, textos e a escolha do médico passam a mostrá-lo sozinhos.
 */
export type ApprovalType = "push" | "otp";

export interface CertificateProvider {
  /** Identificador igual ao devolvido pela Prescreve (campo providers). */
  id: string;
  label: string;
  /** Empresa/app que o médico usa no celular. */
  appName: string;
  /** Frase curta explicando como aprova. */
  hint: string;
  /** push = aprova por notificação no app; otp = digita o código do app. */
  approval: ApprovalType;
}

function birdIdApproval(): ApprovalType {
  // A forma de aprovar o BirdID na API depende da Prescreve; ajustável por env sem mexer no código.
  return process.env.BIRDID_APPROVAL === "otp" ? "otp" : "push";
}

export function listCertificates(): CertificateProvider[] {
  return [
    {
      id: "vidaas",
      label: "VIDaaS",
      appName: "app VIDaaS (Valid)",
      hint: "Aprovação por notificação no celular.",
      approval: "push",
    },
    {
      id: "birdid",
      label: "BirdID",
      appName: "app BirdID (Soluti)",
      hint: birdIdApproval() === "otp" ? "Aprovação por código do aplicativo." : "Aprovação no aplicativo do celular.",
      approval: birdIdApproval(),
    },
  ];
}

export function getCertificate(id: string | null | undefined): CertificateProvider | null {
  if (!id) return null;
  return listCertificates().find((c) => c.id === id.toLowerCase()) ?? null;
}

export function certificateLabel(id: string): string {
  return getCertificate(id)?.label ?? id;
}
