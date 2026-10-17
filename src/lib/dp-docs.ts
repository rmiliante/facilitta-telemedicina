/** Documentos e ASO do Departamento Pessoal — listas e regras compartilhadas. */
export const DOC_KEYS: [string, string][] = [
  ["rg_cnh", "RG / CNH"],
  ["cpf", "CPF"],
  ["ctps", "CTPS digital"],
  ["pis", "PIS/NIS"],
  ["endereco", "Comprovante de endereço"],
  ["titulo", "Título de eleitor"],
  ["foto", "Foto 3x4"],
  ["certidao", "Certidão de nascimento/casamento"],
  ["bancarios", "Dados bancários"],
  ["vt", "Termo de vale-transporte"],
  ["contrato", "Contrato de trabalho assinado"],
  ["registro_prof", "Registro profissional (CRM/COREN etc.)"],
];

export const ASO_TIPOS: [string, string][] = [
  ["admissional", "Admissional"],
  ["periodico", "Periódico"],
  ["retorno", "Retorno ao trabalho"],
  ["mudanca_funcao", "Mudança de função"],
  ["demissional", "Demissional"],
];

export const ASO_RESULTADOS: [string, string][] = [
  ["apto", "Apto"],
  ["apto_restricao", "Apto com restrição"],
  ["inapto", "Inapto"],
];

export const ASO_TIPO_LABEL: Record<string, string> = Object.fromEntries(ASO_TIPOS);
export const ASO_RESULTADO_LABEL: Record<string, string> = Object.fromEntries(ASO_RESULTADOS);
