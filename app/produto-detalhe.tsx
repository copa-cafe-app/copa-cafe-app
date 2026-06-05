import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect } from 'react';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { supabase, supabasePublic } from '../src/services/supabase';
import { useAuthStore } from '../src/stores/authStore';

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
  fornecedores: { nome: string; cidade: string | null; estado: string | null; whatsapp: string | null; avaliacao: number } | null;
}

const catLabels: Record<string, string> = {
  FERTILIZANTES: 'Fertilizante', DEFENSIVOS: 'Defensivo',
  FERRAMENTAS: 'Ferramenta/Equipamento', MUDAS_SEMENTES: 'Muda/Semente', OUTROS_INSUMOS: 'Outro Insumo',
};

export default function ProdutoDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const [produto, setProduto] = useState<Produto | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantidade, setQuantidade] = useState(1);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!id) return;
    supabasePublic
      .from('produtos_marketplace')
      .select('*, fornecedores(nome, cidade, estado, whatsapp, avaliacao)')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) console.error('[ProdutoDetalhe] Erro:', error.message);
        if (data) setProduto(data as Produto);
        setLoading(false);
      });
  }, [id]);

  async function handleAddToCart() {
    if (!user?.id || !produto) return;
    setAdding(true);
    try {
      // Buscar pedido pendente ou criar um novo
      let { data: pedido } = await supabase
        .from('pedidos')
        .select('id')
        .eq('produtor_id', user.id)
        .eq('status', 'PENDENTE')
        .maybeSingle();

      if (!pedido) {
        const { data: novo, error } = await supabase
          .from('pedidos')
          .insert({ produtor_id: user.id, status: 'PENDENTE', total: 0 })
          .select('id')
          .single();
        if (error) throw error;
        pedido = novo;
      }

      // Adicionar item
      const subtotal = produto.preco * quantidade;
      const { error: itemErr } = await supabase.from('itens_pedido').insert({
        pedido_id: pedido!.id,
        produto_id: produto.id,
        quantidade,
        preco_unitario: produto.preco,
        subtotal,
      });
      if (itemErr) throw itemErr;

      // Atualizar total do pedido
      const { data: itens } = await supabase
        .from('itens_pedido')
        .select('subtotal')
        .eq('pedido_id', pedido!.id);
      const novoTotal = (itens || []).reduce((sum: number, i: any) => sum + i.subtotal, 0);
      await supabase.from('pedidos').update({ total: novoTotal }).eq('id', pedido!.id);

      Alert.alert('Adicionado!', `${quantidade}x ${produto.nome} adicionado ao carrinho`);
      router.back();
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Não foi possível adicionar ao carrinho');
    } finally {
      setAdding(false);
    }
  }

  if (loading || !produto) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalhes</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Imagem placeholder */}
        <View style={styles.imagePlaceholder}>
          <Feather name="package" size={56} color={colors.primary} />
        </View>

        {/* Badges */}
        <View style={styles.badgeRow}>
          <View style={styles.catBadge}>
            <Text style={styles.catBadgeText}>{catLabels[produto.categoria] || produto.categoria}</Text>
          </View>
          {produto.subcategoria && (
            <View style={styles.subBadge}>
              <Text style={styles.subBadgeText}>{produto.subcategoria}</Text>
            </View>
          )}
          {produto.indicacao_cafe && (
            <View style={styles.cafeBadge}>
              <Feather name="coffee" size={12} color={colors.success} />
              <Text style={styles.cafeBadgeText}>Para café</Text>
            </View>
          )}
        </View>

        <Text style={styles.nome}>{produto.nome}</Text>
        {produto.marca && <Text style={styles.marca}>{produto.marca}</Text>}

        <View style={styles.precoRow}>
          <Text style={styles.preco}>
            R$ {produto.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </Text>
          <Text style={styles.unidade}>/{produto.unidade}</Text>
        </View>

        {produto.fase_aplicacao && (
          <View style={styles.faseRow}>
            <Feather name="calendar" size={14} color={colors.textSecondary} />
            <Text style={styles.faseText}>Fase: {produto.fase_aplicacao}</Text>
          </View>
        )}

        {produto.descricao && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Descrição</Text>
            <Text style={styles.descricao}>{produto.descricao}</Text>
          </View>
        )}

        {/* Fornecedor */}
        {produto.fornecedores && (
          <View style={styles.fornecedorCard}>
            <View style={styles.fornecedorIcon}>
              <Feather name="truck" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fornecedorNome}>{produto.fornecedores.nome}</Text>
              {produto.fornecedores.cidade && (
                <Text style={styles.fornecedorLocal}>
                  {produto.fornecedores.cidade}, {produto.fornecedores.estado}
                </Text>
              )}
              {produto.fornecedores.avaliacao > 0 && (
                <View style={styles.ratingRow}>
                  <Feather name="star" size={12} color="#F9A825" />
                  <Text style={styles.ratingText}>{produto.fornecedores.avaliacao.toFixed(1)}</Text>
                </View>
              )}
            </View>
            {produto.fornecedores.whatsapp && (
              <TouchableOpacity
                style={styles.whatsappBtn}
                onPress={() => {
                  const num = String(produto.fornecedores?.whatsapp || '').replace(/\D/g, '');
                  const texto = encodeURIComponent(`Olá! Tenho interesse no produto "${produto.nome}" no Copa Café.`);
                  Linking.openURL(`https://wa.me/${num}?text=${texto}`).catch(() =>
                    Alert.alert('WhatsApp', 'Não foi possível abrir o WhatsApp.')
                  );
                }}
              >
                <Feather name="message-circle" size={18} color="#25D366" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Quantidade */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quantidade</Text>
          <View style={styles.qtyRow}>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => setQuantidade(Math.max(1, quantidade - 1))}
            >
              <Feather name="minus" size={18} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.qtyValue}>{quantidade}</Text>
            <TouchableOpacity
              style={styles.qtyBtn}
              onPress={() => setQuantidade(quantidade + 1)}
            >
              <Feather name="plus" size={18} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.qtyTotal}>
              = R$ {(produto.preco * quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Botão fixo */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.addBtn, adding && { opacity: 0.5 }]}
          onPress={handleAddToCart}
          disabled={adding}
        >
          <Feather name="shopping-cart" size={20} color={colors.white} />
          <Text style={styles.addBtnText}>{adding ? 'Adicionando...' : 'Adicionar ao Carrinho'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 100 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: 72, paddingBottom: spacing.md },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  imagePlaceholder: { height: 200, backgroundColor: colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
  catBadge: { backgroundColor: colors.surfaceVariant, paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full },
  catBadgeText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.primary },
  subBadge: { backgroundColor: '#E3F2FD', paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full },
  subBadgeText: { fontSize: fontSize.xs, fontWeight: '600', color: '#1565C0' },
  cafeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full },
  cafeBadgeText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.success },
  nome: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, paddingHorizontal: spacing.md },
  marca: { fontSize: fontSize.md, color: colors.textSecondary, paddingHorizontal: spacing.md, marginTop: 2 },
  precoRow: { flexDirection: 'row', alignItems: 'baseline', paddingHorizontal: spacing.md, marginTop: spacing.sm },
  preco: { fontSize: 28, fontWeight: '700', color: colors.primary },
  unidade: { fontSize: fontSize.md, color: colors.textSecondary, marginLeft: 4 },
  faseRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, marginTop: spacing.sm },
  faseText: { fontSize: fontSize.sm, color: colors.textSecondary },
  section: { paddingHorizontal: spacing.md, marginTop: spacing.lg },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  descricao: { fontSize: fontSize.md, color: colors.textSecondary, lineHeight: 22 },
  fornecedorCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, marginHorizontal: spacing.md, marginTop: spacing.lg, padding: spacing.md, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border },
  fornecedorIcon: { width: 44, height: 44, borderRadius: borderRadius.md, backgroundColor: colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  fornecedorNome: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  fornecedorLocal: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  ratingText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  whatsappBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  qtyBtn: { width: 40, height: 40, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  qtyValue: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, minWidth: 40, textAlign: 'center' },
  qtyTotal: { fontSize: fontSize.md, fontWeight: '600', color: colors.primary, marginLeft: 'auto' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.md },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, height: 52, borderRadius: borderRadius.md },
  addBtnText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
});
