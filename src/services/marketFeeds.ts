// Fetchers com timeout + validação para as telas de preço (home, cotações e a
// tela pública /precos). O cache em si fica no hook useCachedResource.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants/config';
import { fetchCopaPrices, type CopaCafeFeed } from './copaPrices.service';
import { fetchWithTimeout, withTimeout } from '../utils/fetchWithTimeout';

export interface MarketData {
  cambio: {
    usd_brl: number;
    compra: number;
    venda: number;
    variacao_percent: number;
    fonte: string;
    ultima_cotacao?: string;
  };
  bolsa: {
    // ICE só em dólar — a conversão pra R$/saca saiu da Edge Function de
    // propósito. Preço em reais é sempre o da Copa (copaPrices.service).
    cents_per_lb: number;
    variacao_percent: number;
    fonte: string;
    simbolo: string;
  };
  atualizado_em: string;
  _debug?: string[];
}

/** Tabela da Copa (planilha). Falha se vier sem nenhum preço — pra não sobrescrever o cache com vazio. */
export async function fetchCopaFeed(): Promise<CopaCafeFeed> {
  const feed = await withTimeout(fetchCopaPrices());
  if (!feed.precos.length) throw new Error('Tabela sem preços');
  return feed;
}

/** Bolsa + dólar (edge function coffee-prices, pública). */
export async function fetchMarketData(): Promise<MarketData> {
  const res = await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/coffee-prices`, {
    headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data || typeof data !== 'object' || !data.cambio) throw new Error('Resposta inválida');
  return data as MarketData;
}
