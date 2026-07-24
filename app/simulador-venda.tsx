import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { supabase } from '../src/services/supabase';
import { useAuthStore } from '../src/stores/authStore';
import { parseBRL } from '../src/utils/format';
import { fetchCopaPrices, precoDestaque } from '../src/services/copaPrices.service';

export default function SimuladorVendaScreen() {
  const { user } = useAuthStore();
  const [sacas, setSacas] = useState('');
  const [precoManual, setPrecoManual] = useState('');
  const [cotacaoAtual, setCotacaoAtual] = useState(0);
  const [custoMedioSaca, setCustoMedioSaca] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      // Preço sugerido = preço da COPA (Bebida/Duro cata 20), não a bolsa. A bolsa
      // (ICE) é só referência de mercado em dólar e não serve pra simular receita.
      // Antes isto lia `pricesData.arabica.preco_saca` — chave que a função
      // `coffee-prices` nunca devolveu, então a cotação ficava sempre em ZERO e a
      // simulação só funcionava se o produtor digitasse o preço na mão.
      fetchCopaPrices().catch(() => null),
      // Buscar custo médio
      user?.id
        ? supabase.from('despesas_producao').select('valor').eq('produtor_id', user.id)
        : Promise.resolve({ data: [] }),
      // Buscar total de sacas cadastradas pra estimar custo/saca
      user?.id
        ? supabase.from('lotes').select('quantidade_sacas').eq('produtor_id', user.id)
        : Promise.resolve({ data: [] }),
    ]).then(([feed, despRes, lotesRes]) => {
      const precoCopa = feed ? precoDestaque(feed) : null;
      if (precoCopa) setCotacaoAtual(precoCopa);
      const totalDespesas = (despRes.data || []).reduce((sum: number, d: any) => sum + (d.valor || 0), 0);
      const totalSacas = (lotesRes.data || []).reduce((sum: number, l: any) => sum + (l.quantidade_sacas || 0), 0);
      if (totalSacas > 0) {
        setCustoMedioSaca(Math.round((totalDespesas / totalSacas) * 100) / 100);
      }
      setLoading(false);
    });
  }, []);

  const qtdSacas = parseInt(sacas) || 0;
  const precoSaca = precoManual ? (parseBRL(precoManual) ?? cotacaoAtual) : cotacaoAtual;
  const receitaBruta = qtdSacas * precoSaca;
  const custoTotal = qtdSacas * custoMedioSaca;
  const lucro = receitaBruta - custoTotal;
  const margem = receitaBruta > 0 ? (lucro / receitaBruta) * 100 : 0;

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Simulador de Venda</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Cotação atual */}
      <View style={styles.cotacaoCard}>
        <Feather name="trending-up" size={20} color={colors.white} />
        <View style={{ flex: 1 }}>
          <Text style={styles.cotacaoLabel}>Preço Copa Café (atual)</Text>
          <Text style={styles.cotacaoValue}>
            R$ {cotacaoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / saca
          </Text>
        </View>
      </View>

      {/* Inputs */}
      <View style={styles.inputSection}>
        <View style={styles.field}>
          <Text style={styles.label}>Quantidade de sacas</Text>
          <TextInput
            style={styles.input}
            value={sacas}
            onChangeText={setSacas}
            placeholder="Ex: 100"
            keyboardType="numeric"
            placeholderTextColor={colors.textLight}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Preço por saca (opcional)</Text>
          <Text style={styles.hint}>Deixe vazio para usar cotação atual</Text>
          <View style={styles.priceRow}>
            <Text style={styles.prefix}>R$</Text>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={precoManual}
              onChangeText={setPrecoManual}
              placeholder={cotacaoAtual.toFixed(2)}
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textLight}
            />
          </View>
        </View>
      </View>

      {/* Resultado */}
      {qtdSacas > 0 && (
        <View style={styles.resultSection}>
          <Text style={styles.resultTitle}>Resultado da Simulação</Text>

          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Receita Bruta</Text>
            <Text style={styles.resultValueGreen}>
              R$ {receitaBruta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Text>
          </View>

          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Custo Estimado</Text>
            <Text style={styles.resultValueRed}>
              - R$ {custoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Text>
          </View>
          {custoMedioSaca > 0 && (
            <Text style={styles.custoInfo}>
              (Custo médio: R$ {custoMedioSaca.toFixed(2)}/saca, baseado nas suas despesas)
            </Text>
          )}
          {custoMedioSaca === 0 && (
            <View style={styles.custoAlerta}>
              <Feather name="alert-triangle" size={16} color="#E65100" />
              <Text style={styles.custoAlertaText}>
                Preencha seus custos de produção na aba Fazenda para um cálculo mais preciso
              </Text>
            </View>
          )}

          <View style={styles.divider} />

          <View style={styles.resultRow}>
            <Text style={styles.resultLabelBold}>Lucro Estimado</Text>
            <Text style={[styles.resultValueBold, { color: lucro >= 0 ? colors.success : colors.error }]}>
              R$ {lucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </Text>
          </View>

          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Margem</Text>
            <Text style={[styles.resultValueBold, { color: margem >= 0 ? colors.success : colors.error }]}>
              {margem.toFixed(1)}%
            </Text>
          </View>

          {/* Criar lote */}
          <TouchableOpacity
            style={styles.criarLoteBtn}
            onPress={() => router.push('/novo-lote')}
          >
            <Feather name="plus-circle" size={20} color={colors.white} />
            <Text style={styles.criarLoteText}>Criar lote com este preço</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 72, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  cotacaoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  cotacaoLabel: { fontSize: fontSize.xs, color: 'rgba(255,255,255,0.7)' },
  cotacaoValue: { fontSize: fontSize.lg, fontWeight: '700', color: colors.white, marginTop: 2 },
  inputSection: { marginBottom: spacing.md },
  field: { marginBottom: spacing.md },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  hint: { fontSize: fontSize.xs, color: colors.textLight, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: fontSize.lg,
    color: colors.text,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  prefix: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text },
  resultSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  resultLabel: { fontSize: fontSize.md, color: colors.textSecondary },
  resultLabelBold: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  resultValueGreen: { fontSize: fontSize.md, fontWeight: '600', color: colors.success },
  resultValueRed: { fontSize: fontSize.md, fontWeight: '600', color: colors.error },
  resultValueBold: { fontSize: fontSize.lg, fontWeight: '700' },
  custoInfo: { fontSize: fontSize.xs, color: colors.textLight, marginBottom: spacing.sm },
  custoAlerta: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 12,
    marginBottom: spacing.sm,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  custoAlertaText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: '#E65100',
    fontWeight: '600',
    lineHeight: 18,
  },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  criarLoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  criarLoteText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
});
