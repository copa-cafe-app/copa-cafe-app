import { supabase } from './supabase';
import type { Atividade, AtividadeTipo } from '../types/atividade';

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

  async create(atividade: {
    produtor_id: string;
    tipo: AtividadeTipo;
    titulo: string;
    descricao?: string;
    data: string;
    custo?: number;
  }): Promise<Atividade> {
    const { data, error } = await supabase
      .from('atividades_campo')
      .insert(atividade)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async update(id: string, fields: {
    tipo?: AtividadeTipo;
    titulo?: string;
    descricao?: string;
    custo?: number | null;
  }): Promise<Atividade> {
    const { data, error } = await supabase
      .from('atividades_campo')
      .update(fields)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('atividades_campo')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
