import { createHash } from "node:crypto";
import forge from "node-forge";
import { evtNamespace } from "./esocial-xml";

/**
 * eSocial — assinatura XML-DSig (enveloped, C14N 1.0, RSA-SHA256 / SHA-256) com o certificado e-CNPJ A1 (.pfx).
 * O XML do evento é gerado compacto (sem espaços, sem tags vazias, sem atributos além de Id),
 * por isso a forma canônica é o próprio texto, com o xmlns herdado do <eSocial> incluído no elemento do evento.
 * Nunca registra nem devolve a chave privada.
 */

interface ForgeKey {
  n: { compareTo(o: unknown): number };
  sign(md: unknown): string;
}
interface ForgeCert {
  publicKey: { n: { compareTo(o: unknown): number } };
  subject: { getField(n: string): { value: unknown } | null };
  validity: { notAfter: Date };
}

export interface Credencial {
  privateKey: ForgeKey;
  certDerB64: string;
  subject: string;
  validTo: Date;
}

export function carregarCredencial(pfx: Buffer, senha: string): Credencial {
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfx.toString("binary")));
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, senha);
  const oids = forge.pki.oids;
  const keyBags = [
    ...((p12.getBags({ bagType: oids.pkcs8ShroudedKeyBag })[oids.pkcs8ShroudedKeyBag] as { key?: unknown }[]) ?? []),
    ...((p12.getBags({ bagType: oids.keyBag })[oids.keyBag] as { key?: unknown }[]) ?? []),
  ];
  const certBags = (p12.getBags({ bagType: oids.certBag })[oids.certBag] as { cert?: ForgeCert }[]) ?? [];
  const key = keyBags.map((b) => b.key).find(Boolean) as ForgeKey | undefined;
  if (!key) throw new Error("Chave privada não encontrada no certificado");
  const cert = certBags
    .map((b) => b.cert)
    .find((c) => c && c.publicKey.n.compareTo(key.n) === 0);
  if (!cert) throw new Error("Certificado correspondente à chave não encontrado");
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const cn = cert.subject.getField("CN")?.value ?? "";
  return { privateKey: key, certDerB64: forge.util.encode64(der), subject: String(cn), validTo: cert.validity.notAfter };
}

const sha256b64 = (s: string) => createHash("sha256").update(s, "utf8").digest("base64");

/** Assina um evento. `evtXml` = <evtX Id="...">...</evtX>. Devolve <eSocial xmlns="...">evento + Signature</eSocial>. */
export function assinarEvento(evtXml: string, tag: string, _id: string, cred: Credencial): string {
  const ns = evtNamespace(tag);
  // Reference URI="" (exigência do eSocial): o digest cobre o documento inteiro, sem a Signature (enveloped)
  void tag;
  const digestInput = `<eSocial xmlns="${ns}">${evtXml}</eSocial>`;
  const digest = sha256b64(digestInput);
  const signedInfoInner =
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"></SignatureMethod>` +
    `<Reference URI=""><Transforms>` +
    `<Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform>` +
    `<Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform>` +
    `</Transforms><DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"></DigestMethod>` +
    `<DigestValue>${digest}</DigestValue></Reference>`;
  // forma canônica do SignedInfo (com o xmlns do Signature) para assinar
  const signedInfoC14n = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfoInner}</SignedInfo>`;
  const md = forge.md.sha256.create();
  md.update(forge.util.encodeUtf8(signedInfoC14n));
  const signature = forge.util.encode64(cred.privateKey.sign(md));
  const sig =
    `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignedInfo>${signedInfoInner}</SignedInfo>` +
    `<SignatureValue>${signature}</SignatureValue>` +
    `<KeyInfo><X509Data><X509Certificate>${cred.certDerB64}</X509Certificate></X509Data></KeyInfo></Signature>`;
  return `<eSocial xmlns="${ns}">${evtXml}${sig}</eSocial>`;
}
