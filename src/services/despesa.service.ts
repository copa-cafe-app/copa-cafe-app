import { supabase } from './supabase';

// Operações de edição/exclusão de despesas de produção (tela Custos).
// Despesas com atividade_id vêm do Diário de Campo e são mantidas por
// atividade.service.ts (syncDespesa) — não devem ser editadas por aqui.

export interface DespesaRow {
  id: string;
  produtor_id: string;
  categoria: string;
  descricao: string;
  valor: number;
  data: string;
  safra: string | null;
  comprovante_url: string | null;
  vendor: string | null;
  origem?: string | null;
  atividade_id?: string | null;
}

/**
 * Converte um erro do Supabase/rede numa mensagem amigável em PT-BR.
 * Nunca devolve o err.message cru (que vem em inglês/técnico).
 */
export function mensagemErroAmigavel(err: unknown, fallback: string): string {
  const msg = String((err as any)?.message ?? err ?? '').toLowerCase();
  if (
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('tempo esgotado')
  ) {
    return 'Sem conexão com a internet (ou sinal fraco). Tente de novo quando o sinal melhorar.';
  }
  return fallback;
}

export const despesaService = {
  async get(id: string): Promise<DespesaRow | null> {
    const { data, error } = await supabase
      .from('despesas_producao')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return (data as DespesaRow) ?? null;
  },

  async update(id: string, fields: Partial<Omit<DespesaRow, 'id' | 'produtor_id'>>): Promise<void> {
    const { error } = await supabase
      .from('despesas_producao')
      .update(fields)
      .eq('id', id);
    if (error) throw error;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('despesas_producao')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
