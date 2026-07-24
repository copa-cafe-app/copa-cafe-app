import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useState, useCallback } from 'react';
import { useFocusEffect, router } from 'expo-router';
import { colors, spacing, fontSize, borderRadius } from '../../../src/constants/theme';
import { SUPABASE_URL, SUPABASE_ANON_KEY, WHATSAPP_NEGOCIACAO } from '../../../src/constants/config';
import { fetchCopaPrices, type CopaCafePrice } from '../../../src/services/copaPrices.service';

// Número do CTA vem de config (WHATSAPP_NEGOCIACAO) — trocar lá quando o número
// dedicado existir; o atual vira sender do OTP. Ver memória project_cta_whatsapp_swap.
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NEGOCIACAO}`;
const WHATSAPP_CHANNEL = 'https://whatsapp.com/channel/0029Vb6Qo3fL7UVRzGS4fn3M';

interface MarketData {
  cambio: {
    usd_brl: number;
    compra: number;
    venda: number;
    variacao_percent: number;
    fonte: string;
    ultima_cotacao?: string;
  };
  bolsa: {
    // ICE só em dólar — a conversão pra R$/saca saiu da Edge Function de
    // propósito. Preço em reais é sempre o da Copa (copaPrices.service).
    cents_per_lb: number;
    variacao_percent: number;
    fonte: string;
    simbolo: string;
  };
  atualizado_em: string;
  _debug?: string[];
}

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
  const [market, setMarket] = useState<MarketData | null>(null);
  const [copaPrices, setCopaPrices] = useState<CopaCafePrice[]>([]);
  const [copaDate, setCopaDate] = useState('');
  const [copaNotes, setCopaNotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [copaLoading, setCopaLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMarket = useCallback(() => {
    return fetch(`${SUPABASE_URL}/functions/v1/coffee-prices`, {
      headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data && typeof data === 'object' && data.cambio) setMarket(data);
        else setMarket(null);
      })
      .catch(() => setMarket(null))
      .finally(() => setLoading(false));
  }, []);

  // Busca e parse vivem em src/services/copaPrices.service.ts — a tela de
  // notificações usa o mesmo feed pros alertas de preço, e dois parsers
  // separados acabariam divergindo.
  const fetchCopaCafe = useCallback(() => {
    return fetchCopaPrices()
      .then((feed) => {
        if (feed.data) setCopaDate(feed.data);
        setCopaPrices(feed.precos);
        setCopaNotes(feed.notas);
      })
      .catch(() => setCopaPrices([]))
      .finally(() => setCopaLoading(false));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setLoading(true);
    setCopaLoading(true);
    await Promise.all([fetchMarket(), fetchCopaCafe()]);
    setRefreshing(false);
  }, [fetchMarket, fetchCopaCafe]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setCopaLoading(true);
      fetchMarket();
      fetchCopaCafe();
    }, [fetchMarket, fetchCopaCafe])
  );

  if (loading && copaLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.textSecondary, marginTop: 12 }}>Buscando cotações...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
    >

      {/* ===== 1. PRECOS COPA CAFE (DESTAQUE PRINCIPAL) ===== */}
      <View style={styles.copaSection}>
        <View style={styles.copaSectionHeader}>
          <View style={styles.copaIconCircle}>
            <Feather name="coffee" size={22} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.copaSectionTitle}>Preços Copa Café</Text>
            <Text style={styles.copaSectionSubtitle}>Referência de compra — Cata 20</Text>
          </View>
          {copaDate ? (
            <View style={styles.copaDateBadge}>
              <Feather name="calendar" size={12} color={colors.primary} />
              <Text style={styles.copaDateText}>{copaDate}</Text>
            </View>
          ) : null}
        </View>

        {copaLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
        ) : copaPrices.length === 0 ? (
          <Text style={styles.copaEmpty}>Não foi possível carregar os preços</Text>
        ) : (
          <>
            {/* Cards grandes para cada tipo */}
            {copaPrices.map((item, i) => {
              const isRio = item.bebida.toLowerCase().includes('rio');
              return (
                <View key={i} style={styles.copaPriceCard}>
                  <View style={styles.copaPriceLeft}>
                    <View style={[styles.copaPriceIcon, { backgroundColor: isRio ? '#FFF3E0' : '#E8F5E9' }]}>
                      <Feather
                        name="package"
                        size={20}
                        color={isRio ? '#E65100' : colors.primary}
                      />
                    </View>
                    <View>
                      <Text style={styles.copaPriceLabel}>{item.bebida}</Text>
                      <Text style={styles.copaPriceCata}>Cata {item.cata}</Text>
                    </View>
                  </View>
                  <View style={styles.copaPriceRight}>
                    <Text style={styles.copaPriceValue}>{item.preco}</Text>
                    <Text style={styles.copaPriceUnit}>por saca 60kg</Text>
                  </View>
                </View>
              );
            })}

            {/* Notas */}
            <Text style={styles.copaPosto}>Preço posto faturado</Text>
            {copaNotes.map((note, i) => (
              <Text key={i} style={styles.copaNote}>{note}</Text>
            ))}
          </>
        )}
      </View>

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

  // ===== Copa Cafe (destaque principal) =====
  copaSection: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  copaSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  copaIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copaSectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  copaSectionSubtitle: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  copaDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  copaDateText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.primary,
  },
  copaEmpty: {
    fontSize: fontSize.sm,
    color: colors.textLight,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },

  // Cards individuais de preco Copa Cafe
  copaPriceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  copaPriceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  copaPriceIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copaPriceLabel: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
  },
  copaPriceCata: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  copaPriceRight: {
    alignItems: 'flex-end',
  },
  copaPriceValue: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: colors.primary,
  },
  copaPriceUnit: {
    fontSize: fontSize.xs,
    color: colors.textLight,
    marginTop: 1,
  },
  copaPosto: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  copaNote: {
    fontSize: fontSize.xs,
    color: colors.textLight,
    marginTop: 2,
  },

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
