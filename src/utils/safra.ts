// Safra cafeeira corrente, derivada da data (única fonte de verdade).
// Antes o valor "2025/26" estava cravado em ~8 lugares e quebraria na virada.
//
// No Brasil o ano-safra do café vira por volta de julho. Usamos julho como
// corte: de jul/2026 em diante -> "2026/27"; antes disso -> "2025/26".
// (Ajuste MES_VIRADA se a convenção da sua região for outra.)
const MES_VIRADA = 7; // julho

/** Retorna a safra corrente no formato "AAAA/AA" (ex.: "2025/26"). */
export function safraAtual(date: Date = new Date()): string {
  const ano = date.getFullYear();
  const mes = date.getMonth() + 1; // 1-12
  const inicio = mes >= MES_VIRADA ? ano : ano - 1;
  return `${inicio}/${String((inicio + 1) % 100).padStart(2, '0')}`;
}

const fmtSafra = (anoInicio: number) =>
  `${anoInicio}/${String((anoInicio + 1) % 100).padStart(2, '0')}`;

/** Lista das N últimas safras (corrente primeiro) para seletores. */
export function safrasRecentes(n = 3, date: Date = new Date()): string[] {
  const inicio = parseInt(safraAtual(date).split('/')[0], 10);
  return Array.from({ length: n }, (_, i) => fmtSafra(inicio - i));
}

/** Safras para o cadastro de lote: próxima (planejamento), corrente e anterior. */
export function safrasSelecao(date: Date = new Date()): string[] {
  const inicio = parseInt(safraAtual(date).split('/')[0], 10);
  return [inicio + 1, inicio, inicio - 1].map(fmtSafra);
}
