import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useState, useCallback } from 'react';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { supabase } from '../src/services/supabase';
import { useAuthStore } from '../src/stores/authStore';

interface ItemCarrinho {
  id: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  produtos_marketplace: { nome: string; unidade: string; marca: string | null };
}

export default function CarrinhoScreen() {
  const { user } = useAuthStore();
  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  const [pedidoId, setPedidoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmando, setConfirmando] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      setLoading(true);
      supabase
        .from('pedidos')
        .select('id')
        .eq('produtor_id', user.id)
        .eq('status', 'PENDENTE')
        .maybeSingle()
        .then(async ({ data: pedido }) => {
          if (!pedido) {
            setItens([]);
            setLoading(false);
            return;
          }
          setPedidoId(pedido.id);
          const { data } = await supabase
            .from('itens_pedido')
            .select('*, produtos_marketplace(nome, unidade, marca)')
            .eq('pedido_id', pedido.id);
          if (data) setItens(data as ItemCarrinho[]);
          setLoading(false);
        });
    }, [user?.id])
  );

  const total = itens.reduce((sum, i) => sum + i.subtotal, 0);

  async function handleRemoveItem(itemId: string) {
    await supabase.from('itens_pedido').delete().eq('id', itemId);
    const newItens = itens.filter((i) => i.id !== itemId);
    setItens(newItens);
    if (pedidoId) {
      const novoTotal = newItens.reduce((sum, i) => sum + i.subtotal, 0);
      await supabase.from('pedidos').update({ total: novoTotal }).eq('id', pedidoId);
    }
  }

  async function handleConfirmar() {
    if (!pedidoId || itens.length === 0) return;
    setConfirmando(true);
    try {
      await supabase.from('pedidos').update({ status: 'CONFIRMADO' }).eq('id', pedidoId);
      Alert.alert(
        'Pedido Confirmado!',
        'Seu pedido foi enviado. O fornecedor entrará em contato para combinar entrega e pagamento.',
        [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
      );
    } catch {
      Alert.alert('Erro', 'Não foi possível confirmar o pedido');
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Carrinho</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 80 }} />
      ) : itens.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="shopping-cart" size={56} color={colors.textLight} />
          <Text style={styles.emptyText}>Carrinho vazio</Text>
          <Text style={styles.emptySubtext}>Explore o marketplace para adicionar produtos</Text>
          <TouchableOpacity style={styles.explorarBtn} onPress={() => router.push('/marketplace')}>
            <Text style={styles.explorarBtnText}>Explorar Marketplace</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.list}>
            {itens.map((item) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemNome}>{item.produtos_marketplace.nome}</Text>
                  {item.produtos_marketplace.marca && (
                    <Text style={styles.itemMarca}>{item.produtos_marketplace.marca}</Text>
                  )}
                  <Text style={styles.itemQty}>
                    {item.quantidade}x R$ {item.preco_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /{item.produtos_marketplace.unidade}
                  </Text>
                </View>
                <View style={styles.itemRight}>
                  <Text style={styles.itemSubtotal}>
                    R$ {item.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </Text>
                  <TouchableOpacity onPress={() => handleRemoveItem(item.id)}>
                    <Feather name="trash-2" size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* Footer com total e botão */}
          <View style={styles.footer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>
                R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </Text>
            </View>
            <Text style={styles.totalInfo}>{itens.length} item(ns)</Text>
            <TouchableOpacity
              style={[styles.confirmarBtn, confirmando && { opacity: 0.5 }]}
              onPress={handleConfirmar}
              disabled={confirmando}
            >
              <Feather name="check-circle" size={20} color={colors.white} />
              <Text style={styles.confirmarText}>
                {confirmando ? 'Confirmando...' : 'Confirmar Pedido'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.paymentNote}>
              Pagamento é combinado diretamente com o fornecedor
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: 72, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  empty: { alignItems: 'center', marginTop: 80, paddingHorizontal: spacing.xl },
  emptyText: { fontSize: fontSize.xl, fontWeight: '600', color: colors.textSecondary, marginTop: spacing.lg },
  emptySubtext: { fontSize: fontSize.md, color: colors.textLight, marginTop: spacing.xs, textAlign: 'center' },
  explorarBtn: { marginTop: spacing.lg, backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: borderRadius.md },
  explorarBtnText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
  list: { padding: spacing.md, paddingBottom: 250 },
  itemCard: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  itemNome: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  itemMarca: { fontSize: fontSize.xs, color: colors.textLight, marginTop: 2 },
  itemQty: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  itemRight: { alignItems: 'flex-end', justifyContent: 'space-between' },
  itemSubtotal: { fontSize: fontSize.md, fontWeight: '700', color: colors.primary },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.lg },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text },
  totalValue: { fontSize: fontSize.xl, fontWeight: '700', color: colors.primary },
  totalInfo: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.md },
  confirmarBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, height: 52, borderRadius: borderRadius.md },
  confirmarText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
  paymentNote: { fontSize: fontSize.xs, color: colors.textLight, textAlign: 'center', marginTop: spacing.sm },
});
