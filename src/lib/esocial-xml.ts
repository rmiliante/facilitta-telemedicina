/**
 * eSocial — geração dos XMLs dos eventos (leiaute S-1.3), SEM assinatura.
 * Eventos: S-1000 (empregador), S-2200 (admissão), S-2206 (alteração contratual),
 * S-2230 (afastamento/férias) e S-2299 (desligamento).
 * Gera XML compacto (sem espaços entre tags) para a assinatura canônica bater.
 */

export type EsocialTipo = "S-1000" | "S-2200" | "S-2206" | "S-2230" | "S-2299";

export const SCHEMA_VERSION = "v_S_01_03_00";

export const TIPOS: Record<EsocialTipo, { tag: string; grupo: 1 | 2; label: string }> = {
  "S-1000": { tag: "evtInfoEmpregador", grupo: 1, label: "Informações do empregador" },
  "S-2200": { tag: "evtAdmissao", grupo: 2, label: "Admissão" },
  "S-2206": { tag: "evtAltContratual", grupo: 2, label: "Alteração contratual" },
  "S-2230": { tag: "evtAfastTemp", grupo: 2, label: "Afastamento / férias" },
  "S-2299": { tag: "evtDeslig", grupo: 2, label: "Desligamento" },
};

export const evtNamespace = (tag: string) => `http://www.esocial.gov.br/schema/evt/${tag}/${SCHEMA_VERSION}`;

export interface Empresa {
  /** Tabela 08 — 01 = Simples Nacional (tributação previdenciária substituída) */
  classTrib: string;
  /** "S" = ME/EPP; vazio = não informar */
  indPorte: string;
  /** 0 = não aplicável */
  indDesFolha: string;
  /** 0 = não optou pelo registro eletrônico de empregados */
  indOptRegEletron: string;
  /** início da validade (AAAA-MM) */
  iniValid: string;
  /** CNPJ do sindicato da categoria (padrão para os empregados) */
  cnpjSind: string;
}

export const EMPRESA_PADRAO: Empresa = {
  classTrib: "01",
  indPorte: "S",
  indDesFolha: "0",
  indOptRegEletron: "0",
  iniValid: "2026-01",
  cnpjSind: "",
};

export interface Colaborador {
  id: string;
  full_name: string;
  cpf: string | null;
  role_title: string;
  admitted_at: string | null;
  salary: number | string | null;
  esocial: Record<string, string> | null;
}

export interface BuildCtx {
  cnpj: string; // 14 dígitos
  now: Date;
  seq: number;
  tpAmb: "1" | "2";
  empresa: Empresa;
  /** S-1000: "inclusao" (padrão) ou "alteracao" */
  operacao?: "inclusao" | "alteracao";
}

export type BuildResult =
  | { ok: true; tag: string; id: string; grupo: 1 | 2; xml: string }
  | { ok: false; missing: string[] };

const VER_PROC = "facilitta-1.0";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\r/g, "");
}
/** <nome>valor</nome>; vazio quando o valor não existe (campo opcional) */
function x(name: string, v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  return s === "" ? "" : `<${name}>${esc(s)}</${name}>`;
}
/** <nome>filhos</nome>; vazio quando não há filhos */
function g(name: string, inner: string, attrs = ""): string {
  return inner ? `<${name}${attrs}>${inner}</${name}>` : "";
}
export const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");
const isoDate = (s: string | null | undefined) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "");
const money = (v: number | string | null | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n.toFixed(2) : "";
};

/** ID do evento: "ID" + tpInsc + CNPJ base (8) completado com zeros até 14 + AAAAMMDDHHMMSS + sequencial (5) */
export function eventId(cnpj14: string, now: Date, seq: number): string {
  const base = digits(cnpj14).slice(0, 8).padEnd(14, "0");
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  const ts =
    `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}` +
    `${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}`;
  return `ID1${base}${ts}${p(seq % 100000, 5)}`;
}

function ideEvento(ctx: BuildCtx, comRetif: boolean) {
  return g("ideEvento", (comRetif ? x("indRetif", "1") : "") + x("tpAmb", ctx.tpAmb) + x("procEmi", "1") + x("verProc", VER_PROC));
}
const ideEmpregador = (ctx: BuildCtx) => g("ideEmpregador", x("tpInsc", "1") + x("nrInsc", digits(ctx.cnpj).slice(0, 8)));

function dadosContrato(emp: Colaborador, ctx: BuildCtx, d: Record<string, string>) {
  const jornada9 = (d.tpJornada || "9") === "9";
  return g(
    "infoContrato",
    x("nmCargo", emp.role_title) +
      x("CBOCargo", digits(d.cbo)) +
      x("codCateg", d.codCateg || "101") +
      g("remuneracao", x("vrSalFx", money(emp.salary)) + x("undSalFixo", "5")) +
      g("duracao", x("tpContr", "1")) +
      g("localTrabalho", g("localTrabGeral", x("tpInsc", "1") + x("nrInsc", digits(ctx.cnpj)))) +
      g(
        "horContratual",
        x("qtdHrsSem", d.qtdHrsSem ? Number(d.qtdHrsSem).toFixed(2) : "") +
          x("tpJornada", d.tpJornada || "9") +
          x("tmpParc", "0") +
          x("horNoturno", "N") +
          x("dscJorn", jornada9 ? d.dscJorn || "Jornada conforme contrato de trabalho" : ""),
      ),
  );
}

export function buildEvent(
  tipo: EsocialTipo,
  ctx: BuildCtx,
  emp?: Colaborador,
  params: Record<string, string> = {},
): BuildResult {
  const meta = TIPOS[tipo];
  const id = eventId(ctx.cnpj, ctx.now, ctx.seq);
  const wrap = (inner: string) => `<${meta.tag} Id="${id}">${inner}</${meta.tag}>`;
  const d = emp?.esocial ?? {};
  const matricula = d.matricula || emp?.id?.slice(0, 12) || "";
  const missing: string[] = [];

  if (digits(ctx.cnpj).length !== 14) missing.push("CNPJ da empresa (ESOCIAL_CNPJ)");

  if (tipo === "S-1000") {
    const e = ctx.empresa;
    if (!/^\d{4}-\d{2}$/.test(e.iniValid)) missing.push("Início da validade (AAAA-MM)");
    if (!e.classTrib) missing.push("Classificação tributária");
    if (missing.length) return { ok: false, missing };
    const cadastro = g(
      "infoCadastro",
      x("classTrib", e.classTrib) + x("indCoop", "0") + x("indConstr", "0") + x("indDesFolha", e.indDesFolha || "0") + x("indOptRegEletron", e.indOptRegEletron || "0"),
    );
    const periodo = g("idePeriodo", x("iniValid", e.iniValid));
    const op = (ctx.operacao ?? "inclusao") === "alteracao" ? "alteracao" : "inclusao";
    const body = wrap(ideEvento(ctx, false) + ideEmpregador(ctx) + g("infoEmpregador", g(op, periodo + cadastro)));
    return { ok: true, tag: meta.tag, id, grupo: meta.grupo, xml: body };
  }

  if (!emp) return { ok: false, missing: [...missing, "Colaborador"] };
  if (digits(emp.cpf).length !== 11) missing.push("CPF (11 dígitos)");

  if (tipo === "S-2200") {
    const need: [string, string | null | undefined][] = [
      ["Nome completo", emp.full_name],
      ["Data de admissão", isoDate(emp.admitted_at)],
      ["Salário base", money(emp.salary)],
      ["Cargo", emp.role_title],
      ["CBO do cargo", digits(d.cbo)],
      ["Sexo", d.sexo],
      ["Raça/cor", d.racaCor],
      ["Grau de instrução", d.grauInstr],
      ["Data de nascimento", isoDate(d.dtNascto)],
      ["Endereço — logradouro", d.dscLograd],
      ["Endereço — número", d.nrLograd],
      ["Endereço — CEP", digits(d.cep)],
      ["Endereço — código do município (IBGE)", d.codMunic],
      ["Endereço — UF", d.uf],
      ["CNPJ do sindicato da categoria", digits(d.cnpjSind || ctx.empresa.cnpjSind)],
      ["Data de opção do FGTS", isoDate(d.dtOpcFGTS) || isoDate(emp.admitted_at)],
    ];
    for (const [label, v] of need) if (!v) missing.push(label);
    if (missing.length) return { ok: false, missing };
    const trabalhador = g(
      "trabalhador",
      x("cpfTrab", digits(emp.cpf)) +
        x("nmTrab", emp.full_name) +
        x("sexo", d.sexo) +
        x("racaCor", d.racaCor) +
        x("estCiv", d.estCiv) +
        x("grauInstr", d.grauInstr) +
        g("nascimento", x("dtNascto", isoDate(d.dtNascto)) + x("paisNascto", d.paisNascto || "105") + x("paisNac", d.paisNac || "105")) +
        g(
          "endereco",
          g(
            "brasil",
            x("tpLograd", d.tpLograd) +
              x("dscLograd", d.dscLograd) +
              x("nrLograd", d.nrLograd) +
              x("complemento", d.complemento) +
              x("bairro", d.bairro) +
              x("cep", digits(d.cep)) +
              x("codMunic", d.codMunic) +
              x("uf", d.uf),
          ),
        ) +
        g("contato", x("fonePrinc", digits(d.fonePrinc)) + x("emailPrinc", d.emailPrinc)),
    );
    const vinculo = g(
          "vinculo",
          x("matricula", matricula) +
            x("tpRegTrab", "1") +
            x("tpRegPrev", "1") +
            x("cadIni", "N") +
            g(
              "infoRegimeTrab",
              g(
                "infoCeletista",
                x("dtAdm", isoDate(emp.admitted_at)) +
                  x("tpAdmissao", d.tpAdmissao || "1") +
                  x("indAdmissao", "1") +
                  x("tpRegJor", d.tpRegJor || "1") +
                  x("natAtividade", d.natAtividade || "1") +
                  x("cnpjSindCategProf", digits(d.cnpjSind || ctx.empresa.cnpjSind)) +
                  g("FGTS", x("dtOpcFGTS", isoDate(d.dtOpcFGTS) || isoDate(emp.admitted_at))),
              ),
            ) +
            dadosContrato(emp, ctx, d),
    );
    return { ok: true, tag: meta.tag, id, grupo: meta.grupo, xml: wrap(ideEvento(ctx, true) + ideEmpregador(ctx) + trabalhador + vinculo) };
  }

  if (tipo === "S-2206") {
    const dtAlt = isoDate(params.dtAlteracao);
    if (!dtAlt) missing.push("Data da alteração");
    if (!money(emp.salary)) missing.push("Salário base");
    if (!digits(d.cbo)) missing.push("CBO do cargo");
    if (!digits(d.cnpjSind || ctx.empresa.cnpjSind)) missing.push("CNPJ do sindicato da categoria");
    if (missing.length) return { ok: false, missing };
    const alt = g(
      "altContratual",
      x("dtAlteracao", dtAlt) +
        x("dscAlt", params.dscAlt) +
        g(
          "vinculo",
          x("tpRegPrev", "1") +
            g(
              "infoRegimeTrab",
              g("infoCeletista", x("tpRegJor", d.tpRegJor || "1") + x("natAtividade", d.natAtividade || "1") + x("cnpjSindCategProf", digits(d.cnpjSind || ctx.empresa.cnpjSind))),
            ) +
            dadosContrato(emp, ctx, d),
        ),
    );
    const ide = g("ideVinculo", x("cpfTrab", digits(emp.cpf)) + x("matricula", matricula));
    return { ok: true, tag: meta.tag, id, grupo: meta.grupo, xml: wrap(ideEvento(ctx, true) + ideEmpregador(ctx) + ide + alt) };
  }

  if (tipo === "S-2230") {
    const modo = params.modo === "fim" ? "fim" : "inicio";
    const ide = g("ideVinculo", x("cpfTrab", digits(emp.cpf)) + x("matricula", matricula));
    let info = "";
    if (modo === "inicio") {
      if (!isoDate(params.dtIniAfast)) missing.push("Data de início do afastamento");
      if (!params.codMotAfast) missing.push("Motivo do afastamento (Tabela 18)");
      if (params.codMotAfast === "15" && !isoDate(params.perAquisInicio)) missing.push("Início do período aquisitivo (férias)");
      if (params.codMotAfast === "21" && !params.observacao) missing.push("Observação (obrigatória para o motivo 21)");
      if (missing.length) return { ok: false, missing };
      info = g(
        "iniAfastamento",
        x("dtIniAfast", isoDate(params.dtIniAfast)) +
          x("codMotAfast", params.codMotAfast) +
          x("observacao", params.observacao) +
          (params.codMotAfast === "15" ? g("perAquis", x("dtInicio", isoDate(params.perAquisInicio)) + x("dtFim", isoDate(params.perAquisFim))) : ""),
      );
    } else {
      if (!isoDate(params.dtTermAfast)) missing.push("Data de término do afastamento");
      if (missing.length) return { ok: false, missing };
      info = g("fimAfastamento", x("dtTermAfast", isoDate(params.dtTermAfast)));
    }
    return { ok: true, tag: meta.tag, id, grupo: meta.grupo, xml: wrap(ideEvento(ctx, true) + ideEmpregador(ctx) + ide + g("infoAfastamento", info)) };
  }

  // S-2299
  if (!params.mtvDeslig) missing.push("Motivo do desligamento (Tabela 19)");
  if (!isoDate(params.dtDeslig)) missing.push("Data do desligamento");
  if (missing.length) return { ok: false, missing };
  const ide = g("ideVinculo", x("cpfTrab", digits(emp.cpf)) + x("matricula", matricula));
  const deslig = g(
    "infoDeslig",
    x("mtvDeslig", params.mtvDeslig) +
      x("dtDeslig", isoDate(params.dtDeslig)) +
      x("indPagtoAPI", params.indPagtoAPI === "S" ? "S" : "N") +
      x("dtProjFimAPI", params.indPagtoAPI === "S" ? isoDate(params.dtProjFimAPI) : "") +
      x("pensAlim", "0") +
      g("observacoes", x("observacao", params.observacao)),
  );
  return { ok: true, tag: meta.tag, id, grupo: meta.grupo, xml: wrap(ideEvento(ctx, true) + ideEmpregador(ctx) + ide + deslig) };
}

/** Lote de envio (grupo 1 = tabelas, 2 = não periódicos). `eventosAssinados`: [{id, xml}] já assinados. */
export function buildLote(cnpj14: string, grupo: 1 | 2, eventosAssinados: { id: string; xml: string }[]): string {
  const c = digits(cnpj14);
  return (
    `<eSocial xmlns="http://www.esocial.gov.br/schema/lote/eventos/envio/v1_1_1">` +
    `<envioLoteEventos grupo="${grupo}">` +
    `<ideEmpregador><tpInsc>1</tpInsc><nrInsc>${c.slice(0, 8)}</nrInsc></ideEmpregador>` +
    `<ideTransmissor><tpInsc>1</tpInsc><nrInsc>${c}</nrInsc></ideTransmissor>` +
    `<eventos>${eventosAssinados.map((e) => `<evento Id="${e.id}">${e.xml}</evento>`).join("")}</eventos>` +
    `</envioLoteEventos></eSocial>`
  );
}
