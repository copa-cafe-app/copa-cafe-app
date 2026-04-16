import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, FlatList } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { supabase, supabasePublic } from '../src/services/supabase';

interface Produto {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string;
  subcategoria: string | null;
  marca: string | null;
  preco: number;
  unidade: string;
  indicacao_cafe: boolean;
  fase_aplicacao: string | null;
  destaque: boolean;
  fornecedores: { nome: string } | null;
}

const CATEGORIAS = [
  { key: 'TODOS', label: 'Todos', icon: 'grid' },
  { key: 'FERTILIZANTES', label: 'Fertilizantes', icon: 'droplet' },
  { key: 'DEFENSIVOS', label: 'Defensivos', icon: 'shield' },
  { key: 'FERRAMENTAS', label: 'Ferramentas', icon: 'tool' },
  { key: 'MUDAS_SEMENTES', label: 'Mudas', icon: 'sun' },
  { key: 'OUTROS_INSUMOS', label: 'Outros', icon: 'package' },
];

export default function MarketplaceScreen() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [categoria, setCategoria] = useState('TODOS');
  const [busca, setBusca] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function fetchProdutos() {
        setLoading(true);
        setErro(null);

        try {
          // Use the public (no-auth) client so expired JWTs don't cause 401s.
          // Marketplace data has public RLS policies, no auth required.
          let query = supabasePublic
            .from('produtos_marketplace')
            .select('*, fornecedores(nome)')
            .eq('ativo', true)
            .order('destaque', { ascending: false })
            .order('nome');

          if (categoria !== 'TODOS') {
            query = query.eq('categoria', categoria);
          }

          const { data, error } = await query;

          if (cancelled) return;

          if (error) {
            console.error('[Marketplace] Erro ao buscar produtos:', error.message, error.details, error.hint);
            setErro(error.message);
            setProdutos([]);
          } else {
            console.log('[Marketplace] Produtos carregados:', (data ?? []).length);
            setProdutos((data ?? []) as Produto[]);
          }
        } catch (err: any) {
          if (cancelled) return;
          console.error('[Marketplace] Erro inesperado:', err);
          setErro('Erro de conexão');
          setProdutos([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      }

      fetchProdutos();

      return () => { cancelled = true; };
    }, [categoria, retryCount])
  );

  const filteredProdutos = busca
    ? produtos.filter((p) =>
        p.nome.toLowerCase().includes(busca.toLowerCase()) ||
        p.marca?.toLowerCase().includes(busca.toLowerCase()) ||
        p.subcategoria?.toLowerCase().includes(busca.toLowerCase())
      )
    : produtos;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Insumos Agrícolas</Text>
        <TouchableOpacity onPress={() => router.push('/carrinho')}>
          <Feather name="shopping-cart" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Busca */}
      <View style={styles.searchBar}>
        <Feather name="search" size={18} color={colors.textLight} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar insumos..."
          value={busca}
          onChangeText={setBusca}
          placeholderTextColor={colors.textLight}
        />
        {busca ? (
          <TouchableOpacity onPress={() => setBusca('')}>
            <Feather name="x" size={18} color={colors.textLight} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Categorias */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catRow}>
        {CATEGORIAS.map((c) => (
          <TouchableOpacity
            key={c.key}
            style={[styles.catBtn, categoria === c.key && styles.catBtnActive]}
            onPress={() => setCategoria(c.key)}
          >
            <Feather name={c.icon as any} size={16} color={categoria === c.key ? colors.white : colors.primary} />
            <Text style={[styles.catText, categoria === c.key && styles.catTextActive]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Produtos */}
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={filteredProdutos}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.prodRow}
          contentContainerStyle={styles.prodList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.prodCard}
              onPress={() => router.push({ pathname: '/produto-detalhe', params: { id: item.id } })}
            >
              <View style={styles.prodImagePlaceholder}>
                <Feather
                  name={
                    item.categoria === 'FERTILIZANTES' ? 'droplet' :
                    item.categoria === 'DEFENSIVOS' ? 'shield' :
                    item.categoria === 'FERRAMENTAS' ? 'tool' :
                    item.categoria === 'MUDAS_SEMENTES' ? 'sun' :
                    'package'
                  }
                  size={28}
                  color={colors.primary}
                />
                {item.destaque && (
                  <View style={styles.destaqueBadge}>
                    <Text style={styles.destaqueText}>Destaque</Text>
                  </View>
                )}
              </View>
              {item.indicacao_cafe && (
                <View style={styles.cafeBadge}>
                  <Text style={styles.cafeBadgeText}>Para café</Text>
                </View>
              )}
              <Text style={styles.prodNome} numberOfLines={2}>{item.nome}</Text>
              {item.marca && <Text style={styles.prodMarca}>{item.marca}</Text>}
              <Text style={styles.prodPreco}>
                R$ {(item.preco ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </Text>
              <Text style={styles.prodUnidade}>/{item.unidade}</Text>
              {item.fornecedores && (
                <Text style={styles.prodFornecedor}>{item.fornecedores.nome}</Text>
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name={erro ? 'alert-circle' : 'package'} size={48} color={erro ? colors.error : colors.textLight} />
              <Text style={styles.emptyText}>
                {erro ? 'Erro ao carregar produtos' : 'Nenhum produto encontrado'}
              </Text>
              {erro && <Text style={styles.erroDetail}>{erro}</Text>}
              {erro && (
                <TouchableOpacity style={styles.retryBtn} onPress={() => setRetryCount((c) => c + 1)}>
                  <Text style={styles.retryText}>Tentar novamente</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: 72, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, margin: spacing.md, marginBottom: 0, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, height: 44, gap: spacing.sm },
  searchInput: { flex: 1, fontSize: fontSize.md, color: colors.text },
  catScroll: { flexGrow: 0, flexShrink: 0, marginTop: spacing.sm, marginBottom: spacing.sm },
  catRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  catBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.surfaceVariant },
  catBtnActive: { backgroundColor: colors.primary },
  catText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.primary },
  catTextActive: { color: colors.white },
  prodList: { padding: spacing.md, paddingBottom: 100 },
  prodRow: { gap: spacing.md },
  prodCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: '48%',
  },
  prodImagePlaceholder: {
    height: 100,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  destaqueBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: colors.secondary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: borderRadius.sm },
  destaqueText: { fontSize: 10, fontWeight: '700', color: colors.white },
  cafeBadge: { backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.full, alignSelf: 'flex-start', marginBottom: 4 },
  cafeBadgeText: { fontSize: 10, fontWeight: '600', color: colors.success },
  prodNome: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: 2 },
  prodMarca: { fontSize: fontSize.xs, color: colors.textLight, marginBottom: 4 },
  prodPreco: { fontSize: fontSize.md, fontWeight: '700', color: colors.primary },
  prodUnidade: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: -2 },
  prodFornecedor: { fontSize: fontSize.xs, color: colors.textLight, marginTop: 4 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.md },
  erroDetail: { fontSize: fontSize.sm, color: colors.textLight, marginTop: spacing.xs, textAlign: 'center', paddingHorizontal: spacing.lg },
  retryBtn: { marginTop: spacing.md, backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.md },
  retryText: { color: colors.white, fontWeight: '600', fontSize: fontSize.sm },
});
