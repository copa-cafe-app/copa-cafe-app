import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Image, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { supabase } from '../src/services/supabase';
import { useAuthStore } from '../src/stores/authStore';
import { exportDespesasPDF } from '../src/utils/exportDespesas';

interface Despesa {
  id: string;
  categoria: string;
  descricao: string;
  valor: number;
  data: string;
  safra: string | null;
  comprovante_url: string | null;
  vendor: string | null;
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
  const { user, profile } = useAuthStore();
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);

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
      filtered = despesas.filter((d) => d.safra === '2025/26');
      label = 'Safra 2025/26';
    }
    if (filtered.length === 0) {
      Alert.alert('Sem despesas', 'Nenhuma despesa encontrada para o período selecionado.');
      return;
    }
    setExporting(true);
    try {
      await exportDespesasPDF(profile, filtered, label);
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Não foi possível gerar o PDF');
    } finally {
      setExporting(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      setLoading(true);
      supabase
        .from('despesas_producao')
        .select('*')
        .eq('produtor_id', user.id)
        .order('data', { ascending: false })
        .then(({ data, error }) => {
          if (!error && data) setDespesas(data as Despesa[]);
          setLoading(false);
        });
    }, [user?.id])
  );

  const totalDespesas = despesas.reduce((sum, d) => sum + d.valor, 0);

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
        <ScrollView contentContainerStyle={styles.content}>
          {/* Resumo */}
          <View style={styles.resumoCard}>
            <Text style={styles.resumoLabel}>Total - Safra 2025/26</Text>
            <Text style={styles.resumoValor}>R$ {totalDespesas.toLocaleString('pt-BR')}</Text>
            <View style={styles.resumoRow}>
              <View style={styles.resumoItem}>
                <Text style={styles.resumoItemLabel}>Custo/saca (est.)</Text>
                <Text style={styles.resumoItemValor}>R$ {despesas.length > 0 ? (totalDespesas / 120).toFixed(0) : '0'}</Text>
              </View>
              <View style={styles.resumoDivider} />
              <View style={styles.resumoItem}>
                <Text style={styles.resumoItemLabel}>Despesas</Text>
                <Text style={styles.resumoItemValor}>{despesas.length}</Text>
              </View>
            </View>
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
              {despesas.map((d) => (
                <View key={d.id} style={styles.despesaCard}>
                  <View style={styles.despesaIcon}>
                    <Feather name={(categoriaIcons[d.categoria] || 'dollar-sign') as any} size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.despesaDesc}>{d.descricao}</Text>
                    <Text style={styles.despesaCat}>
                      {categoriaLabels[d.categoria] || d.categoria} • {new Date(d.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </Text>
                  </View>
                  <Text style={styles.despesaValor}>R$ {d.valor.toLocaleString('pt-BR')}</Text>
                  {d.comprovante_url ? (
                    <TouchableOpacity
                      style={styles.comprovanteBtn}
                      onPress={() => setViewingImage(d.comprovante_url)}
                    >
                      <Feather name="file-text" size={16} color={colors.primary} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/nova-despesa')}>
        <Feather name="plus" size={26} color={colors.white} />
      </TouchableOpacity>

      {/* Modal de opções de export */}
      <Modal visible={showExportModal} transparent animationType="fade" onRequestClose={() => setShowExportModal(false)}>
        <TouchableOpacity style={styles.exportOverlay} activeOpacity={1} onPress={() => setShowExportModal(false)}>
          <View style={styles.exportContent}>
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
                <Text style={styles.exportOptionText}>Safra 2025/26</Text>
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

            <TouchableOpacity style={styles.exportCancel} onPress={() => setShowExportModal(false)}>
              <Text style={styles.exportCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
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
  empty: { alignItems: 'center', marginTop: 40 },
  emptyText: { fontSize: fontSize.lg, fontWeight: '600', color: colors.textSecondary, marginTop: spacing.md },
  emptySubtext: { fontSize: fontSize.sm, color: colors.textLight, marginTop: spacing.xs },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  despesaCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  despesaIcon: { width: 40, height: 40, borderRadius: borderRadius.md, backgroundColor: colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  despesaDesc: { fontSize: fontSize.md, fontWeight: '500', color: colors.text },
  despesaCat: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
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
