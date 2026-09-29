import { supabase } from './supabase';
import type { Atividade, AtividadeTipo } from '../types/atividade';
import { safraDaData } from '../utils/safra';

// Mapeia o tipo de atividade do Diário para a categoria de despesa de produção.
const TIPO_TO_CATEGORIA: Record<AtividadeTipo, string> = {
  ADUBACAO: 'INSUMOS',
  PULVERIZACAO: 'DEFENSIVOS',
  PODA: 'MAO_DE_OBRA',
  COLHEITA: 'MAO_DE_OBRA',
  IRRIGACAO: 'OUTROS',
  OUTRO: 'OUTROS',
};

// Erro ao lançar/atualizar o custo da atividade em Custos de Produção.
// A mensagem já é amigável (PT-BR) — a tela pode mostrar err.message direto.
export class SyncDespesaError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = 'SyncDespesaError';
  }
}

// Cria/atualiza a despesa vinculada a uma atividade (origem='DIARIO').
// Se a atividade não tem custo, remove a despesa vinculada (se houver).
// Lança SyncDespesaError se o banco recusar (antes o erro era ignorado e o
// custo sumia de Custos sem aviso).
async function syncDespesa(
  atividade: Atividade,
  comprovanteUrl?: string | null,
): Promise<void> {
  const temCusto = typeof atividade.custo === 'number' && atividade.custo > 0;

  if (!temCusto) {
    const { error } = await supabase.from('despesas_producao').delete().eq('atividade_id', atividade.id);
    if (error) {
      throw new SyncDespesaError(
        'A atividade foi salva, mas não conseguimos remover o custo dela em Custos de Produção. Verifique sua internet e salve de novo.',
        error,
      );
    }
    return;
  }

  const row: Record<string, any> = {
    atividade_id: atividade.id,
    produtor_id: atividade.produtor_id,
    origem: 'DIARIO',
    categoria: TIPO_TO_CATEGORIA[atividade.tipo] || 'OUTROS',
    descricao: atividade.titulo,
    valor: atividade.custo,
    data: atividade.data,
    // Safra pela data da atividade, não pela data de hoje.
    safra: safraDaData(atividade.data),
  };
  // Só sobrescreve o comprovante quando um novo é enviado (undefined = manter).
  if (comprovanteUrl !== undefined) row.comprovante_url = comprovanteUrl;

  const { error } = await supabase.from('despesas_producao').upsert(row, { onConflict: 'atividade_id' });
  if (error) {
    throw new SyncDespesaError(
      'A atividade foi salva, mas o custo não entrou em Custos de Produção. Verifique sua internet e salve de novo.',
      error,
    );
  }
}

export const atividadeService = {
  async listByMonth(userId: string, year: number, month: number): Promise<Atividade[]> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    const { data, error } = await supabase
      .from('atividades_campo')
      .select('*')
      .eq('produtor_id', userId)
      .gte('data', startDate)
      .lt('data', endDate)
      .order('data', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Busca atividades num intervalo de datas arbitrário (FB7 — relatório por período).
  // startDate/endDate em ISO (YYYY-MM-DD), ambos inclusivos.
  async listByRange(userId: string, startDate: string, endDate: string): Promise<Atividade[]> {
    const { data, error } = await supabase
      .from('atividades_campo')
      .select('*')
      .eq('produtor_id', userId)
      .gte('data', startDate)
      .lte('data', endDate)
      .order('data', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async create(atividade: {
    produtor_id: string;
    tipo: AtividadeTipo;
    titulo: string;
    descricao?: string;
    data: string;
    custo?: number;
  }, comprovanteUrl?: string | null): Promise<Atividade> {
    const { data, error } = await supabase
      .from('atividades_campo')
      .insert(atividade)
      .select()
      .single();

    if (error) throw error;
    try {
      await syncDespesa(data as Atividade, comprovanteUrl);
    } catch (err) {
      // Desfaz a atividade recém-criada para que "salvar de novo" não duplique.
      await supabase.from('atividades_campo').delete().eq('id', (data as Atividade).id);
      throw new SyncDespesaError(
        'Não foi possível salvar a atividade com o custo. Verifique sua internet e tente novamente.',
        err,
      );
    }
    return data;
  },

  async update(id: string, fields: {
    tipo?: AtividadeTipo;
    titulo?: string;
    descricao?: string;
    custo?: number | null;
  }, comprovanteUrl?: string | null): Promise<Atividade> {
    const { data, error } = await supabase
      .from('atividades_campo')
      .update(fields)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    await syncDespesa(data as Atividade, comprovanteUrl);
    return data;
  },

  async remove(id: string): Promise<void> {
    // A despesa vinculada some via ON DELETE CASCADE.
    const { error } = await supabase
      .from('atividades_campo')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
