import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Share } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { supabase } from '../src/services/supabase';

interface Lote {
  id: string;
  variedade: string;
  processo: string;
  safra: string;
  peneira: string | null;
  quantidade_sacas: number;
  preco_por_saca: number | null;
  preco_negociavel: boolean;
  bebida: string | null;
  cata: number | null;
  notas_sensoriais: string | null;
  status: string;
  altitude_metros: number | null;
  data_colheita: string | null;
  qrcode_hash: string | null;
  criado_em: string;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  RASCUNHO: { label: 'Rascunho', color: '#666', bg: '#E8E8E8' },
  DISPONIVEL: { label: 'Disponível', color: '#2E7D32', bg: '#E8F5E9' },
  EM_NEGOCIACAO: { label: 'Em Negociação', color: '#F57F17', bg: '#FFF8E1' },
  VENDIDO: { label: 'Vendido', color: '#1565C0', bg: '#E3F2FD' },
  ENCERRADO: { label: 'Encerrado', color: '#999', bg: '#F5F5F5' },
};

const STATUS_FLOW = ['RASCUNHO', 'DISPONIVEL', 'EM_NEGOCIACAO', 'VENDIDO', 'ENCERRADO'];

const processoLabels: Record<string, string> = {
  NATURAL: 'Natural', LAVADO: 'Lavado', HONEY: 'Honey',
  DESCASCADO: 'Descascado', CEREJA_DESCASCADO: 'Cereja Descascado', OUTRO: 'Outro',
};

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Feather name={icon as any} size={16} color={colors.textSecondary} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

export default function LoteDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [lote, setLote] = useState<Lote | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase.from('lotes').select('*').eq('id', id).single()
      .then(({ data }) => {
        if (data) setLote(data as Lote);
        setLoading(false);
      });
  }, [id]);

  async function handleStatusChange(newStatus: string) {
    if (!lote) return;
    const statusLabel = statusConfig[newStatus]?.label || newStatus;
    Alert.alert('Alterar Status', `Mudar para "${statusLabel}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: async () => {
          const { error } = await supabase.from('lotes').update({ status: newStatus }).eq('id', lote.id);
          if (!error) setLote({ ...lote, status: newStatus });
          else Alert.alert('Erro', 'Não foi possível alterar o status');
        },
      },
    ]);
  }

  async function handleShare() {
    if (!lote) return;
    const precoText = lote.preco_por_saca
      ? `R$ ${lote.preco_por_saca.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/saca`
      : 'Preço a combinar';
    const bebidaText = lote.bebida ? `\nBebida: ${lote.bebida}` : '';
    const cataText = lote.cata != null ? `\nCata: ${lote.cata} defeitos` : '';
    const notasText = lote.notas_sensoriais ? `\nNotas: ${lote.notas_sensoriais}` : '';

    const message = `☕ *Lote de Café — Copa Café*\n\n` +
      `Variedade: ${lote.variedade}\n` +
      `Processo: ${processoLabels[lote.processo] || lote.processo}\n` +
      `Safra: ${lote.safra}\n` +
      `Quantidade: ${lote.quantidade_sacas} sacas\n` +
      `Preço: ${precoText}${bebidaText}${cataText}${notasText}\n` +
      `${lote.preco_negociavel ? '💬 Preço negociável' : ''}\n\n` +
      `Rastreabilidade: ${lote.qrcode_hash || lote.id.substring(0, 8)}`;

    try {
      await Share.share({ message });
    } catch {}
  }

  async function handleGenerateQR() {
    if (!lote) return;
    if (lote.qrcode_hash) return;
    const hash = `CC-${lote.id.substring(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await supabase.from('lotes').update({ qrcode_hash: hash }).eq('id', lote.id);
    if (!error) {
      setLote({ ...lote, qrcode_hash: hash });
      Alert.alert('QR Code Gerado', `Código: ${hash}`);
    }
  }

  if (loading || !lote) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const status = statusConfig[lote.status] || statusConfig.RASCUNHO;
  const currentIdx = STATUS_FLOW.indexOf(lote.status);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Lote</Text>
          <TouchableOpacity onPress={handleShare}>
            <Feather name="share-2" size={20} color={colors.primary} />
          </TouchableOpacity>
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
              <Text style={styles.precoValue}>
                R$ {lote.preco_por_saca.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </Text>
              <Text style={styles.precoUnit}>/saca</Text>
            </>
          ) : (
            <Text style={styles.precoNegociar}>Aceito propostas</Text>
          )}
          {lote.preco_negociavel && lote.preco_por_saca && (
            <View style={styles.negociavelBadge}>
              <Text style={styles.negociavelText}>Negociável</Text>
            </View>
          )}
        </View>

        {/* Informações */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informações do Lote</Text>
          <View style={styles.infoCard}>
            <InfoRow icon="package" label="Sacas" value={`${lote.quantidade_sacas}`} />
            {lote.peneira && <InfoRow icon="filter" label="Peneira" value={lote.peneira} />}
            {lote.bebida && <InfoRow icon="coffee" label="Bebida" value={lote.bebida} />}
            {lote.cata != null && <InfoRow icon="search" label="Cata" value={`${lote.cata} defeitos`} />}
            {lote.altitude_metros && <InfoRow icon="triangle" label="Altitude" value={`${lote.altitude_metros}m`} />}
            {lote.data_colheita && (
              <InfoRow icon="calendar" label="Colheita" value={new Date(lote.data_colheita + 'T00:00:00').toLocaleDateString('pt-BR')} />
            )}
          </View>
        </View>

        {/* Notas sensoriais */}
        {lote.notas_sensoriais && (
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
        )}

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
              <TouchableOpacity style={styles.qrGenerateBtn} onPress={handleGenerateQR}>
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
          <Feather name="share-2" size={20} color={colors.white} />
          <Text style={styles.shareBtnText}>Compartilhar via WhatsApp</Text>
        </TouchableOpacity>

        <Text style={styles.criadoEm}>
          Criado em {new Date(lote.criado_em).toLocaleDateString('pt-BR')}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 72, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
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
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: '#25D366', height: 52, borderRadius: borderRadius.md, marginTop: spacing.xl },
  shareBtnText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
  criadoEm: { fontSize: fontSize.xs, color: colors.textLight, textAlign: 'center', marginTop: spacing.lg },
});
