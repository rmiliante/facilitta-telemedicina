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

export type FileAction = "print" | "download";

const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "gif", "bmp"];

function extOf(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

/** Imprime direto da tela: PDF, imagem e texto. Word, Excel e CSV precisam ser baixados. */
export function fileAction(name: string): FileAction {
  const ext = extOf(name);
  return ext === "pdf" || ext === "txt" || IMAGE_EXT.includes(ext) ? "print" : "download";
}

function escapeHtml(text: string) {
  return text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/** Imprime um documento HTML montado na hora, num iframe invisível. */
function printHtml(html: string, blobUrlToRevoke?: string): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument!;
    doc.open();
    doc.write(html);
    doc.close();
    const go = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      resolve();
      setTimeout(() => {
        iframe.remove();
        if (blobUrlToRevoke) URL.revokeObjectURL(blobUrlToRevoke);
      }, 60_000);
    };
    const img = doc.querySelector("img");
    if (img && !img.complete) {
      img.onload = go;
      img.onerror = go;
    } else {
      setTimeout(go, 100);
    }
  });
}

/**
 * Imprime qualquer arquivo que o navegador consegue mostrar: PDF, imagem
 * (encaixada numa folha A4) e texto. Os outros formatos são baixados.
 */
export async function printFile(url: string, name: string): Promise<void> {
  const ext = extOf(name);
  if (ext === "pdf") return printPdf(url);
  if (fileAction(name) === "download") return downloadFile(url, name);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("download");
    const blob = await res.blob();
    if (ext === "txt") {
      const text = await blob.text();
      return printHtml(
        `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(name)}</title><style>@page{size:A4;margin:15mm}body{font:12px/1.5 monospace;white-space:pre-wrap;margin:0}</style></head><body>${escapeHtml(text)}</body></html>`
      );
    }
    const blobUrl = URL.createObjectURL(blob);
    return printHtml(
      `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(name)}</title><style>@page{size:A4;margin:10mm}html,body{margin:0;height:100%}body{display:flex;align-items:center;justify-content:center}img{max-width:100%;max-height:100%;object-fit:contain}</style></head><body><img src="${blobUrl}" alt=""></body></html>`,
      blobUrl
    );
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

/** Baixa o arquivo com o nome original (pra abrir no Word/Excel e imprimir de lá). */
export async function downloadFile(url: string, name: string): Promise<void> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("download");
    const blobUrl = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}
