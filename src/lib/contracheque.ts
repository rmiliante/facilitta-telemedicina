"use client";

/* Contracheque (recibo de pagamento de salário) e conferência da folha. Abre uma janela pronta para imprimir / salvar em PDF. */

export const EMPREGADOR = { nome: "FACILITTA SAUDE E TECNOLOGIA LTDA", cnpj: "59.645.429/0001-89" };

export interface FolhaLinha {
  employee_id: string;
  nome: string;
  cpf: string | null;
  cargo: string;
  admissao: string | null;
  dias: number;
  salario: number;
  comissao: number;
  inss: number;
  irrf: number;
  fgts: number;
  liquido: number;
}

const MES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const money = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const nome = (c: string) => MES[Number(c.slice(5, 7)) - 1] + "/" + c.slice(0, 4);
const dataBr = (d: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cpfFmt = (c: string | null) => {
  const d = (c ?? "").replace(/\D/g, "");
  return d.length === 11 ? d.slice(0, 3) + "." + d.slice(3, 6) + "." + d.slice(6, 9) + "-" + d.slice(9) : c ?? "—";
};

const CSS =
  "body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px;font-size:12px}h1{font-size:16px;margin:0}h2{font-size:13px;margin:14px 0 4px}" +
  ".top{display:flex;justify-content:space-between;border-bottom:2px solid #0b1f3a;padding-bottom:8px;margin-bottom:10px}" +
  "table{width:100%;border-collapse:collapse}th{background:#eef1f5;text-align:left;padding:5px;border:1px solid #cfd6df}td{padding:5px;border:1px solid #cfd6df}" +
  ".r{text-align:right}.tot td{font-weight:bold;background:#f6f8fa}.liq{font-size:15px;font-weight:bold;background:#e6f6f3}" +
  ".sig{margin-top:40px;display:flex;gap:40px}.sig div{flex:1;border-top:1px solid #111;padding-top:4px;text-align:center}.small{font-size:10px;color:#555;margin-top:10px}" +
  ".warn{background:#fff7e0;border:1px solid #e5c76b;padding:6px;margin:6px 0}.ok{color:#0a7a4b}.bad{color:#b42318;font-weight:bold}" +
  "@media print{.noprint{display:none}body{margin:12mm}.pg{page-break-after:always}}";

function abrir(titulo: string, corpo: string): boolean {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write("<!doctype html><html><head><meta charset='utf-8'><title>" + esc(titulo) + "</title><style>" + CSS + "</style></head><body>" + corpo + "</body></html>");
  w.document.close();
  setTimeout(() => w.print(), 500);
  return true;
}

function reciboHtml(l: FolhaLinha, comp: string, pagamento: string): string {
  const bruto = l.salario + l.comissao;
  const desc = l.inss + l.irrf;
  const lin = (cod: string, d: string, ref: string, prov: number | null, des: number | null) =>
    "<tr><td>" + cod + "</td><td>" + d + "</td><td class='r'>" + ref + "</td><td class='r'>" + (prov === null ? "" : money(prov)) + "</td><td class='r'>" + (des === null ? "" : money(des)) + "</td></tr>";
  let rows = lin("001", "Salário", l.dias + " dias", l.salario, null);
  if (l.comissao > 0) rows += lin("002", "Comissões sobre vendas", "", l.comissao, null);
  rows += lin("101", "INSS (empregado)", "", null, l.inss);
  if (l.irrf > 0) rows += lin("102", "IRRF", "", null, l.irrf);
  return (
    "<div class='pg'><div class='top'><div><h1>RECIBO DE PAGAMENTO DE SALÁRIO</h1><div>Competência: <b>" + nome(comp) + "</b></div></div>" +
    "<div style='text-align:right'><b>" + EMPREGADOR.nome + "</b><br>CNPJ " + EMPREGADOR.cnpj + "</div></div>" +
    "<table><tr><th>Empregado</th><th>CPF</th><th>Cargo</th><th>Admissão</th></tr><tr><td>" + esc(l.nome) + "</td><td>" + cpfFmt(l.cpf) + "</td><td>" + esc(l.cargo) + "</td><td>" + dataBr(l.admissao) + "</td></tr></table>" +
    "<h2>Proventos e descontos</h2><table><tr><th>Cód.</th><th>Descrição</th><th class='r'>Ref.</th><th class='r'>Proventos</th><th class='r'>Descontos</th></tr>" + rows +
    "<tr class='tot'><td colspan='3'>Totais</td><td class='r'>" + money(bruto) + "</td><td class='r'>" + money(desc) + "</td></tr>" +
    "<tr class='liq'><td colspan='3'>LÍQUIDO A RECEBER</td><td colspan='2' class='r'>" + money(l.liquido) + "</td></tr></table>" +
    "<h2>Bases de cálculo</h2><table><tr><th>Base INSS</th><th>Base FGTS</th><th>FGTS do mês (8%)</th><th>Base IRRF</th></tr><tr><td>" + money(bruto) + "</td><td>" + money(bruto) + "</td><td>" + money(l.fgts) + "</td><td>" + money(Math.max(0, bruto - l.inss)) + "</td></tr></table>" +
    "<p>Data do pagamento: <b>" + dataBr(pagamento) + "</b></p>" +
    "<p class='small'>Declaro ter recebido a importância líquida discriminada neste recibo, referente à competência indicada.</p>" +
    "<div class='sig'><div>" + esc(l.nome) + "<br>Assinatura do empregado</div><div>Data: ____/____/______</div></div>" +
    "<p class='small'>Documento emitido pelo sistema de Departamento Pessoal da Facilitta. Valores calculados conforme as tabelas vigentes na competência; os recolhimentos e o envio ao eSocial são tratados à parte.</p></div>"
  );
}

export function abrirContracheques(linhas: FolhaLinha[], comp: string, pagamento: string): boolean {
  return abrir("Contracheque " + nome(comp), linhas.map((l) => reciboHtml(l, comp, pagamento)).join(""));
}

export interface Checagem { ok: boolean; texto: string }

export function abrirConferencia(linhas: FolhaLinha[], comp: string, pagamento: string, checks: Checagem[]): boolean {
  const tot = (f: (l: FolhaLinha) => number) => money(linhas.reduce((s, l) => s + f(l), 0));
  const rows = linhas
    .map((l) => "<tr><td>" + esc(l.nome) + "</td><td class='r'>" + money(l.salario) + "</td><td class='r'>" + money(l.comissao) + "</td><td class='r'>" + money(l.inss) + "</td><td class='r'>" + money(l.irrf) + "</td><td class='r'>" + money(l.fgts) + "</td><td class='r'><b>" + money(l.liquido) + "</b></td></tr>")
    .join("");
  const ck = checks.map((c) => "<li class='" + (c.ok ? "ok" : "bad") + "'>" + (c.ok ? "✔ " : "✖ ") + esc(c.texto) + "</li>").join("");
  const html =
    "<div class='top'><div><h1>CONFERÊNCIA DA FOLHA</h1><div>Competência: <b>" + nome(comp) + "</b> · Pagamento previsto: <b>" + dataBr(pagamento) + "</b></div></div><div style='text-align:right'><b>" + EMPREGADOR.nome + "</b><br>CNPJ " + EMPREGADOR.cnpj + "</div></div>" +
    "<h2>Resumo por colaborador</h2><table><tr><th>Colaborador</th><th class='r'>Salário</th><th class='r'>Comissão</th><th class='r'>INSS</th><th class='r'>IRRF</th><th class='r'>FGTS</th><th class='r'>Líquido</th></tr>" + rows +
    "<tr class='tot'><td>Total</td><td class='r'>" + tot((l) => l.salario) + "</td><td class='r'>" + tot((l) => l.comissao) + "</td><td class='r'>" + tot((l) => l.inss) + "</td><td class='r'>" + tot((l) => l.irrf) + "</td><td class='r'>" + tot((l) => l.fgts) + "</td><td class='r'>" + tot((l) => l.liquido) + "</td></tr></table>" +
    "<h2>Verificações</h2><ul>" + ck + "</ul><div class='warn'>Estimativa de apoio: DSR sobre comissões, férias e 13º na competência e a tabela de INSS/IRRF devem ser validados com o contador.</div>";
  return abrir("Conferência " + nome(comp), html);
}
