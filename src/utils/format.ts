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
 *
 * Exceção: alguns teclados decimais do Android só mostram '.', então "45.5"
 * (sem vírgula, um único ponto seguido de 1–2 dígitos no fim) é lido como
 * decimal -> 45.5. Já "1.480" (3 dígitos após o ponto) continua sendo milhar.
 */
export function parseBRL(value: string | null | undefined): number | null {
  if (value == null) return null;
  const raw = String(value).trim().replace(/[^0-9.,-]/g, '');
  const pontoDecimal = !raw.includes(',') && /^-?\d*\.\d{1,2}$/.test(raw);
  const cleaned = pontoDecimal
    ? raw
    : raw
        .replace(/\./g, '')   // remove separador de milhar
        .replace(',', '.');   // vírgula decimal -> ponto
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}
