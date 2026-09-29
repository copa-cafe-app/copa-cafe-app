import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Image, Alert, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback, useRef } from 'react';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { supabase } from '../src/services/supabase';
import { useAuthStore } from '../src/stores/authStore';
import { exportDespesasPDF } from '../src/utils/exportDespesas';
import { formatBRL } from '../src/utils/format';
import { safraAtual, safrasRecentes, safraDaData } from '../src/utils/safra';
import { despesaService, mensagemErroAmigavel } from '../src/services/despesa.service';

interface Despesa {
  id: string;
  categoria: string;
  descricao: string;
  valor: number;
  data: string;
  safra: string | null;
  comprovante_url: string | null;
  vendor: string | null;
  origem?: string | null;
  atividade_id?: string | null;
}

interface LoteSacas {
  safra: string;
  quantidade_sacas: number;
}

const SAFRAS = safrasRecentes(3);

// Safra da despesa: a gravada no banco; se vazia, deriva da data.
const safraDaDespesa = (d: Despesa) => d.safra || safraDaData(d.data);

function totalPorSafra(despesas: Despesa[], safra: string): number {
  return despesas.filter((d) => safraDaDespesa(d) === safra).reduce((s, d) => s + (Number(d.valor) || 0), 0);
}

function sacasPorSafra(lotes: LoteSacas[], safra: string): number {
  return lotes.filter((l) => l.safra === safra).reduce((s, l) => s + (Number(l.quantidade_sacas) || 0), 0);
}

function formatDateInput(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function toISODate(text: string): string | null {
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const d = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
  if (d.getDate() !== parseInt(dd) || d.getMonth() !== parseInt(mm) - 1) return null;
  return `${yyyy}-${mm}-${dd}`;
}

function firstDayOfMonthBR(): string {
  const now = new Date();
  return `01/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
}

function todayBR(): string {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
}

const categoriaLabels: Record<string, string> = {
  'INSUMOS': 'Insumos',
  'MAO_DE_OBRA': 'Mão de obra',
  'DEFENSIVOS': 'Defensivos',
  'MAQUINAS': 'Máquinas',
  'TRANSPORTE': 'Transporte',
  'OUTROS': 'Outros',
};

const categoriaIcons: Record<string, string> = {
  'INSUMOS': 'package',
  'MAO_DE_OBRA': 'users',
  'DEFENSIVOS': 'shield',
  'MAQUINAS': 'settings',
  'TRANSPORTE': 'truck',
  'OUTROS': 'dollar-sign',
};

export default function CustosScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuthStore();
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [periodStart, setPeriodStart] = useState(firstDayOfMonthBR());
  const [periodEnd, setPeriodEnd] = useState(todayBR());
  const [lotes, setLotes] = useState<LoteSacas[]>([]);
  const [safraSel, setSafraSel] = useState(SAFRAS[0]);
  const safraEscolhida = useRef(false); // usuário tocou num chip de safra
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  async function exportFiltered(filtered: Despesa[], label: string) {
    if (!profile?.cpf_cnpj) {
      Alert.alert('CPF necessário', 'Complete seu cadastro com CPF/CNPJ para gerar o relatório.');
      return;
    }
    if (filtered.length === 0) {
      Alert.alert('Sem despesas', 'Nenhuma despesa encontrada para o período selecionado.');
      return;
    }
    setExporting(true);
    try {
      await exportDespesasPDF(profile, filtered, label);
    } catch (err: any) {
      Alert.alert('Erro', mensagemErroAmigavel(err, 'Não foi possível gerar o PDF. Tente novamente.'));
    } finally {
      setExporting(false);
    }
  }

  async function handleExportPeriodo() {
    const startISO = toISODate(periodStart);
    const endISO = toISODate(periodEnd);
    if (!startISO || !endISO) {
      Alert.alert('Datas inválidas', 'Use o formato DD/MM/AAAA nas duas datas.');
      return;
    }
    if (startISO > endISO) {
      Alert.alert('Período inválido', 'A data inicial deve ser anterior à data final.');
      return;
    }
    const filtered = despesas.filter((d) => d.data >= startISO && d.data <= endISO);
    setShowPeriodModal(false);
    await exportFiltered(filtered, `${periodStart} a ${periodEnd}`);
  }

  async function handleExport(periodo: 'ano' | 'safra' | 'todos') {
    setShowExportModal(false);
    if (!profile?.cpf_cnpj) {
      Alert.alert('CPF necessário', 'Complete seu cadastro com CPF/CNPJ para gerar o relatório.');
      return;
    }
    let filtered = despesas;
    let label = 'Todos os registros';
    if (periodo === 'ano') {
      const ano = new Date().getFullYear();
      filtered = despesas.filter((d) => d.data.startsWith(String(ano)));
      label = `Ano ${ano}`;
    } else if (periodo === 'safra') {
      filtered = despesas.filter((d) => safraDaDespesa(d) === safraAtual());
      label = `Safra ${safraAtual()}`;
    }
    if (filtered.length === 0) {
      Alert.alert('Sem despesas', 'Nenhuma despesa encontrada para o período selecionado.');
      return;
    }
    setExporting(true);
    try {
      await exportDespesasPDF(profile, filtered, label);
    } catch (err: any) {
      Alert.alert('Erro', mensagemErroAmigavel(err, 'Não foi possível gerar o PDF. Tente novamente.'));
    } finally {
      setExporting(false);
    }
  }

  // Recarrega ao voltar pra tela (inclui volta da edição em nova-despesa).
  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      let cancel = false;
      setLoading(true);
      setLoadError(false);
      Promise.all([
        supabase
          .from('despesas_producao')
          .select('*')
          .eq('produtor_id', user.id)
          .order('data', { ascending: false }),
        supabase
          .from('lotes')
          .select('safra, quantidade_sacas')
          .eq('produtor_id', user.id),
      ])
        .then(([despRes, lotesRes]) => {
          if (cancel) return;
          if (despRes.error) setLoadError(true);
          else if (despRes.data) setDespesas(despRes.data as Despesa[]);
          if (!lotesRes.error && lotesRes.data) {
            const ls = lotesRes.data as LoteSacas[];
            setLotes(ls);
            // Se a safra corrente ainda não tem lotes, mostra a mais recente que tem.
            if (!safraEscolhida.current && sacasPorSafra(ls, SAFRAS[0]) === 0) {
              const comSacas = SAFRAS.find((s) => sacasPorSafra(ls, s) > 0);
              if (comSacas) setSafraSel(comSacas);
            }
          }
        })
        .catch(() => { if (!cancel) setLoadError(true); })
        .finally(() => { if (!cancel) setLoading(false); });
      return () => { cancel = true; };
    }, [user?.id, reloadKey])
  );

  function abrirDiarioAlert(titulo: string, msg: string) {
    Alert.alert(titulo, msg, [
      { text: 'Fechar', style: 'cancel' },
      { text: 'Abrir Diário', onPress: () => router.push('/diario') },
    ]);
  }

  function handleEditar(d: Despesa) {
    if (d.atividade_id) {
      abrirDiarioAlert(
        'Despesa do Diário de Campo',
        'Esta despesa veio do Diário de Campo — edite pela atividade no Diário.',
      );
      return;
    }
    router.push({ pathname: '/nova-despesa', params: { id: d.id } });
  }

  function handleExcluir(d: Despesa) {
    if (d.atividade_id) {
      abrirDiarioAlert(
        'Excluir despesa?',
        'Esta despesa veio do Diário de Campo. Para excluí-la, abra a atividade no Diário e apague a atividade ou remova o custo dela.',
      );
      return;
    }
    Alert.alert(
      'Excluir despesa?',
      `"${d.descricao}" (${formatBRL(d.valor)}) será apagada. Isso não pode ser desfeito.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await despesaService.remove(d.id);
              setDespesas((prev) => prev.filter((x) => x.id !== d.id));
            } catch (err) {
              Alert.alert('Erro', mensagemErroAmigavel(err, 'Não foi possível excluir a despesa. Tente novamente.'));
            }
          },
        },
      ],
    );
  }

  const totalDespesas = despesas.reduce((sum, d) => sum + (Number(d.valor) || 0), 0);
  // Custo/saca da safra escolhida = despesas da safra / sacas dos lotes da mesma safra.
  const totalSafra = totalPorSafra(despesas, safraSel);
  const sacasSafra = sacasPorSafra(lotes, safraSel);
  const custoPorSaca = sacasSafra > 0 ? totalSafra / sacasSafra : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Custos de Produção</Text>
        <TouchableOpacity onPress={() => setShowExportModal(true)} style={styles.backBtn} disabled={exporting || despesas.length === 0}>
          {exporting ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Feather name="download" size={20} color={despesas.length === 0 ? colors.textLight : colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 80 }} />
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 100 + insets.bottom }]}>
          {loadError && (
            <TouchableOpacity style={styles.errorBox} onPress={() => setReloadKey((k) => k + 1)}>
              <Feather name="wifi-off" size={16} color={colors.error} />
              <Text style={styles.errorText}>Não foi possível carregar suas despesas. Toque para tentar de novo.</Text>
            </TouchableOpacity>
          )}

          {/* Resumo */}
          <View style={styles.resumoCard}>
            <Text style={styles.resumoLabel}>Total geral ({despesas.length} {despesas.length === 1 ? 'despesa' : 'despesas'})</Text>
            <Text style={styles.resumoValor}>{formatBRL(totalDespesas)}</Text>

            <View style={styles.safraRow}>
              {SAFRAS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.safraChip, safraSel === s && styles.safraChipActive]}
                  onPress={() => { safraEscolhida.current = true; setSafraSel(s); }}
                >
                  <Text style={[styles.safraChipText, safraSel === s && styles.safraChipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.resumoRow}>
              <View style={styles.resumoItem}>
                <Text style={styles.resumoItemLabel}>Custos safra {safraSel}</Text>
                <Text style={styles.resumoItemValor}>{formatBRL(totalSafra)}</Text>
              </View>
              <View style={styles.resumoDivider} />
              <View style={styles.resumoItem}>
                <Text style={styles.resumoItemLabel}>Custo por saca</Text>
                <Text style={styles.resumoItemValor}>{custoPorSaca != null ? formatBRL(custoPorSaca) : '—'}</Text>
              </View>
            </View>
            {custoPorSaca == null ? (
              <TouchableOpacity onPress={() => router.push('/novo-lote')}>
                <Text style={styles.resumoHint}>Cadastre seus lotes da safra {safraSel} para ver o custo por saca</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.resumoHint}>
                {sacasSafra.toLocaleString('pt-BR')} sacas nos seus lotes da safra {safraSel}
              </Text>
            )}
          </View>

          {despesas.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="dollar-sign" size={48} color={colors.textLight} />
              <Text style={styles.emptyText}>Nenhuma despesa registrada</Text>
              <Text style={styles.emptySubtext}>Toque no + para registrar sua primeira despesa</Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Despesas recentes</Text>
              <Text style={styles.sectionHint}>Toque numa despesa para editar</Text>
              {despesas.map((d) => (
                <TouchableOpacity key={d.id} style={styles.despesaCard} onPress={() => handleEditar(d)} activeOpacity={0.7}>
                  <View style={styles.despesaIcon}>
                    <Feather name={(categoriaIcons[d.categoria] || 'dollar-sign') as any} size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.despesaDescRow}>
                      <Text style={styles.despesaDesc} numberOfLines={1}>{d.descricao}</Text>
                      {d.origem === 'DIARIO' && (
                        <View style={styles.diarioBadge}>
                          <Feather name="edit-3" size={10} color={colors.primary} />
                          <Text style={styles.diarioBadgeText}>Diário</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.despesaCat}>
                      {categoriaLabels[d.categoria] || d.categoria} • {new Date(d.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </Text>
                  </View>
                  <Text style={styles.despesaValor}>{formatBRL(d.valor)}</Text>
                  {d.comprovante_url ? (
                    <TouchableOpacity
                      style={styles.comprovanteBtn}
                      onPress={() => setViewingImage(d.comprovante_url)}
                    >
                      <Feather name="file-text" size={16} color={colors.primary} />
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleExcluir(d)}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                    accessibilityLabel="Excluir despesa"
                  >
                    <Feather name="trash-2" size={16} color={colors.error} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>
      )}

      <TouchableOpacity style={[styles.fab, { bottom: spacing.lg + insets.bottom }]} onPress={() => router.push('/nova-despesa')}>
        <Feather name="plus" size={26} color={colors.white} />
      </TouchableOpacity>

      {/* Modal de opções de export */}
      <Modal visible={showExportModal} transparent animationType="fade" onRequestClose={() => setShowExportModal(false)}>
        <TouchableOpacity style={styles.exportOverlay} activeOpacity={1} onPress={() => setShowExportModal(false)}>
          <View style={[styles.exportContent, { paddingBottom: spacing.xxl + insets.bottom }]}>
            <Text style={styles.exportTitle}>Exportar Relatório PDF</Text>
            <Text style={styles.exportSubtitle}>Selecione o período</Text>

            <TouchableOpacity style={styles.exportOption} onPress={() => handleExport('ano')}>
              <Feather name="calendar" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.exportOptionText}>Ano atual ({new Date().getFullYear()})</Text>
                <Text style={styles.exportOptionHint}>Para declaração de IR</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.exportOption} onPress={() => handleExport('safra')}>
              <Feather name="coffee" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.exportOptionText}>Safra {safraAtual()}</Text>
                <Text style={styles.exportOptionHint}>Todos os custos da safra atual</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.exportOption} onPress={() => handleExport('todos')}>
              <Feather name="list" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.exportOptionText}>Todos os registros</Text>
                <Text style={styles.exportOptionHint}>Histórico completo</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exportOption}
              onPress={() => { setShowExportModal(false); setShowPeriodModal(true); }}
            >
              <Feather name="sliders" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.exportOptionText}>Período personalizado</Text>
                <Text style={styles.exportOptionHint}>Escolha data inicial e final</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.exportCancel} onPress={() => setShowExportModal(false)}>
              <Text style={styles.exportCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal período personalizado */}
      <Modal visible={showPeriodModal} transparent animationType="slide" onRequestClose={() => setShowPeriodModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.exportOverlay}>
          <View style={[styles.exportContent, { paddingBottom: spacing.xxl + insets.bottom }]}>
            <Text style={styles.exportTitle}>Relatório por Período</Text>
            <Text style={styles.exportSubtitle}>Escolha o intervalo de datas</Text>

            <Text style={styles.periodLabel}>De</Text>
            <TextInput
              style={styles.periodInput}
              value={periodStart}
              onChangeText={(t) => setPeriodStart(formatDateInput(t))}
              placeholder="DD/MM/AAAA"
              keyboardType="number-pad"
              maxLength={10}
              placeholderTextColor={colors.textLight}
            />

            <Text style={styles.periodLabel}>Até</Text>
            <TextInput
              style={styles.periodInput}
              value={periodEnd}
              onChangeText={(t) => setPeriodEnd(formatDateInput(t))}
              placeholder="DD/MM/AAAA"
              keyboardType="number-pad"
              maxLength={10}
              placeholderTextColor={colors.textLight}
            />

            <TouchableOpacity style={styles.periodGenerate} onPress={handleExportPeriodo} disabled={exporting}>
              {exporting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.periodGenerateText}>Gerar PDF</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportCancel} onPress={() => setShowPeriodModal(false)}>
              <Text style={styles.exportCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal para visualizar comprovante */}
      <Modal visible={!!viewingImage} transparent animationType="fade" onRequestClose={() => setViewingImage(null)}>
        <View style={styles.imageModalOverlay}>
          <View style={styles.imageModalHeader}>
            <TouchableOpacity onPress={() => setViewingImage(null)} style={styles.imageModalClose}>
              <Feather name="x" size={24} color={colors.white} />
            </TouchableOpacity>
            <Text style={styles.imageModalTitle}>Comprovante</Text>
            <View style={{ width: 40 }} />
          </View>
          {viewingImage && (
            <Image
              source={{ uri: viewingImage }}
              style={styles.imageModalImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: 72, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  content: { padding: spacing.md, paddingBottom: 100 },
  resumoCard: { backgroundColor: colors.primary, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  resumoLabel: { fontSize: fontSize.sm, color: 'rgba(255,255,255,0.7)' },
  resumoValor: { fontSize: 32, fontWeight: '700', color: colors.white, marginTop: 4 },
  resumoRow: { flexDirection: 'row', marginTop: spacing.md },
  resumoItem: { flex: 1, alignItems: 'center' },
  resumoItemLabel: { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.7)' },
  resumoItemValor: { fontSize: fontSize.lg, fontWeight: '700', color: colors.white, marginTop: 2 },
  resumoDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  resumoHint: { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: spacing.sm },
  safraRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  safraChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: borderRadius.full, backgroundColor: 'rgba(255,255,255,0.15)' },
  safraChipActive: { backgroundColor: colors.white },
  safraChipText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.white },
  safraChipTextActive: { color: colors.primary },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.error, backgroundColor: colors.surface, marginBottom: spacing.md },
  errorText: { flex: 1, fontSize: fontSize.sm, color: colors.error },
  sectionHint: { fontSize: fontSize.xs, color: colors.textLight, marginTop: -spacing.sm, marginBottom: spacing.sm },
  deleteBtn: { width: 36, height: 36, borderRadius: borderRadius.sm, backgroundColor: colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', marginLeft: spacing.sm },
  empty: { alignItems: 'center', marginTop: 40 },
  emptyText: { fontSize: fontSize.lg, fontWeight: '600', color: colors.textSecondary, marginTop: spacing.md },
  emptySubtext: { fontSize: fontSize.sm, color: colors.textLight, marginTop: spacing.xs },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  despesaCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  despesaIcon: { width: 40, height: 40, borderRadius: borderRadius.md, backgroundColor: colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  despesaDescRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  despesaDesc: { fontSize: fontSize.md, fontWeight: '500', color: colors.text, flexShrink: 1 },
  diarioBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.surfaceVariant, paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.full },
  diarioBadgeText: { fontSize: 10, fontWeight: '600', color: colors.primary },
  despesaCat: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  periodLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs, marginTop: spacing.sm },
  periodInput: { backgroundColor: colors.surfaceVariant, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, fontSize: fontSize.md, color: colors.text },
  periodGenerate: { backgroundColor: colors.primary, height: 52, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  periodGenerateText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
  despesaValor: { fontSize: fontSize.md, fontWeight: '600', color: colors.error },
  comprovanteBtn: { width: 32, height: 32, borderRadius: borderRadius.sm, backgroundColor: colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', marginLeft: spacing.sm },
  fab: { position: 'absolute', bottom: spacing.lg, right: spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  // Image viewer modal
  imageModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' },
  imageModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: 60, paddingBottom: spacing.md },
  imageModalClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  imageModalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.white },
  imageModalImage: { flex: 1, width: '100%' },
  // Export modal
  exportOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  exportContent: { backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  exportTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, textAlign: 'center' },
  exportSubtitle: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  exportOption: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.surfaceVariant, marginBottom: spacing.sm },
  exportOptionText: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  exportOptionHint: { fontSize: fontSize.xs, color: colors.textLight, marginTop: 2 },
  exportCancel: { alignItems: 'center', padding: spacing.md, marginTop: spacing.sm },
  exportCancelText: { fontSize: fontSize.md, color: colors.textLight, fontWeight: '500' },
});
