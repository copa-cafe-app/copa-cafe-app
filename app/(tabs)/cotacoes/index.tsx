import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useState, useCallback } from 'react';
import { useFocusEffect, router } from 'expo-router';
import { colors, spacing, fontSize, borderRadius } from '../../../src/constants/theme';
import { WHATSAPP_NEGOCIACAO } from '../../../src/constants/config';
import { fetchCopaFeed, fetchMarketData } from '../../../src/services/marketFeeds';
import { useCachedResource } from '../../../src/hooks/useCachedResource';
import { CACHE_KEYS } from '../../../src/utils/cache';
import { CopaPriceTable } from '../../../src/components/prices/CopaPriceTable';
import { OfflineNotice } from '../../../src/components/prices/OfflineNotice';

// Número do CTA vem de config (WHATSAPP_NEGOCIACAO) — trocar lá quando o número
// dedicado existir; o atual vira sender do OTP. Ver memória project_cta_whatsapp_swap.
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NEGOCIACAO}`;
const WHATSAPP_CHANNEL = 'https://whatsapp.com/channel/0029Vb6Qo3fL7UVRzGS4fn3M';

function formatBRL(value: number | null | undefined, decimals = 2): string {
  if (value == null || isNaN(value)) return 'R$ --';
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function VariacaoBadge({ variacao }: { variacao: number | null | undefined }) {
  if (variacao == null || isNaN(variacao)) return null;
  const isPositive = variacao >= 0;
  return (
    <View style={[styles.variacao, { backgroundColor: isPositive ? '#E8F5E9' : '#FFEBEE' }]}>
      <Feather
        name={isPositive ? 'arrow-up-right' : 'arrow-down-right'}
        size={14}
        color={isPositive ? colors.success : colors.error}
      />
      <Text style={[styles.variacaoText, { color: isPositive ? colors.success : colors.error }]}>
        {isPositive ? '+' : ''}{variacao.toFixed(1)}%
      </Text>
    </View>
  );
}

export default function CotacoesScreen() {
  // Stale-while-revalidate: mostra o último dado salvo na hora e atualiza em
  // segundo plano. Sem internet, fica o cache + aviso "Sem conexão — ...".
  const copa = useCachedResource(CACHE_KEYS.copaPrices, fetchCopaFeed);
  const marketRes = useCachedResource(CACHE_KEYS.market, fetchMarketData);
  const market = marketRes.data;
  const loading = marketRes.loading;
  const [refreshing, setRefreshing] = useState(false);
  const refreshCopa = copa.refresh;
  const refreshMarket = marketRes.refresh;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshMarket(), refreshCopa()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshMarket, refreshCopa]);

  useFocusEffect(
    useCallback(() => {
      refreshMarket();
      refreshCopa();
    }, [refreshMarket, refreshCopa])
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
    >

      {/* ===== 1. PRECOS COPA CAFE (DESTAQUE PRINCIPAL) ===== */}
      <CopaPriceTable
        feed={copa.data}
        loading={copa.loading}
        offline={copa.offline}
        savedAt={copa.savedAt}
        onRetry={refreshCopa}
      />

      {/* WhatsApp CTA logo apos precos Copa Cafe */}
      <TouchableOpacity
        style={styles.whatsappBtn}
        onPress={() => Linking.openURL(`${WHATSAPP_URL}?text=${encodeURIComponent('Olá Copa Café! Gostaria de saber mais sobre os preços de compra.')}`)}
      >
        <Feather name="message-circle" size={22} color={colors.white} />
        <View style={{ flex: 1 }}>
          <Text style={styles.whatsappTitle}>Negociar pelo WhatsApp</Text>
          <Text style={styles.whatsappSubtitle}>Fale direto com a Copa Café</Text>
        </View>
        <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

      {marketRes.offline ? <OfflineNotice what="cotações" savedAt={marketRes.savedAt} /> : null}

      {/* ===== 2. DOLAR (MEDIA DESTAQUE) ===== */}
      <View style={styles.dolarCard}>
        <View style={styles.dolarHeader}>
          <View style={styles.dolarIconCircle}>
            <Feather name="dollar-sign" size={18} color={colors.white} />
          </View>
          <Text style={styles.dolarTitle}>Dólar Comercial</Text>
          {market?.cambio?.variacao_percent != null && (
            <VariacaoBadge variacao={market.cambio.variacao_percent} />
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.secondary} style={{ marginVertical: spacing.md }} />
        ) : market?.cambio && market.cambio.usd_brl > 0 ? (
          <>
            <Text style={styles.dolarSingleValue}>
              {formatBRL(market.cambio.usd_brl, 2)}
            </Text>
            <Text style={styles.dolarFonte}>
              Fonte: {market.cambio.fonte || 'N/A'}
              {market.cambio.ultima_cotacao ? ` — ${market.cambio.ultima_cotacao}` : ''}
            </Text>
          </>
        ) : (
          <Text style={styles.indisponivel}>Cotação indisponível</Text>
        )}
      </View>

      {/* ===== 3. BOLSA ICE (MEDIA DESTAQUE) ===== */}
      <View style={styles.bolsaCard}>
        <View style={styles.bolsaHeader}>
          <View style={[styles.dolarIconCircle, { backgroundColor: '#1565C0' }]}>
            <Feather name="trending-up" size={18} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bolsaTitle}>Bolsa — Café Arábica</Text>
            <Text style={styles.bolsaSubtitle}>ICE Futures (KC=F)</Text>
          </View>
          {market?.bolsa?.variacao_percent != null && (
            <VariacaoBadge variacao={market.bolsa.variacao_percent} />
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.info} style={{ marginVertical: spacing.md }} />
        ) : market?.bolsa && market.bolsa.cents_per_lb > 0 ? (
          <>
            <Text style={styles.bolsaSingleValue}>
              {market.bolsa.cents_per_lb.toFixed(2)} US¢/lb
            </Text>
            <Text style={styles.dolarFonte}>Fonte: {market.bolsa.fonte || 'N/A'}</Text>
          </>
        ) : (
          <>
            <Text style={styles.indisponivel}>Cotação da bolsa indisponível</Text>
            {market?.bolsa?.fonte === 'Indisponível' && (
              <Text style={[styles.dolarFonte, { marginTop: 4 }]}>
                Fonte Yahoo Finance fora do ar — tente novamente em alguns minutos
              </Text>
            )}
            {__DEV__ && market?._debug && (
              <Text style={[styles.dolarFonte, { marginTop: 4, fontSize: 10 }]}>
                Debug: {market._debug.filter(d => d.toLowerCase().includes('yahoo') || d.toLowerCase().includes('bolsa')).join(' | ')}
              </Text>
            )}
          </>
        )}
      </View>

      {/* Ultima atualizacao */}
      {market?.atualizado_em ? (
        <Text style={styles.updatedAt}>
          Atualizado: {(() => {
            try { return new Date(market.atualizado_em).toLocaleString('pt-BR'); }
            catch { return market.atualizado_em; }
          })()}
        </Text>
      ) : null}

      {/* Canal WhatsApp */}
      <TouchableOpacity
        style={styles.channelBtn}
        onPress={() => Linking.openURL(WHATSAPP_CHANNEL)}
      >
        <Feather name="radio" size={18} color="#25D366" />
        <Text style={styles.channelText}>Seguir canal Copa Café no WhatsApp</Text>
        <Feather name="external-link" size={16} color={colors.textLight} />
      </TouchableOpacity>

      {/* Acoes */}
      <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/alertas-preco')}>
        <Feather name="bell" size={20} color={colors.primary} />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={styles.actionTitle}>Alertas de Preço</Text>
          <Text style={styles.actionSubtitle}>Receba notificação quando o preço atingir seu alvo</Text>
        </View>
        <Feather name="chevron-right" size={20} color={colors.textLight} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/simulador-venda')}>
        <Feather name="bar-chart" size={20} color={colors.primary} />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={styles.actionTitle}>Simulador de Venda</Text>
          <Text style={styles.actionSubtitle}>Calcule sua receita e margem de lucro</Text>
        </View>
        <Feather name="chevron-right" size={20} color={colors.textLight} />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },

  // ===== Dolar =====
  dolarCard: {
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
  dolarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dolarIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dolarTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  dolarValues: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dolarValueBox: {
    flex: 1,
    alignItems: 'center',
  },
  dolarValueLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  dolarValueNum: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  dolarDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  dolarSingleValue: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  dolarFonte: {
    fontSize: fontSize.xs,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  // ===== Bolsa =====
  bolsaCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  bolsaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  bolsaTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
  },
  bolsaSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  bolsaValues: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bolsaValueBox: {
    flex: 1,
    alignItems: 'center',
  },
  bolsaValueLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  bolsaValueNum: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  bolsaSingleValue: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },

  // Variacao badge
  variacao: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  variacaoText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginLeft: 2,
  },

  // Geral
  indisponivel: {
    fontSize: fontSize.sm,
    color: colors.textLight,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  updatedAt: {
    fontSize: fontSize.xs,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  // WhatsApp
  whatsappBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  whatsappTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.white,
  },
  whatsappSubtitle: {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 1,
  },
  channelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#25D366',
  },
  channelText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: '#25D366',
  },

  // Actions
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  actionTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  actionSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
