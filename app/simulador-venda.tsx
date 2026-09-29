import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { supabase } from '../src/services/supabase';
import { useAuthStore } from '../src/stores/authStore';
import { parseBRL, formatBRL } from '../src/utils/format';
import { safrasRecentes, safraDaData } from '../src/utils/safra';
import { fetchCopaPrices, precoDestaque } from '../src/services/copaPrices.service';

// Evita que a tela fique presa no carregamento com sinal fraco.
function comTimeout<T>(p: PromiseLike<T>, ms = 15000): Promise<T> {
  return Promise.race([
    Promise.resolve(p),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('tempo esgotado')), ms)),
  ]);
}

const SAFRAS = safrasRecentes(3);

interface DespesaValor { valor: number; safra: string | null; data: string }
interface LoteSacas { safra: string; quantidade_sacas: number }

export default function SimuladorVendaScreen() {
  const { user } = useAuthStore();
  const [sacas, setSacas] = useState('');
  const [precoManual, setPrecoManual] = useState('');
  const [cotacaoAtual, setCotacaoAtual] = useState(0);
  const [despesas, setDespesas] = useState<DespesaValor[]>([]);
  const [lotes, setLotes] = useState<LoteSacas[]>([]);
  const [safraSel, setSafraSel] = useState(SAFRAS[0]);
  const [erroCustos, setErroCustos] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    Promise.all([
      // Preço sugerido = preço da COPA (Bebida/Duro cata 20), não a bolsa. A bolsa
      // (ICE) é só referência de mercado em dólar e não serve pra simular receita.
      // Antes isto lia `pricesData.arabica.preco_saca` — chave que a função
      // `coffee-prices` nunca devolveu, então a cotação ficava sempre em ZERO e a
      // simulação só funcionava se o produtor digitasse o preço na mão.
      comTimeout(fetchCopaPrices()).catch(() => null),
      // Despesas e lotes (com safra) pra estimar custo/saca da safra escolhida.
      user?.id
        ? comTimeout(supabase.from('despesas_producao').select('valor, safra, data').eq('produtor_id', user.id))
            .catch(() => ({ data: null, error: true }))
        : Promise.resolve({ data: [], error: null }),
      user?.id
        ? comTimeout(supabase.from('lotes').select('safra, quantidade_sacas').eq('produtor_id', user.id))
            .catch(() => ({ data: null, error: true }))
        : Promise.resolve({ data: [], error: null }),
    ])
      .then(([feed, despRes, lotesRes]) => {
        if (cancel) return;
        const precoCopa = feed ? precoDestaque(feed) : null;
        if (precoCopa) setCotacaoAtual(precoCopa);
        if (despRes.error || lotesRes.error) setErroCustos(true);
        const ds = (despRes.data || []) as DespesaValor[];
        const ls = (lotesRes.data || []) as LoteSacas[];
        setDespesas(ds);
        setLotes(ls);
        // Se a safra corrente ainda não tem lotes, começa pela mais recente que tem.
        const comSacas = SAFRAS.find((sf) => ls.some((l) => l.safra === sf && l.quantidade_sacas > 0));
        if (comSacas) setSafraSel(comSacas);
      })
      .catch(() => { if (!cancel) setErroCustos(true); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [user?.id]);

  // Custo médio/saca da safra escolhida = despesas da safra / sacas dos lotes da safra.
  const totalDespesasSafra = despesas
    .filter((d) => (d.safra || safraDaData(d.data)) === safraSel)
    .reduce((sum, d) => sum + (Number(d.valor) || 0), 0);
  const totalSacasSafra = lotes
    .filter((l) => l.safra === safraSel)
    .reduce((sum, l) => sum + (Number(l.quantidade_sacas) || 0), 0);
  const custoMedioSaca = totalSacasSafra > 0
    ? Math.round((totalDespesasSafra / totalSacasSafra) * 100) / 100
    : 0;

  // parseBRL: "1.000" -> 1000 (parseInt dava 1).
  const qtdSacas = Math.max(0, parseBRL(sacas) ?? 0);
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
          <View style={styles.safraRow}>
            {SAFRAS.map((sf) => (
              <TouchableOpacity key={sf} style={[styles.safraChip, safraSel === sf && styles.safraChipActive]} onPress={() => setSafraSel(sf)}>
                <Text style={[styles.safraChipText, safraSel === sf && styles.safraChipTextActive]}>{sf}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {custoMedioSaca > 0 && (
            <Text style={styles.custoInfo}>
              (Custo médio da safra {safraSel}: {formatBRL(custoMedioSaca)}/saca, baseado nas suas despesas e lotes)
            </Text>
          )}
          {custoMedioSaca === 0 && (
            <View style={styles.custoAlerta}>
              <Feather name="alert-triangle" size={16} color="#E65100" />
              <Text style={styles.custoAlertaText}>
                {erroCustos
                  ? 'Não foi possível carregar seus custos (sem internet?). O custo não entrou na conta.'
                  : totalSacasSafra === 0
                    ? `Cadastre seus lotes da safra ${safraSel} para ver o custo por saca.`
                    : `Registre as despesas da safra ${safraSel} em Custos de Produção (aba Fazenda) para um cálculo mais preciso.`}
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
  safraRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  safraChip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: borderRadius.full, backgroundColor: colors.surfaceVariant },
  safraChipActive: { backgroundColor: colors.primary },
  safraChipText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  safraChipTextActive: { color: colors.white },
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
