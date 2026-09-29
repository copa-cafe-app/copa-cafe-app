// Operações e textos compartilhados dos lotes (lista, detalhe e cadastro).

import { Linking } from 'react-native';
import { supabase } from './supabase';
import { WHATSAPP_NEGOCIACAO } from '../constants/config';
import { formatBRL } from '../utils/format';
import type { LotePricing } from '../utils/lotePricing';

export interface Lote {
  id: string;
  produtor_id: string;
  variedade: string;
  processo: string;
  safra: string;
  peneira: string | null;
  quantidade_sacas: number;
  preco_por_saca: number | null;
  preco_negociavel: boolean | null;
  bebida: string | null;
  cata: number | null;
  notas_sensoriais: string | null;
  status: string;
  altitude_metros: number | null;
  data_colheita: string | null;
  qrcode_hash: string | null;
  propriedade_id: string | null;
  ofertado_copa_em: string | null;
  amostra_status: AmostraStatus | null;
  amostra_enviada_em: string | null;
  amostra_avaliada_em: string | null;
  amostra_motivo: string | null;
  criado_em: string;
}

export type AmostraStatus = 'ENVIADA' | 'APROVADA' | 'REPROVADA';

export const amostraConfig: Record<AmostraStatus, { label: string; color: string; bg: string; icon: string }> = {
  ENVIADA: { label: 'Amostra em avaliação', color: '#E65100', bg: '#FFF3E0', icon: 'clock' },
  APROVADA: { label: 'Amostra aprovada', color: '#2E7D32', bg: '#E8F5E9', icon: 'check-circle' },
  REPROVADA: { label: 'Amostra reprovada', color: '#C62828', bg: '#FFEBEE', icon: 'x-circle' },
};

/**
 * Marca a amostra do lote como enviada. O trigger lotes_guard_amostra grava a
 * data e só aceita esse passo a partir de "sem amostra" ou "reprovada".
 */
export async function enviarAmostra(loteId: string, produtorId: string) {
  const { data, error } = await supabase
    .from('lotes')
    .update({ amostra_status: 'ENVIADA' })
    .eq('id', loteId)
    .eq('produtor_id', produtorId)
    .select('amostra_status, amostra_enviada_em, amostra_avaliada_em, amostra_motivo')
    .single();
  if (error) throw error;
  return data as Pick<Lote, 'amostra_status' | 'amostra_enviada_em' | 'amostra_avaliada_em' | 'amostra_motivo'>;
}

/** Texto do WhatsApp avisando a Copa que a amostra foi enviada. */
export function mensagemAmostraLote(lote: Lote, ctx: OfertaContexto): string {
  const linhas: string[] = [];
  linhas.push('Olá, Copa Café! Enviei uma amostra para avaliação.');
  linhas.push('');
  linhas.push(`*Lote ${codigoLote(lote)}*`);
  if (ctx.produtorNome?.trim()) linhas.push(`Produtor: ${ctx.produtorNome.trim()}`);
  const local = [ctx.municipio?.trim(), ctx.estado?.trim()].filter(Boolean).join('/');
  const fazenda = [ctx.fazendaNome?.trim(), local].filter(Boolean).join(' – ');
  if (fazenda) linhas.push(`Fazenda: ${fazenda}`);
  linhas.push(`Safra: ${lote.safra} • ${lote.quantidade_sacas} ${lote.quantidade_sacas === 1 ? 'saca' : 'sacas'}`);
  if (lote.bebida) linhas.push(`Bebida: ${lote.bebida}`);
  if (lote.cata != null) linhas.push(`Cata: ${lote.cata}%`);
  linhas.push('');
  linhas.push('O resultado da avaliação aparece no app.');
  linhas.push('_Enviado pelo app Copa Café_');
  return linhas.join('\n');
}

export const processoLabels: Record<string, string> = {
  NATURAL: 'Natural', LAVADO: 'Lavado', HONEY: 'Honey',
  DESCASCADO: 'Descascado', CEREJA_DESCASCADO: 'Cereja Descascado', OUTRO: 'Outro',
};

/** Código curto do lote, pra o produtor e a Copa se referirem a ele. */
export function codigoLote(lote: Pick<Lote, 'id' | 'qrcode_hash'>): string {
  return lote.qrcode_hash || `#${lote.id.substring(0, 8).toUpperCase()}`;
}

/** Mensagem amigável pra erros de rede/banco — nunca mostrar err.message cru. */
export function mensagemErroLote(err: unknown, acao: string): string {
  const msg = String((err as any)?.message || '').toLowerCase();
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout')) {
    return `Sem conexão com a internet. Verifique o sinal e tente ${acao} de novo.`;
  }
  return `Não foi possível ${acao}. Tente de novo em instantes.`;
}

/** Exclui o lote do próprio produtor. Lança erro se nada foi apagado. */
export async function excluirLote(id: string, produtorId: string): Promise<void> {
  const { data, error } = await supabase
    .from('lotes')
    .delete()
    .eq('id', id)
    .eq('produtor_id', produtorId)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('lote não encontrado');
}

export interface OfertaContexto {
  produtorNome?: string | null;
  fazendaNome?: string | null;
  municipio?: string | null;
  estado?: string | null;
}

/** Texto pré-preenchido do WhatsApp para oferecer o lote à Copa. */
export function mensagemOfertaLote(lote: Lote, pricing: LotePricing | null, ctx: OfertaContexto): string {
  const linhas: string[] = [];
  linhas.push('Olá, Copa Café! Quero oferecer um lote de café.');
  linhas.push('');
  linhas.push(`*Lote ${codigoLote(lote)}*`);
  if (ctx.produtorNome?.trim()) linhas.push(`Produtor: ${ctx.produtorNome.trim()}`);
  const local = [ctx.municipio?.trim(), ctx.estado?.trim()].filter(Boolean).join('/');
  const fazenda = [ctx.fazendaNome?.trim(), local].filter(Boolean).join(' – ');
  if (fazenda) linhas.push(`Fazenda: ${fazenda}`);
  linhas.push(`Safra: ${lote.safra}`);
  linhas.push(`Quantidade: ${lote.quantidade_sacas} ${lote.quantidade_sacas === 1 ? 'saca' : 'sacas'}`);
  if (lote.bebida) linhas.push(`Bebida: ${lote.bebida}`);
  if (lote.cata != null) linhas.push(`Cata: ${lote.cata}%`);
  if (lote.peneira) linhas.push(`Peneira: ${lote.peneira}`);
  linhas.push(`Variedade: ${lote.variedade} (${processoLabels[lote.processo] || lote.processo})`);
  if (lote.preco_por_saca) linhas.push(`Meu preço: ${formatBRL(lote.preco_por_saca)}/saca`);
  if (pricing) {
    linhas.push('');
    linhas.push(
      `Referência Copa${pricing.dataTabela ? ` (tabela de ${pricing.dataTabela})` : ''}: ` +
        `${pricing.linhaUsada} – ${formatBRL(pricing.precoRef)}/saca`
    );
    linhas.push(`Valor estimado: ${formatBRL(pricing.valorEstimado)}`);
  }
  linhas.push('');
  linhas.push('Posso enviar amostra para avaliação.');
  linhas.push('_Enviado pelo app Copa Café_');
  return linhas.join('\n');
}

/** Abre o WhatsApp de negociação da Copa com o texto. Retorna false se não abriu. */
export async function abrirWhatsAppCopa(texto: string): Promise<boolean> {
  const url = `https://wa.me/${WHATSAPP_NEGOCIACAO}?text=${encodeURIComponent(texto)}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
