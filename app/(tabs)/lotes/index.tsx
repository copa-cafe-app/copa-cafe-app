import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { colors, spacing, fontSize, borderRadius } from '../../../src/constants/theme';
import { supabase } from '../../../src/services/supabase';
import { useAuthStore } from '../../../src/stores/authStore';

const FILTROS = [
  { key: 'TODOS', label: 'Todos' },
  { key: 'RASCUNHO', label: 'Rascunho' },
  { key: 'DISPONIVEL', label: 'Disponível' },
  { key: 'EM_NEGOCIACAO', label: 'Negociação' },
  { key: 'VENDIDO', label: 'Vendido' },
  { key: 'ENCERRADO', label: 'Encerrado' },
];

type LoteStatus = 'RASCUNHO' | 'DISPONIVEL' | 'EM_NEGOCIACAO' | 'VENDIDO' | 'ENCERRADO';

interface Lote {
  id: string;
  variedade: string;
  processo: string;
  safra: string;
  quantidade_sacas: number;
  preco_por_saca: number | null;
  bebida: string | null;
  cata: number | null;
  notas_sensoriais: string | null;
  status: LoteStatus;
}

const statusConfig: Record<LoteStatus, { label: string; color: string; bg: string }> = {
  RASCUNHO: { label: 'Rascunho', color: '#666', bg: '#E8E8E8' },
  DISPONIVEL: { label: 'Disponível', color: '#2E7D32', bg: '#E8F5E9' },
  EM_NEGOCIACAO: { label: 'Em Negociação', color: '#F57F17', bg: '#FFF8E1' },
  VENDIDO: { label: 'Vendido', color: '#1565C0', bg: '#E3F2FD' },
  ENCERRADO: { label: 'Encerrado', color: '#999', bg: '#F5F5F5' },
};

function LoteCard({ lote }: { lote: Lote }) {
  const status = statusConfig[lote.status];
  return (
    <TouchableOpacity style={styles.card} onPress={() => router.push({ pathname: '/lote-detalhe', params: { id: lote.id } })}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.variedade}>{lote.variedade}</Text>
          <Text style={styles.processo}>{lote.processo} • {lote.safra}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: status.bg }]}>
          <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>
      <View style={styles.cardBottom}>
        <View style={styles.stat}>
          <Feather name="package" size={14} color={colors.textSecondary} />
          <Text style={styles.statText}>{lote.quantidade_sacas} sacas</Text>
        </View>
        {lote.preco_por_saca != null && (
          <View style={styles.stat}>
            <Feather name="dollar-sign" size={14} color={colors.textSecondary} />
            <Text style={styles.statText}>R$ {lote.preco_por_saca.toLocaleString('pt-BR')}/sc</Text>
          </View>
        )}
        {lote.bebida && (
          <View style={styles.stat}>
            <Feather name="coffee" size={14} color={colors.secondary} />
            <Text style={styles.statText}>{lote.bebida}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function LotesScreen() {
  const { user } = useAuthStore();
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('TODOS');

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      setLoading(true);
      supabase
        .from('lotes')
        .select('*')
        .eq('produtor_id', user.id)
        .order('criado_em', { ascending: false })
        .then(({ data, error }) => {
          if (!error && data) setLotes(data as Lote[]);
          setLoading(false);
        });
    }, [user?.id])
  );

  const filteredLotes = filtro === 'TODOS' ? lotes : lotes.filter((l) => l.status === filtro);

  return (
    <View style={styles.container}>
      {/* Filtro por status */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtroScroll} contentContainerStyle={styles.filtroRow}>
        {FILTROS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filtroBtn, filtro === f.key && styles.filtroBtnActive]}
            onPress={() => setFiltro(f.key)}
          >
            <Text style={[styles.filtroText, filtro === f.key && styles.filtroTextActive]}>
              {f.label}
              {f.key !== 'TODOS' && ` (${lotes.filter((l) => l.status === f.key).length})`}
              {f.key === 'TODOS' && ` (${lotes.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 80 }} />
      ) : (
        <FlatList
          data={filteredLotes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <LoteCard lote={item} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="package" size={48} color={colors.textLight} />
              <Text style={styles.emptyText}>Nenhum lote cadastrado</Text>
              <Text style={styles.emptySubtext}>Toque no + para criar seu primeiro lote</Text>
            </View>
          }
        />
      )}
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/novo-lote')}>
        <Feather name="plus" size={28} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  filtroScroll: { maxHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  filtroRow: { paddingHorizontal: spacing.md, gap: spacing.sm, alignItems: 'center' },
  filtroBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: borderRadius.full },
  filtroBtnActive: { backgroundColor: colors.primary },
  filtroText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textSecondary },
  filtroTextActive: { color: colors.white },
  list: { padding: spacing.md, paddingBottom: 100 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  variedade: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text },
  processo: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full },
  badgeText: { fontSize: fontSize.xs, fontWeight: '600' },
  cardBottom: { flexDirection: 'row', gap: spacing.md },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: fontSize.sm, color: colors.textSecondary },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: fontSize.lg, fontWeight: '600', color: colors.textSecondary, marginTop: spacing.md },
  emptySubtext: { fontSize: fontSize.sm, color: colors.textLight, marginTop: spacing.xs },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
