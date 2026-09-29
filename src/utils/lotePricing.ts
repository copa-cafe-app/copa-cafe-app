// Preço de referência da Copa para um lote do produtor.
//
// Função PURA: recebe o lote e a tabela já buscada (fetchCopaPriceTable) e
// devolve qual linha da tabela vale para aquele lote. Nunca inventa preço:
// se a bebida ou a cata do lote não tiverem linha correspondente, retorna null
// e `motivoSemPrecoCopa` explica o porquê (pra tela orientar o produtor).
//
// A tabela da Copa tem hoje dois tipos — "Duro" e "Rio Minas" — cada um com
// catas 20%, 25% e 30%. O cadastro do lote usa a classificação de bebida
// tradicional (Estritamente Mole ... Rio Zona) e a cata em %:
//
//   Bebida do lote                          → Tipo na tabela
//   Dura                                    → Duro
//   Estritamente Mole / Mole / Apenas Mole  → Duro (piso: bebida mais fina pode valer mais)
//   Riada                                   → Rio Minas (referência conservadora)
//   Rio                                     → Rio Minas
//   Rio Zona / sem bebida                   → sem referência (null)
//
//   Cata do lote → menor faixa da tabela que seja >= cata (ex.: 22% → linha 25%).
//   Sem cata → faixa 20% (padrão da Copa), avisando. Acima da maior faixa → null.

import type { CopaPriceRow, CopaPriceTable } from '../services/copaPrices.service';

export interface LoteParaPreco {
  bebida: string | null;
  cata: number | null;
  quantidade_sacas: number;
  safra?: string | null;
}

export interface LotePricing {
  /** Preço de referência em R$/saca. */
  precoRef: number;
  /** Linha usada, legível (ex.: "Duro 20%"). */
  linhaUsada: string;
  /** precoRef × sacas. */
  valorEstimado: number;
  /** Data da tabela (ex.: "29/09/2026"). */
  dataTabela: string;
  /** Safra da linha usada (ex.: "26/27"), se a planilha informar. */
  safraTabela: string;
  /** Avisos sobre aproximações feitas no casamento (vazio = casamento exato). */
  observacoes: string[];
}

type TipoTabela = 'duro' | 'rio';

function norm(s: string | null | undefined): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function tipoParaBebida(bebida: string | null): { tipo: TipoTabela; nota?: string } | null {
  const b = norm(bebida);
  if (!b) return null;
  if (b.includes('zona')) return null; // Rio Zona: inferior ao Rio, sem linha na tabela
  if (b === 'dura' || b === 'duro') return { tipo: 'duro' };
  if (b.includes('mole')) {
    return {
      tipo: 'duro',
      nota: 'A tabela não tem bebida mole; usamos Duro como piso — a amostra pode valer mais.',
    };
  }
  if (b === 'riada') {
    return { tipo: 'rio', nota: 'A tabela não tem Riada; usamos Rio Minas (referência conservadora).' };
  }
  if (b === 'rio') return { tipo: 'rio' };
  return null;
}

function linhasDoTipo(tabela: CopaPriceTable, tipo: TipoTabela): CopaPriceRow[] {
  return tabela.linhas
    .filter((l) => l.cataPct != null && norm(l.tipo).includes(tipo))
    .sort((a, b) => (a.cataPct as number) - (b.cataPct as number));
}

/** "2026/27" ou "26/27" → "26/27" (pra comparar com a coluna safra da planilha). */
function safraCurta(s: string | null | undefined): string {
  const m = String(s ?? '').match(/(\d{2})\s*\/\s*(\d{2})\s*$/);
  return m ? `${m[1]}/${m[2]}` : '';
}

export function precoCopaParaLote(lote: LoteParaPreco, tabela: CopaPriceTable | null): LotePricing | null {
  if (!tabela || !tabela.linhas.length) return null;
  const sacas = Number(lote.quantidade_sacas);
  if (!Number.isFinite(sacas) || sacas <= 0) return null;

  const tipo = tipoParaBebida(lote.bebida);
  if (!tipo) return null;
  const linhas = linhasDoTipo(tabela, tipo.tipo);
  if (!linhas.length) return null;

  const observacoes: string[] = [];
  if (tipo.nota) observacoes.push(tipo.nota);

  let linha: CopaPriceRow | undefined;
  if (lote.cata == null) {
    linha = linhas.find((l) => l.cataPct === 20) ?? linhas[0];
    observacoes.push(`Cata não informada — consideramos ${linha.cataPct}%.`);
  } else {
    linha = linhas.find((l) => (l.cataPct as number) >= (lote.cata as number));
    if (!linha) return null; // cata pior que a maior faixa da tabela
  }

  const safraLote = safraCurta(lote.safra);
  if (safraLote && linha.safra && safraLote !== safraCurta(linha.safra)) {
    observacoes.push(`A tabela é da safra ${linha.safra}; seu lote é da safra ${lote.safra}.`);
  }

  return {
    precoRef: linha.preco,
    linhaUsada: `${linha.tipo} ${linha.cataPct}%`,
    valorEstimado: Math.round(linha.preco * sacas * 100) / 100,
    dataTabela: tabela.data,
    safraTabela: linha.safra,
    observacoes,
  };
}

/** Explica, em PT-BR simples, por que o lote ficou sem preço de referência. */
export function motivoSemPrecoCopa(lote: LoteParaPreco, tabela: CopaPriceTable | null): string {
  if (!tabela || !tabela.linhas.length) return 'A tabela de preços da Copa não está disponível agora.';
  const b = norm(lote.bebida);
  if (!b) return 'Informe a bebida do lote (ex.: Dura, Rio) para ver o preço de referência.';
  const tipo = tipoParaBebida(lote.bebida);
  if (!tipo) return `A tabela da Copa não tem preço para bebida "${lote.bebida}". Fale com a Copa pelo WhatsApp.`;
  const linhas = linhasDoTipo(tabela, tipo.tipo);
  if (!linhas.length) return 'A tabela de hoje não traz preço para esse tipo de café.';
  const maior = linhas[linhas.length - 1].cataPct;
  if (lote.cata != null && maior != null && lote.cata > maior) {
    return `A tabela vai até cata ${maior}%. Para cata ${lote.cata}%, fale com a Copa pelo WhatsApp.`;
  }
  return 'Não encontramos um preço de referência para este lote.';
}
