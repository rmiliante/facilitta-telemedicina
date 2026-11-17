import { getSupabaseAdmin } from "@/lib/supabase";
import { tipoReceitaDosItens } from "@/lib/controlledMeds";

export interface ItemRegistro {
  nome: string;
  quantidade?: string;
  posologia?: string;
}

/** Guarda os itens prescritos de um documento emitido (alimenta o relatório de prescrições). Nunca derruba a emissão. */
export async function registrarItens(input: {
  docPath: string;
  patientId: string;
  kind: string;
  itens: ItemRegistro[];
  origem?: "emissao" | "pdf";
}): Promise<void> {
  try {
    const { error } = await getSupabaseAdmin()
      .from("prescricao_itens")
      .upsert(
        {
          doc_path: input.docPath,
          patient_id: input.patientId,
          kind: input.kind,
          tipo_receita: input.kind === "receita" ? tipoReceitaDosItens(input.itens.map((i) => i.nome)) : null,
          itens: input.itens,
          origem: input.origem ?? "emissao",
        },
        { onConflict: "doc_path" }
      );
    if (error) console.error("Prescrições: não foi possível registrar os itens", error.message);
  } catch (e) {
    console.error("Prescrições: falha ao registrar itens", e);
  }
}
