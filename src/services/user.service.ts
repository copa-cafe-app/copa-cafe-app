import { supabase } from './supabase';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants/config';
import type { User, Propriedade } from '../types/user';

export const userService = {
  async checkDuplicate(params: { cpfCnpj?: string; telefone?: string; email?: string }): Promise<{ field: string; message: string } | null> {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/check-duplicate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ cpf_cnpj: params.cpfCnpj, telefone: params.telefone, email: params.email }),
    });
    const data = await res.json();
    if (data.duplicate) return { field: data.field, message: data.message };
    return null;
  },

  async createProfile(data: {
    id: string;
    nome: string;
    cpf_cnpj: string;
    email: string;
    telefone: string;
    estado: string;
    municipio: string;
  }): Promise<User> {
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        id: data.id,
        nome: data.nome,
        cpf_cnpj: data.cpf_cnpj,
        email: data.email,
        telefone: data.telefone,
        estado: data.estado,
        municipio: data.municipio,
        status: 'ACTIVE',
      })
      .select()
      .single();
    if (error) throw error;
    return user;
  },

  async getProfile(userId: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async createPropriedade(data: {
    produtor_id: string;
    nome: string;
    area_total_hectares: number;
    altitude_metros?: number;
    regiao_cafeeira?: string;
    municipio?: string;
    estado?: string;
  }): Promise<Propriedade> {
    const { data: prop, error } = await supabase
      .from('propriedades')
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return prop;
  },

  async getPropriedades(userId: string): Promise<Propriedade[]> {
    const { data, error } = await supabase
      .from('propriedades')
      .select('*')
      .eq('produtor_id', userId)
      .order('criado_em', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async recordConsent(userId: string, tipo: 'TERMOS_USO' | 'PRIVACIDADE') {
    const { error } = await supabase
      .from('consent_records')
      .insert({
        user_id: userId,
        tipo,
        aceito: true,
        versao_documento: '1.0',
      });
    if (error) throw error;
  },

  async updateLastLogin(userId: string) {
    await supabase
      .from('users')
      .update({ ultimo_login: new Date().toISOString() })
      .eq('id', userId);
  },
};
