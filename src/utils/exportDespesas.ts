import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { User } from '../types/user';

export interface DespesaExport {
  id: string;
  categoria: string;
  descricao: string;
  valor: number;
  data: string;
  vendor?: string | null;
  comprovante_url?: string | null;
}

const categoriaLabels: Record<string, string> = {
  INSUMOS: 'Insumos',
  MAO_DE_OBRA: 'Mão de obra',
  DEFENSIVOS: 'Defensivos',
  MAQUINAS: 'Máquinas',
  TRANSPORTE: 'Transporte',
  OUTROS: 'Outros',
};

function brl(n: number): string {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateBR(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return iso;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function escapeHtml(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHtml(profile: User | null, despesas: DespesaExport[], periodoLabel: string): string {
  const total = despesas.reduce((s, d) => s + d.valor, 0);

  const porCategoria: Record<string, { total: number; count: number }> = {};
  for (const d of despesas) {
    const k = d.categoria;
    if (!porCategoria[k]) porCategoria[k] = { total: 0, count: 0 };
    porCategoria[k].total += d.valor;
    porCategoria[k].count += 1;
  }

  const categoriaRows = Object.entries(porCategoria)
    .sort((a, b) => b[1].total - a[1].total)
    .map(
      ([cat, info]) => `
        <tr>
          <td>${escapeHtml(categoriaLabels[cat] || cat)}</td>
          <td style="text-align:center">${info.count}</td>
          <td style="text-align:right">R$ ${brl(info.total)}</td>
          <td style="text-align:right">${((info.total / total) * 100).toFixed(1)}%</td>
        </tr>`
    )
    .join('');

  const detalheRows = despesas
    .slice()
    .sort((a, b) => a.data.localeCompare(b.data))
    .map(
      (d) => `
        <tr>
          <td>${formatDateBR(d.data)}</td>
          <td>${escapeHtml(categoriaLabels[d.categoria] || d.categoria)}</td>
          <td>${escapeHtml(d.descricao)}</td>
          <td>${escapeHtml(d.vendor || '-')}</td>
          <td style="text-align:right">R$ ${brl(d.valor)}</td>
        </tr>`
    )
    .join('');

  const geradoEm = new Date().toLocaleString('pt-BR');
  const nome = escapeHtml(profile?.nome || '');
  const cpf = escapeHtml(profile?.cpf_cnpj || '');
  const municipio = escapeHtml(profile?.municipio || '');
  const estado = escapeHtml(profile?.estado || '');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Relatório de Despesas</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #1a1a1a; padding: 24px; font-size: 12px; }
    h1 { font-size: 22px; margin: 0 0 4px; color: #2e7d32; }
    h2 { font-size: 14px; margin: 24px 0 8px; border-bottom: 2px solid #2e7d32; padding-bottom: 4px; color: #2e7d32; }
    .sub { color: #666; font-size: 11px; margin-bottom: 16px; }
    .infoBox { background: #f5f5f5; padding: 12px; border-radius: 6px; margin-bottom: 16px; }
    .infoBox p { margin: 2px 0; }
    .infoBox strong { display: inline-block; min-width: 110px; }
    .totalBox { background: #2e7d32; color: white; padding: 16px; border-radius: 6px; margin: 12px 0; text-align: center; }
    .totalBox .label { font-size: 11px; opacity: 0.85; }
    .totalBox .valor { font-size: 24px; font-weight: bold; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #eaeaea; padding: 8px; text-align: left; font-size: 11px; border: 1px solid #ccc; }
    td { padding: 7px 8px; border: 1px solid #e0e0e0; font-size: 11px; }
    tr:nth-child(even) td { background: #fafafa; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #ddd; color: #888; font-size: 10px; text-align: center; }
  </style>
</head>
<body>
  <h1>Relatório de Despesas Agrícolas</h1>
  <p class="sub">Copa Café — Controle de Custos de Produção</p>

  <div class="infoBox">
    <p><strong>Produtor:</strong> ${nome}</p>
    <p><strong>CPF/CNPJ:</strong> ${cpf}</p>
    <p><strong>Localização:</strong> ${municipio}${municipio && estado ? ' - ' : ''}${estado}</p>
    <p><strong>Período:</strong> ${escapeHtml(periodoLabel)}</p>
    <p><strong>Gerado em:</strong> ${escapeHtml(geradoEm)}</p>
  </div>

  <div class="totalBox">
    <div class="label">TOTAL DE DESPESAS NO PERÍODO</div>
    <div class="valor">R$ ${brl(total)}</div>
  </div>

  <h2>Resumo por Categoria</h2>
  ${
    categoriaRows
      ? `<table>
          <thead><tr><th>Categoria</th><th style="text-align:center">Qtde</th><th style="text-align:right">Total</th><th style="text-align:right">% do total</th></tr></thead>
          <tbody>${categoriaRows}</tbody>
        </table>`
      : '<p>Nenhuma despesa no período.</p>'
  }

  <h2>Despesas Detalhadas (${despesas.length})</h2>
  ${
    detalheRows
      ? `<table>
          <thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th>Fornecedor</th><th style="text-align:right">Valor</th></tr></thead>
          <tbody>${detalheRows}</tbody>
        </table>`
      : '<p>Nenhuma despesa no período.</p>'
  }

  <div class="footer">
    Documento gerado automaticamente pelo Copa Café App — use para fins de declaração de imposto de renda e controle interno.
  </div>
</body>
</html>`;
}

export async function exportDespesasPDF(
  profile: User | null,
  despesas: DespesaExport[],
  periodoLabel: string
): Promise<void> {
  const html = buildHtml(profile, despesas, periodoLabel);
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Relatório de Despesas',
      UTI: 'com.adobe.pdf',
    });
  }
}
