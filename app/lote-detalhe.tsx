import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Share } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { supabase } from '../src/services/supabase';
import { useAuthStore } from '../src/stores/authStore';
import { formatBRL } from '../src/utils/format';
import { fetchCopaPriceTable, type CopaPriceTable } from '../src/services/copaPrices.service';
import { precoCopaParaLote, motivoSemPrecoCopa } from '../src/utils/lotePricing';
import {
  type Lote,
  processoLabels,
  codigoLote,
  excluirLote,
  mensagemErroLote,
  mensagemOfertaLote,
  abrirWhatsAppCopa,
} from '../src/services/lote.service';

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  RASCUNHO: { label: 'Rascunho', color: '#666', bg: '#E8E8E8' },
  DISPONIVEL: { label: 'Disponível', color: '#2E7D32', bg: '#E8F5E9' },
  EM_NEGOCIACAO: { label: 'Em Negociação', color: '#F57F17', bg: '#FFF8E1' },
  VENDIDO: { label: 'Vendido', color: '#1565C0', bg: '#E3F2FD' },
  ENCERRADO: { label: 'Encerrado', color: '#999', bg: '#F5F5F5' },
};

const STATUS_FLOW = ['RASCUNHO', 'DISPONIVEL', 'EM_NEGOCIACAO', 'VENDIDO', 'ENCERRADO'];

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Feather name={icon as any} size={16} color={colors.textSecondary} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

type Propriedade = { id: string; nome: string | null; municipio: string | null; estado: string | null };

function formatDataHora(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function LoteDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [lote, setLote] = useState<Lote | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tabela, setTabela] = useState<CopaPriceTable | null>(null);
  const [tabelaStatus, setTabelaStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [propriedades, setPropriedades] = useState<Propriedade[]>([]);
  const [busy, setBusy] = useState(false);

  const carregarLote = useCallback(async () => {
    if (!id || !user?.id) {
      setLoading(false);
      setLoadError('Lote não encontrado.');
      return;
    }
    setLoadError(null);
    try {
      const { data, error } = await supabase
        .from('lotes')
        .select('*')
        .eq('id', id)
        .eq('produtor_id', user.id) // defesa em profundidade além da RLS
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        setLote(null);
        setLoadError('Lote não encontrado. Ele pode ter sido excluído.');
      } else {
        setLote(data as Lote);
      }
    } catch (err) {
      setLoadError(mensagemErroLote(err, 'carregar o lote'));
    } finally {
      setLoading(false);
    }
  }, [id, user?.id]);

  const carregarTabela = useCallback(async (force = false) => {
    setTabelaStatus('loading');
    try {
      setTabela(await fetchCopaPriceTable({ force }));
      setTabelaStatus('ok');
    } catch {
      setTabelaStatus('error');
    }
  }, []);

  // Recarrega ao voltar da tela de edição.
  useFocusEffect(
    useCallback(() => {
      carregarLote();
      carregarTabela();
      if (user?.id) {
        supabase
          .from('propriedades')
          .select('id, nome, municipio, estado')
          .eq('produtor_id', user.id)
          .order('criado_em', { ascending: true })
          .then(({ data }) => { if (data) setPropriedades(data as Propriedade[]); }, () => {});
      }
    }, [carregarLote, carregarTabela, user?.id])
  );

  async function handleStatusChange(newStatus: string) {
    if (!lote || !user?.id) return;
    const statusLabel = statusConfig[newStatus]?.label || newStatus;
    Alert.alert('Alterar Status', `Mudar para "${statusLabel}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          const { error } = await supabase
            .from('lotes')
            .update({ status: newStatus })
            .eq('id', lote.id)
            .eq('produtor_id', user.id);
          if (!error) setLote({ ...lote, status: newStatus });
          else Alert.alert('Erro', mensagemErroLote(error, 'alterar o status'));
        },
      },
    ]);
  }

  async function handleShare() {
    if (!lote) return;
    const precoText = lote.preco_por_saca
      ? `${formatBRL(lote.preco_por_saca)}/saca`
      : 'Preço a combinar';
    const bebidaText = lote.bebida ? `\nBebida: ${lote.bebida}` : '';
    const cataText = lote.cata != null ? `\nCata: ${lote.cata}%` : '';
    const notasText = lote.notas_sensoriais ? `\nNotas: ${lote.notas_sensoriais}` : '';

    const message = `☕ *Lote de Café — Copa Café*\n\n` +
      `Variedade: ${lote.variedade}\n` +
      `Processo: ${processoLabels[lote.processo] || lote.processo}\n` +
      `Safra: ${lote.safra}\n` +
      `Quantidade: ${lote.quantidade_sacas} sacas\n` +
      `Preço: ${precoText}${bebidaText}${cataText}${notasText}\n` +
      `${lote.preco_negociavel ? '💬 Preço negociável' : ''}\n\n` +
      `Rastreabilidade: ${codigoLote(lote)}`;

    try {
      await Share.share({ message });
    } catch {
      Alert.alert('Compartilhar', 'Não foi possível abrir o compartilhamento. Tente de novo.');
    }
  }

  async function handleGenerateQR() {
    if (!lote || !user?.id || lote.qrcode_hash) return;
    const hash = `CC-${lote.id.substring(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    setBusy(true);
    try {
      const { error } = await supabase
        .from('lotes')
        .update({ qrcode_hash: hash })
        .eq('id', lote.id)
        .eq('produtor_id', user.id);
      if (error) throw error;
      setLote({ ...lote, qrcode_hash: hash });
      Alert.alert('QR Code Gerado', `Código: ${hash}`);
    } catch (err) {
      Alert.alert('Erro', mensagemErroLote(err, 'gerar o código'));
    } finally {
      setBusy(false);
    }
  }

  function handleEdit() {
    if (!lote) return;
    router.push({ pathname: '/novo-lote', params: { id: lote.id } });
  }

  function handleDelete() {
    if (!lote || !user?.id) return;
    Alert.alert(
      'Excluir lote',
      `Excluir o lote ${lote.variedade} (${lote.quantidade_sacas} sacas)? Essa ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await excluirLote(lote.id, user.id);
              router.back();
            } catch (err) {
              Alert.alert('Erro', mensagemErroLote(err, 'excluir o lote'));
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }

  async function handleOferecer() {
    if (!lote || !user?.id) return;
    const pricing = precoCopaParaLote(lote, tabela);
    // Fazenda do lote; lotes antigos (sem vínculo) usam a primeira fazenda.
    const propriedade = propriedades.find((p) => p.id === lote.propriedade_id) ?? propriedades[0] ?? null;
    const texto = mensagemOfertaLote(lote, pricing, {
      produtorNome: profile?.nome,
      fazendaNome: propriedade?.nome,
      municipio: propriedade?.municipio,
      estado: propriedade?.estado,
    });
    const abriu = await abrirWhatsAppCopa(texto);
    if (!abriu) {
      Alert.alert('WhatsApp', 'Não foi possível abrir o WhatsApp. Verifique se ele está instalado e tente de novo.');
      return;
    }
    // Registra a oferta; Rascunho → Disponível. Outros status não mexe.
    const mudancas: Partial<Lote> = { ofertado_copa_em: new Date().toISOString() };
    if (lote.status === 'RASCUNHO') mudancas.status = 'DISPONIVEL';
    const { error } = await supabase
      .from('lotes')
      .update(mudancas)
      .eq('id', lote.id)
      .eq('produtor_id', user.id);
    if (!error) setLote({ ...lote, ...mudancas });
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!lote) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Feather name="alert-circle" size={40} color={colors.textLight} />
        <Text style={styles.errorText}>{loadError || 'Lote não encontrado.'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); carregarLote(); }}>
          <Text style={styles.retryBtnText}>Tentar de novo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const status = statusConfig[lote.status] || statusConfig.RASCUNHO;
  const currentIdx = STATUS_FLOW.indexOf(lote.status);
  const pricing = precoCopaParaLote(lote, tabela);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + insets.bottom }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Lote</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleEdit} style={styles.backBtn} accessibilityLabel="Editar lote">
              <Feather name="edit-2" size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.backBtn} accessibilityLabel="Compartilhar lote">
              <Feather name="share-2" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Status badge */}
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: status.color }]} />
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>

        {/* Título */}
        <Text style={styles.variedade}>{lote.variedade}</Text>
        <Text style={styles.processo}>{processoLabels[lote.processo] || lote.processo} • Safra {lote.safra}</Text>

        {/* Preço */}
        <View style={styles.precoCard}>
          {lote.preco_por_saca ? (
            <>
              <Text style={styles.precoValue}>{formatBRL(lote.preco_por_saca)}</Text>
              <Text style={styles.precoUnit}>/saca</Text>
            </>
          ) : (
            <Text style={styles.precoNegociar}>Aceito propostas</Text>
          )}
          {lote.preco_negociavel && lote.preco_por_saca ? (
            <View style={styles.negociavelBadge}>
              <Text style={styles.negociavelText}>Negociável</Text>
            </View>
          ) : null}
        </View>

        {/* Preço Copa hoje */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preço Copa hoje</Text>
          <View style={styles.copaCard}>
            {tabelaStatus === 'loading' ? (
              <ActivityIndicator color={colors.primary} />
            ) : tabelaStatus === 'error' ? (
              <>
                <Text style={styles.copaMuted}>Não foi possível carregar a tabela de preços da Copa agora.</Text>
                <TouchableOpacity onPress={() => carregarTabela(true)} style={styles.copaRetry}>
                  <Feather name="refresh-cw" size={14} color={colors.primary} />
                  <Text style={styles.copaRetryText}>Tentar de novo</Text>
                </TouchableOpacity>
              </>
            ) : pricing ? (
              <>
                <Text style={styles.copaLinha}>{pricing.linhaUsada}{pricing.safraTabela ? ` • safra ${pricing.safraTabela}` : ''}</Text>
                <View style={styles.copaPrecoRow}>
                  <Text style={styles.copaPreco}>{formatBRL(pricing.precoRef)}</Text>
                  <Text style={styles.precoUnit}>/saca</Text>
                </View>
                <View style={styles.copaTotalRow}>
                  <Text style={styles.copaTotalLabel}>Valor estimado ({lote.quantidade_sacas} sc)</Text>
                  <Text style={styles.copaTotal}>{formatBRL(pricing.valorEstimado)}</Text>
                </View>
                {pricing.observacoes.map((o, i) => (
                  <Text key={i} style={styles.copaObs}>• {o}</Text>
                ))}
                <Text style={styles.copaAviso}>
                  Valor de referência, sujeito a avaliação da amostra.
                  {pricing.dataTabela ? ` Tabela de ${pricing.dataTabela}.` : ''}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.copaMuted}>{motivoSemPrecoCopa(lote, tabela)}</Text>
                {(!lote.bebida || lote.cata == null) && (
                  <TouchableOpacity onPress={handleEdit} style={styles.copaRetry}>
                    <Feather name="edit-2" size={14} color={colors.primary} />
                    <Text style={styles.copaRetryText}>Completar dados do lote</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          <TouchableOpacity style={styles.ofertaBtn} onPress={handleOferecer} disabled={busy}>
            <Feather name="message-circle" size={20} color={colors.white} />
            <Text style={styles.ofertaBtnText}>
              {lote.ofertado_copa_em ? 'Oferecer de novo à Copa' : 'Oferecer este lote à Copa'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.ofertaHint}>
            {lote.ofertado_copa_em
              ? `Oferecido à Copa em ${formatDataHora(lote.ofertado_copa_em)}.`
              : 'Abre o WhatsApp da Copa com os dados do lote já escritos.'}
          </Text>
        </View>

        {/* Informações */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informações do Lote</Text>
          <View style={styles.infoCard}>
            <InfoRow icon="hash" label="Código" value={codigoLote(lote)} />
            <InfoRow icon="package" label="Sacas" value={`${lote.quantidade_sacas}`} />
            {lote.peneira ? <InfoRow icon="filter" label="Peneira" value={lote.peneira} /> : null}
            {lote.bebida ? <InfoRow icon="coffee" label="Bebida" value={lote.bebida} /> : null}
            {lote.cata != null ? <InfoRow icon="search" label="Cata" value={`${lote.cata}%`} /> : null}
            {lote.altitude_metros ? <InfoRow icon="triangle" label="Altitude" value={`${lote.altitude_metros}m`} /> : null}
            {lote.data_colheita ? (
              <InfoRow icon="calendar" label="Colheita" value={new Date(lote.data_colheita + 'T00:00:00').toLocaleDateString('pt-BR')} />
            ) : null}
          </View>
        </View>

        {/* Notas sensoriais */}
        {lote.notas_sensoriais ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notas Sensoriais</Text>
            <View style={styles.notasRow}>
              {lote.notas_sensoriais.split(',').map((nota, i) => (
                <View key={i} style={styles.notaTag}>
                  <Text style={styles.notaText}>{nota.trim()}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* QR Code */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rastreabilidade</Text>
          <View style={styles.qrCard}>
            <Feather name="maximize" size={40} color={colors.primary} />
            {lote.qrcode_hash ? (
              <View style={styles.qrInfo}>
                <Text style={styles.qrHash}>{lote.qrcode_hash}</Text>
                <Text style={styles.qrSubtext}>Código único de rastreabilidade</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.qrGenerateBtn} onPress={handleGenerateQR} disabled={busy}>
                <Text style={styles.qrGenerateText}>Gerar QR Code</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Alterar Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alterar Status</Text>
          <View style={styles.statusActions}>
            {STATUS_FLOW.map((s, i) => {
              const cfg = statusConfig[s];
              const isCurrent = s === lote.status;
              const canAdvance = i === currentIdx + 1;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusOption, isCurrent && { borderColor: cfg.color, borderWidth: 2 }]}
                  onPress={() => !isCurrent && handleStatusChange(s)}
                  disabled={isCurrent}
                >
                  <View style={[styles.statusOptionDot, { backgroundColor: cfg.color }]} />
                  <Text style={[styles.statusOptionText, isCurrent && { fontWeight: '700' }]}>{cfg.label}</Text>
                  {canAdvance && <Feather name="arrow-right" size={14} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Compartilhar */}
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Feather name="share-2" size={20} color={colors.primary} />
          <Text style={styles.shareBtnText}>Compartilhar lote</Text>
        </TouchableOpacity>

        {/* Editar / Excluir */}
        <View style={styles.manageRow}>
          <TouchableOpacity style={styles.editBtn} onPress={handleEdit} disabled={busy}>
            <Feather name="edit-2" size={18} color={colors.primary} />
            <Text style={styles.editBtnText}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={busy}>
            <Feather name="trash-2" size={18} color={colors.error} />
            <Text style={styles.deleteBtnText}>Excluir</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.criadoEm}>
          Criado em {new Date(lote.criado_em).toLocaleDateString('pt-BR')}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  content: { padding: spacing.md, paddingTop: 72, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  errorText: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.md },
  retryBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.lg, height: 48, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  retryBtnText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
  backLink: { padding: spacing.md, marginTop: spacing.sm },
  backLinkText: { color: colors.primary, fontSize: fontSize.md, fontWeight: '600' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.full, gap: 6, marginBottom: spacing.sm },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: fontSize.sm, fontWeight: '600' },
  variedade: { fontSize: 28, fontWeight: '700', color: colors.text },
  processo: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: 4 },
  precoCard: { flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.md, flexWrap: 'wrap', gap: spacing.sm },
  precoValue: { fontSize: 32, fontWeight: '700', color: colors.primary },
  precoUnit: { fontSize: fontSize.md, color: colors.textSecondary },
  precoNegociar: { fontSize: fontSize.lg, fontWeight: '600', color: colors.secondary },
  negociavelBadge: { backgroundColor: '#FFF8E1', paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full },
  negociavelText: { fontSize: fontSize.xs, fontWeight: '600', color: '#F57F17' },
  section: { marginTop: spacing.xl },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  copaCard: { backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.primaryLight },
  copaLinha: { fontSize: fontSize.sm, fontWeight: '600', color: colors.primaryDark },
  copaPrecoRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, marginTop: 2 },
  copaPreco: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.primary },
  copaTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  copaTotalLabel: { fontSize: fontSize.sm, color: colors.textSecondary, flex: 1 },
  copaTotal: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  copaObs: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: spacing.xs },
  copaAviso: { fontSize: fontSize.xs, color: colors.textSecondary, fontStyle: 'italic', marginTop: spacing.sm },
  copaMuted: { fontSize: fontSize.sm, color: colors.textSecondary },
  copaRetry: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, paddingVertical: spacing.xs },
  copaRetryText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.primary },
  ofertaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: '#25D366', height: 56, borderRadius: borderRadius.md, marginTop: spacing.md },
  ofertaBtnText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
  ofertaHint: { fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
  infoCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: spacing.sm },
  infoLabel: { fontSize: fontSize.sm, color: colors.textSecondary, width: 80 },
  infoValue: { fontSize: fontSize.md, fontWeight: '600', color: colors.text, flex: 1 },
  notasRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  notaTag: { backgroundColor: '#FFF3E0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.full },
  notaText: { fontSize: fontSize.sm, fontWeight: '500', color: '#E65100' },
  qrCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  qrInfo: { flex: 1 },
  qrHash: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, fontFamily: 'monospace' },
  qrSubtext: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  qrGenerateBtn: { backgroundColor: colors.surfaceVariant, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md },
  qrGenerateText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.primary },
  statusActions: { gap: spacing.xs },
  statusOption: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  statusOptionDot: { width: 10, height: 10, borderRadius: 5 },
  statusOptionText: { flex: 1, fontSize: fontSize.md, color: colors.text },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, height: 52, borderRadius: borderRadius.md, marginTop: spacing.xl },
  shareBtnText: { color: colors.primary, fontSize: fontSize.md, fontWeight: '700' },
  manageRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  editBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 52, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  editBtnText: { color: colors.primary, fontSize: fontSize.md, fontWeight: '700' },
  deleteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 52, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.error, backgroundColor: colors.surface },
  deleteBtnText: { color: colors.error, fontSize: fontSize.md, fontWeight: '700' },
  criadoEm: { fontSize: fontSize.xs, color: colors.textLight, textAlign: 'center', marginTop: spacing.lg },
});
