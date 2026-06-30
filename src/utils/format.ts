// Helpers de formatação/parse numérico em padrão brasileiro.
// Centraliza o que antes estava espalhado e divergente pelas telas.

/**
 * Formata um número como moeda BRL: 1480.5 -> "R$ 1.480,50".
 * Sempre usa 2 casas decimais. Valores inválidos/nulos viram "R$ 0,00".
 * Passe withSymbol=false para obter só "1.480,50".
 */
export function formatBRL(value: number | null | undefined, withSymbol = true): string {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  const formatted = safe.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return withSymbol ? `R$ ${formatted}` : formatted;
}

/**
 * Converte uma string digitada em padrão BR ("1.480,00", "45,5", "2000")
 * para número. O ponto é tratado como separador de milhar e a vírgula como
 * decimal. Retorna null quando vazio/ inválido (em vez de NaN).
 */
export function parseBRL(value: string | null | undefined): number | null {
  if (value == null) return null;
  const cleaned = String(value)
    .trim()
    .replace(/\./g, '')   // remove separador de milhar
    .replace(',', '.')    // vírgula decimal -> ponto
    .replace(/[^0-9.-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}
