"use client";

/**
 * Abre a janela de impressão de um PDF direto da tela (sem a atendente
 * precisar abrir o arquivo e apertar Ctrl+P). Baixa o arquivo, carrega
 * num iframe invisível e chama print(); se o navegador bloquear, abre o
 * PDF numa aba nova pra imprimir de lá.
 */
export async function printPdf(url: string): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("download");
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));

    await new Promise<void>((resolve, reject) => {
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.src = blobUrl;
      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve();
        } catch (err) {
          reject(err);
        }
        // Remove depois de um tempo (a janela de impressão já copiou o conteúdo).
        setTimeout(() => {
          iframe.remove();
          URL.revokeObjectURL(blobUrl);
        }, 60_000);
      };
      document.body.appendChild(iframe);
    });
  } catch {
    window.open(url, "_blank", "noopener");
  }
}
