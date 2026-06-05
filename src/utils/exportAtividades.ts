import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { User } from '../types/user';
import { ATIVIDADE_LABELS, type Atividade } from '../types/atividade';

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

function buildHtml(profile: User | null, atividades: Atividade[], periodoLabel: string): string {
  const custoTotal = atividades.reduce((s, a) => s + (a.custo || 0), 0);

  const porTipo: Record<string, { count: number; custo: number }> = {};
  for (const a of atividades) {
    if (!porTipo[a.tipo]) porTipo[a.tipo] = { count: 0, custo: 0 };
    porTipo[a.tipo].count += 1;
    porTipo[a.tipo].custo += a.custo || 0;
  }

  const tipoRows = Object.entries(porTipo)
    .sort((a, b) => b[1].count - a[1].count)
    .map(
      ([tipo, info]) => `
        <tr>
          <td>${escapeHtml(ATIVIDADE_LABELS[tipo as keyof typeof ATIVIDADE_LABELS] || tipo)}</td>
          <td style="text-align:center">${info.count}</td>
          <td style="text-align:right">R$ ${brl(info.custo)}</td>
        </tr>`
    )
    .join('');

  const detalheRows = atividades
    .slice()
    .sort((a, b) => a.data.localeCompare(b.data))
    .map(
      (a) => `
        <tr>
          <td>${formatDateBR(a.data)}</td>
          <td>${escapeHtml(ATIVIDADE_LABELS[a.tipo] || a.tipo)}</td>
          <td>${escapeHtml(a.titulo)}</td>
          <td>${escapeHtml(a.descricao || '-')}</td>
          <td style="text-align:right">${a.custo ? `R$ ${brl(a.custo)}` : '-'}</td>
        </tr>`
    )
    .join('');

  const geradoEm = new Date().toLocaleString('pt-BR');
  const nome = escapeHtml(profile?.nome || '');
  const municipio = escapeHtml(profile?.municipio || '');
  const estado = escapeHtml(profile?.estado || '');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Relatório do Diário de Campo</title>
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
  <h1>Relatório do Diário de Campo</h1>
  <p class="sub">Copa Café — Registro de Atividades</p>

  <div class="infoBox">
    <p><strong>Produtor:</strong> ${nome}</p>
    <p><strong>Localização:</strong> ${municipio}${municipio && estado ? ' - ' : ''}${estado}</p>
    <p><strong>Período:</strong> ${escapeHtml(periodoLabel)}</p>
    <p><strong>Gerado em:</strong> ${escapeHtml(geradoEm)}</p>
  </div>

  <div class="totalBox">
    <div class="label">CUSTO TOTAL DAS ATIVIDADES NO PERÍODO</div>
    <div class="valor">R$ ${brl(custoTotal)}</div>
  </div>

  <h2>Resumo por Tipo</h2>
  ${
    tipoRows
      ? `<table>
          <thead><tr><th>Tipo</th><th style="text-align:center">Qtde</th><th style="text-align:right">Custo</th></tr></thead>
          <tbody>${tipoRows}</tbody>
        </table>`
      : '<p>Nenhuma atividade no período.</p>'
  }

  <h2>Atividades Detalhadas (${atividades.length})</h2>
  ${
    detalheRows
      ? `<table>
          <thead><tr><th>Data</th><th>Tipo</th><th>Título</th><th>Descrição</th><th style="text-align:right">Custo</th></tr></thead>
          <tbody>${detalheRows}</tbody>
        </table>`
      : '<p>Nenhuma atividade no período.</p>'
  }

  <div class="footer">
    Documento gerado automaticamente pelo Copa Café App — registro de manejo da lavoura.
  </div>
</body>
</html>`;
}

export async function exportAtividadesPDF(
  profile: User | null,
  atividades: Atividade[],
  periodoLabel: string
): Promise<void> {
  const html = buildHtml(profile, atividades, periodoLabel);
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Relatório do Diário de Campo',
      UTI: 'com.adobe.pdf',
    });
  }
}
