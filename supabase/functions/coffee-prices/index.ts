import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Converte preço da ICE (centavos de dólar por libra) para reais por saca de 60kg
// 1 saca = 132.277 libras (60kg)
// A conversão do ICE para R$/saca foi REMOVIDA de propósito (24/07/2026).
// O ICE (KC=F) é referência de mercado internacional e é publicado em US¢/lb —
// convertê-lo para reais por saca sugeria um preço de venda comparável ao da
// Copa, e três telas acabaram usando esse número no lugar do preço real.
// O preço divulgado ao produtor é sempre o da tabela da Copa Café do dia
// (src/services/copaPrices.service.ts). Esta função devolve o ICE só em dólar.

// Helper: fetch with timeout (Deno Edge Functions podem travar em fetches longos)
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// Helper: extract Yahoo Finance KC=F data from chart response
function extractYahooData(yahooData: any): { centsLb: number; variacao: number; prevClose: number } | null {
  const result = yahooData?.chart?.result?.[0];
  if (!result) return null;

  // Try indicators.quote first (chart data)
  const closes = result.indicators?.quote?.[0]?.close?.filter((c: any) => c != null) || [];
  if (closes.length >= 1) {
    const centsLb = closes[closes.length - 1];
    let variacao = 0;
    let prevClose = 0;
    if (closes.length >= 2) {
      prevClose = closes[closes.length - 2];
      variacao = Math.round(((centsLb - prevClose) / prevClose) * 1000) / 10;
    }
    return { centsLb, variacao, prevClose };
  }

  // Fallback: use meta.regularMarketPrice (always available, even when market is closed)
  if (result.meta?.regularMarketPrice) {
    const centsLb = result.meta.regularMarketPrice;
    let variacao = 0;
    const prevClose = result.meta?.chartPreviousClose || 0;
    if (prevClose > 0) {
      variacao = Math.round(((centsLb - prevClose) / prevClose) * 1000) / 10;
    }
    return { centsLb, variacao, prevClose };
  }

  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Debug info para diagnosticar problemas
  const debug: string[] = [];

  try {
    // ===== DÓLAR: AwesomeAPI (cotação de mercado em tempo real) =====
    // AwesomeAPI retorna a última cotação disponível mesmo com mercado fechado
    let usdBrl = 0;
    let dolarCompra = 0;
    let dolarVenda = 0;
    let dolarVariacao = 0;
    let dolarFonte = 'AwesomeAPI';
    let dolarTimestamp = '';

    try {
      const awesomeRes = await fetchWithTimeout('https://economia.awesomeapi.com.br/json/last/USD-BRL');
      if (!awesomeRes.ok) {
        debug.push(`AwesomeAPI HTTP ${awesomeRes.status}`);
      } else {
        const awesomeData = await awesomeRes.json();
        const usdData = awesomeData?.USDBRL;
        if (usdData) {
          dolarCompra = parseFloat(usdData.bid);
          dolarVenda = parseFloat(usdData.ask);
          usdBrl = dolarVenda; // usar venda para conversão
          dolarVariacao = parseFloat(usdData.pctChange) || 0;
          dolarTimestamp = usdData.create_date || '';
          debug.push(`AwesomeAPI OK: bid=${usdData.bid} ask=${usdData.ask} date=${dolarTimestamp}`);
        } else {
          debug.push('AwesomeAPI: response OK mas sem USDBRL');
        }
      }
    } catch (e: any) {
      debug.push(`AwesomeAPI erro: ${e.name === 'AbortError' ? 'timeout' : e.message}`);
    }

    // Fallback se AwesomeAPI falhar
    if (usdBrl === 0) {
      try {
        const fallbackRes = await fetchWithTimeout('https://api.exchangerate-api.com/v4/latest/USD');
        const fallbackData = await fallbackRes.json();
        if (fallbackData?.rates?.BRL) {
          usdBrl = fallbackData.rates.BRL;
          dolarCompra = usdBrl;
          dolarVenda = usdBrl;
          dolarFonte = 'ExchangeRate API';
          debug.push(`ExchangeRate fallback OK: ${usdBrl}`);
        }
      } catch (e: any) {
        debug.push(`ExchangeRate fallback erro: ${e.message}`);
        usdBrl = 5.70; // fallback hardcoded
        dolarCompra = usdBrl;
        dolarVenda = usdBrl;
        dolarFonte = 'Fallback (offline)';
      }
    }

    // ===== CAFÉ BOLSA: Yahoo Finance - ICE Coffee C Futures (KC=F) =====
    let arabicaCentsLb = 0;
    let arabicaVariacao = 0;
    let arabicaPrevClose = 0;
    let bolsaFonte = 'ICE Futures (Yahoo Finance)';

    // Estratégia: tentar múltiplos endpoints Yahoo Finance em sequência
    // v8 chart API com query1 e query2, depois v10 como fallback
    const yahooEndpoints = [
      {
        url: 'https://query1.finance.yahoo.com/v8/finance/chart/KC=F?interval=1d&range=5d',
        name: 'Yahoo v8 query1',
      },
      {
        url: 'https://query2.finance.yahoo.com/v8/finance/chart/KC=F?interval=1d&range=5d',
        name: 'Yahoo v8 query2',
      },
      {
        url: 'https://query1.finance.yahoo.com/v8/finance/chart/KC=F?interval=1d&range=1mo',
        name: 'Yahoo v8 query1 (1mo range)',
      },
    ];

    const yahooHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
    };

    for (const endpoint of yahooEndpoints) {
      if (arabicaCentsLb > 0) break; // já conseguiu dados

      try {
        const res = await fetchWithTimeout(endpoint.url, { headers: yahooHeaders }, 10000);
        if (!res.ok) {
          debug.push(`${endpoint.name}: HTTP ${res.status}`);
          continue;
        }

        const data = await res.json();

        // Verificar se Yahoo retornou erro no JSON
        if (data?.chart?.error) {
          debug.push(`${endpoint.name}: chart error = ${JSON.stringify(data.chart.error)}`);
          continue;
        }

        const extracted = extractYahooData(data);
        if (extracted && extracted.centsLb > 0) {
          arabicaCentsLb = extracted.centsLb;
          arabicaVariacao = extracted.variacao;
          arabicaPrevClose = extracted.prevClose;
          debug.push(`${endpoint.name} OK: ${arabicaCentsLb} cents/lb`);
          break;
        } else {
          debug.push(`${endpoint.name}: resposta OK mas sem dados de preço`);
        }
      } catch (e: any) {
        debug.push(`${endpoint.name} erro: ${e.name === 'AbortError' ? 'timeout (10s)' : e.message}`);
      }
    }

    if (arabicaCentsLb === 0) {
      bolsaFonte = 'Indisponível';
      debug.push('Bolsa: todas as fontes falharam');
    }

    const response = {
      cambio: {
        usd_brl: usdBrl,
        compra: dolarCompra,
        venda: dolarVenda,
        variacao_percent: dolarVariacao,
        fonte: dolarFonte,
        ultima_cotacao: dolarTimestamp || undefined,
      },
      bolsa: {
        cents_per_lb: Math.round(arabicaCentsLb * 100) / 100,
        variacao_percent: arabicaVariacao,
        fonte: bolsaFonte,
        simbolo: 'KC=F',
      },
      atualizado_em: new Date().toISOString(),
      _debug: debug,
    };

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: err.message || 'Erro ao buscar cotações',
        _debug: debug,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
