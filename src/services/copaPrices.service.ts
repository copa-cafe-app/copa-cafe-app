// Feed de preços da Copa Café — a MESMA tabela publicada em coffeecopa.com/precos.html,
// lida direto do Google Sheets em CSV.
//
// Este é o preço que importa pro produtor: é o que a Copa paga pela saca. NÃO
// confundir com a cotação da bolsa (`coffee-prices`, ICE KC=F convertido pelo
// dólar), que serve só de referência de mercado na tela de cotações. Alerta de
// preço, simulação de venda e qualquer decisão do produtor usam ESTE número.
//
// Ficava embutido em app/(tabs)/cotacoes/index.tsx; foi extraído pra cá quando a
// tela de notificações precisou do mesmo dado (os alertas estavam comparando com
// o preço da bolsa, que é muito maior — e por isso disparavam errado).

import { parseBRL } from '../utils/format';

const COPA_CAFE_PRICES_URL =
  'https://docs.google.com/spreadsheets/d/1wNX2fPobme6rAE869H8Zrv82K8eCjaDadE30DHU48tc/gviz/tq?tqx=out:csv&sheet=tabela';

export interface CopaCafePrice {
  bebida: string;
  cata: string;
  preco: string;
}

export interface CopaCafeFeed {
  /** Data da tabela, como publicada na planilha (ex.: "24/07/2026"). */
  data: string;
  /** Linhas de preço com cata 20, Duro primeiro (mesma ordem exibida no app). */
  precos: CopaCafePrice[];
  /** Avisos da planilha (limites, condições de pagamento). */
  notas: string[];
}

export function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (ch === '"') {
      if (inQuotes && csv[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (current || row.length > 0) {
        row.push(current.trim());
        rows.push(row);
        row = [];
        current = '';
      }
      if (ch === '\r' && csv[i + 1] === '\n') i++;
    } else {
      current += ch;
    }
  }
  if (current || row.length > 0) {
    row.push(current.trim());
    rows.push(row);
  }
  return rows;
}

export async function fetchCopaPrices(): Promise<CopaCafeFeed> {
  const res = await fetch(COPA_CAFE_PRICES_URL);
  if (!res.ok) throw new Error(`Planilha de preços indisponível (${res.status})`);
  const rows = parseCSV(await res.text());

  // A data fica na linha rotulada "Data" (coluna 2), valor na coluna 3. O código
  // antigo lia `rows[1][3]` por índice fixo — mas rows[1] é a linha "Bebida", que
  // tem a coluna 3 vazia, então o selo de data NUNCA aparecia na tela. Procurar
  // pelo rótulo também sobrevive a alguém inserir uma linha na planilha.
  const linhaData = rows.find((r) => (r[2] || '').trim().toLowerCase() === 'data');
  const data = (linhaData?.[3] || '').trim();
  const precos: CopaCafePrice[] = [];
  const notas: string[] = [];

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length < 4) continue;
    const bebida = (row[2] || '').trim();
    const cata = (row[3] || '').trim();
    const preco = (row[4] || '').trim();
    if (!bebida) continue;

    const bebidaLower = bebida.toLowerCase();
    if (
      bebidaLower.includes('limite') ||
      bebidaLower.includes('pagamento') ||
      (bebidaLower.includes('café') && !preco)
    ) {
      notas.push(bebida + (cata ? ` ${cata}` : '') + (preco ? ` ${preco}` : ''));
      continue;
    }

    if (preco && preco.includes('R$') && cata.includes('20')) {
      if (bebidaLower.includes('rio') || bebidaLower.includes('bebida') || bebidaLower.includes('duro')) {
        precos.push({ bebida, cata, preco });
      }
    }
  }

  // Duro/Bebida antes de Rio — é o preço de destaque do app.
  precos.sort((a, b) => {
    const aIsDuro = a.bebida.toLowerCase().includes('duro');
    const bIsDuro = b.bebida.toLowerCase().includes('duro');
    if (aIsDuro && !bIsDuro) return -1;
    if (!aIsDuro && bIsDuro) return 1;
    return 0;
  });

  return { data, precos, notas };
}

/**
 * Preço de destaque em número (R$/saca): a primeira linha depois da ordenação,
 * ou seja, Bebida/Duro cata 20 — o mesmo valor que aparece em destaque na tela
 * de cotações. Retorna null se a planilha não trouxer nenhum preço utilizável.
 */
export function precoDestaque(feed: CopaCafeFeed): number | null {
  return feed.precos.length ? parseBRL(feed.precos[0].preco) : null;
}
