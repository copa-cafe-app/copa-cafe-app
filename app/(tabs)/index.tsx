import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { colors, spacing, fontSize, borderRadius } from '../../src/constants/theme';
import { useWeatherStore } from '../../src/stores/weatherStore';
import { useAuthStore } from '../../src/stores/authStore';
import { supabase } from '../../src/services/supabase';
import { userService } from '../../src/services/user.service';
import { Propriedade } from '../../src/types/user';
import { safraAtual } from '../../src/utils/safra';
import { fetchCopaFeed, fetchMarketData } from '../../src/services/marketFeeds';
import { useCachedResource } from '../../src/hooks/useCachedResource';
import { CACHE_KEYS, readCache, writeCache } from '../../src/utils/cache';
import { OfflineNotice } from '../../src/components/prices/OfflineNotice';

function QuickActionButton({ icon, label, onPress }: { icon: string; label: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <View style={styles.quickActionIcon}>
        <Feather name={icon as any} size={22} color={colors.primary} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function InfoCard({ title, children, icon }: { title: string; children: React.ReactNode; icon: string }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Feather name={icon as any} size={18} color={colors.primaryLight} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia!';
  if (hour < 18) return 'Boa tarde!';
  return 'Boa noite!';
}

export default function HomeScreen() {
  const { weather, cityName, loading: weatherLoading, weatherOfflineAt, fetchWeather, fetchWeatherByCity, captureCoords } = useWeatherStore();
  const { profile, user } = useAuthStore();
  const [safraStats, setSafraStats] = useState({ total: 0, vendidos: 0, receita: 0 });
  // Preço Copa + bolsa/dólar com cache offline (stale-while-revalidate) — mesmas
  // chaves da aba Cotações, então o que uma tela salvou a outra já mostra.
  const copa = useCachedResource(CACHE_KEYS.copaPrices, fetchCopaFeed);
  const market = useCachedResource(CACHE_KEYS.market, fetchMarketData);
  const copaCafePrice = copa.data?.precos[0]?.preco ?? null;
  const cotacoes = useMemo(() => {
    const d = market.data;
    if (!d?.bolsa || !d?.cambio) return null;
    return {
      kcCentsLb: d.bolsa.cents_per_lb,
      kcVar: d.bolsa.variacao_percent,
      dolar: d.cambio.usd_brl,
      dolarVar: d.cambio.variacao_percent,
    };
  }, [market.data]);
  const [refreshing, setRefreshing] = useState(false);
  const [propriedades, setPropriedades] = useState<Propriedade[]>([]);
  const [selectedPropId, setSelectedPropId] = useState<string | null>(null);

  const selectedProp = useMemo(
    () => propriedades.find((p) => p.id === selectedPropId) ?? null,
    [propriedades, selectedPropId]
  );

  const uniqueMunicipios = useMemo(() => {
    return [...new Set(propriedades.map((p) => p.municipio).filter(Boolean))];
  }, [propriedades]);

  const showPropSelector = uniqueMunicipios.length >= 2;

  const fetchWeatherForProp = useCallback(
    (prop: Propriedade | null) => {
      if (prop?.municipio) {
        return fetchWeatherByCity(prop.municipio, prop.estado);
      }
      return fetchWeather(user?.id);
    },
    [fetchWeatherByCity, fetchWeather, user?.id]
  );

  const fetchCotacoes = market.refresh;
  const fetchCopaCafePrice = copa.refresh;

  const fetchSafraStats = useCallback(async () => {
    if (!user?.id) return;
    await supabase
      .from('lotes')
      .select('status, quantidade_sacas, preco_por_saca')
      .eq('produtor_id', user.id)
      .then(({ data }) => {
        if (!data) return;
        const total = data.length;
        const vendidos = data.filter((l: any) => l.status === 'VENDIDO').length;
        const receita = data
          .filter((l: any) => l.status === 'VENDIDO' && l.preco_por_saca)
          .reduce((sum: number, l: any) => sum + (l.quantidade_sacas * l.preco_por_saca), 0);
        setSafraStats({ total, vendidos, receita });
      });
  }, [user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchWeatherForProp(selectedProp),
        fetchCotacoes(),
        fetchCopaCafePrice(),
        fetchSafraStats(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchWeatherForProp, selectedProp, fetchCotacoes, fetchCopaCafePrice, fetchSafraStats]);

  useEffect(() => {
    fetchCotacoes();
    fetchCopaCafePrice();
  }, [fetchCotacoes, fetchCopaCafePrice]);

  // Depende de user?.id: se o usuário ainda não estava carregado na montagem,
  // roda de novo quando ele chega (antes ficava sem fazendas/clima da fazenda).
  useEffect(() => {
    if (!user?.id) return;

    // Solicita a localização ao usar o app e salva as coordenadas no perfil
    // (independe da fonte do clima, que segue a cidade da fazenda).
    captureCoords(user.id);

    const userId = user.id;
    const propsKey = CACHE_KEYS.propriedades(userId);
    // Fazendas também vão pro cache: sem internet o clima continua sendo o da
    // cidade da fazenda (do cache), e não cai pro GPS.
    userService.getPropriedades(userId)
      .then((props) => { writeCache(propsKey, props); return props; })
      .catch(async (err) => {
        const cached = await readCache<Propriedade[]>(propsKey);
        if (cached?.data) return cached.data;
        throw err;
      })
      .then((props) => {
      setPropriedades(props);
      if (props.length > 0) {
        setSelectedPropId(props[0].id);
        // Fetch weather by city of first property
        if (props[0].municipio) {
          fetchWeatherByCity(props[0].municipio, props[0].estado);
        } else {
          fetchWeather(userId);
        }
      } else {
        fetchWeather(userId);
      }
    }).catch(() => {
      fetchWeather(userId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchSafraStats();
    }, [fetchSafraStats])
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
    >
      {/* Header com logo */}
      <View style={styles.header}>
        <Image
          source={require('../../assets/vertical.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.greetingText}>{getGreeting()}</Text>
          <Text style={styles.greetingName}>{profile?.nome?.split(' ')[0] || 'Produtor'}</Text>
        </View>
        <TouchableOpacity style={styles.notifButton} onPress={() => router.push('/notificacoes')}>
          <Feather name="bell" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Seletor de propriedade (só aparece com 2+ municípios distintos) */}
      {showPropSelector && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.propScroll}
          contentContainerStyle={styles.propScrollContent}
        >
          {propriedades.map((prop) => {
            const isSelected = prop.id === selectedPropId;
            return (
              <TouchableOpacity
                key={prop.id}
                style={[styles.propPill, isSelected && styles.propPillSelected]}
                onPress={() => {
                  setSelectedPropId(prop.id);
                  if (prop.municipio) {
                    fetchWeatherByCity(prop.municipio, prop.estado);
                  } else {
                    fetchWeather(user?.id);
                  }
                }}
              >
                <Text style={[styles.propPillText, isSelected && styles.propPillTextSelected]}>
                  {prop.nome}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Cotação do dia */}
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push('/(tabs)/cotacoes')}
      >
        <InfoCard title="Cotação do Dia" icon="trending-up">
          {copa.offline && copa.data ? <OfflineNotice what="preços" savedAt={copa.savedAt} /> : null}
          {/* Copa Café - destaque principal */}
          <View style={styles.copaCafeMain}>
            <View style={styles.copaCafeIconCircle}>
              <Feather name="coffee" size={18} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.copaCafeLabel}>Copa Café — Cata 20</Text>
              <Text style={styles.copaCafeSubLabel}>Bebida (Duro) · Compra</Text>
            </View>
            <Text style={styles.copaCafeValue}>
              {copaCafePrice || (copa.failed ? '--' : '...')}
            </Text>
          </View>

          {/* KC e Dólar - secundário */}
          <View style={styles.cotacaoSecondaryRow}>
            <View style={styles.cotacaoSecondaryItem}>
              <Text style={styles.cotacaoSecondaryLabel}>KC=F (cts/lb)</Text>
              <Text style={styles.cotacaoSecondaryValue}>
                {cotacoes ? `${cotacoes.kcCentsLb.toFixed(2)}` : '...'}
              </Text>
              <Text style={[styles.cotacaoSecondaryChange, { color: (cotacoes?.kcVar ?? 0) >= 0 ? colors.primaryLight : colors.error }]}>
                {cotacoes ? `${cotacoes.kcVar >= 0 ? '+' : ''}${cotacoes.kcVar}%` : ''}
              </Text>
            </View>
            <View style={styles.cotacaoSecondaryDivider} />
            <View style={styles.cotacaoSecondaryItem}>
              <Text style={styles.cotacaoSecondaryLabel}>Dólar</Text>
              <Text style={styles.cotacaoSecondaryValue}>
                {cotacoes ? `R$ ${cotacoes.dolar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '...'}
              </Text>
              <Text style={[styles.cotacaoSecondaryChange, { color: (cotacoes?.dolarVar ?? 0) >= 0 ? colors.primaryLight : colors.error }]}>
                {cotacoes ? `${cotacoes.dolarVar >= 0 ? '+' : ''}${cotacoes.dolarVar}%` : ''}
              </Text>
            </View>
          </View>
        </InfoCard>
      </TouchableOpacity>

      {/* Clima */}
      <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/previsao')}>
        <InfoCard title={selectedProp?.municipio ? `Clima — ${selectedProp.municipio}` : cityName ? `Clima — ${cityName}` : 'Clima Hoje'} icon="cloud">
          {weatherLoading ? (
            <View style={styles.climaLoading}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.climaLoadingText}>Buscando clima...</Text>
            </View>
          ) : weather ? (
            <>
            {weatherOfflineAt ? <OfflineNotice what="clima" savedAt={weatherOfflineAt} /> : null}
            <View style={styles.climaRow}>
              <Text style={styles.climaTemp}>{weather.temperature}°C</Text>
              <View style={styles.climaDetails}>
                <Text style={styles.climaDetail}>Umidade: {weather.humidity}%</Text>
                <Text style={styles.climaDetail}>Chuva: {weather.rainProbability}%</Text>
                <Text style={styles.climaDetail}>Vento: {weather.windSpeed} km/h</Text>
              </View>
            </View>
            </>
          ) : (
            <TouchableOpacity onPress={() => fetchWeatherForProp(selectedProp)}>
              <Text style={styles.climaDetail}>Toque para carregar o clima</Text>
            </TouchableOpacity>
          )}
        </InfoCard>
      </TouchableOpacity>

      {/* Resumo da Safra - só exibe quando há lotes */}
      {safraStats.total > 0 && (
        <InfoCard title={`Safra ${safraAtual()}`} icon="bar-chart-2">
          <View style={styles.safraGrid}>
            <View style={styles.safraItem}>
              <Text style={styles.safraNumber}>{safraStats.total}</Text>
              <Text style={styles.safraLabel}>Lotes</Text>
            </View>
            <View style={styles.safraItem}>
              <Text style={styles.safraNumber}>{safraStats.vendidos}</Text>
              <Text style={styles.safraLabel}>Vendidos</Text>
            </View>
            <View style={styles.safraItem}>
              <Text style={styles.safraNumber}>
                {safraStats.receita > 0 ? `R$ ${(safraStats.receita / 1000).toFixed(0)}k` : 'R$ 0'}
              </Text>
              <Text style={styles.safraLabel}>Receita</Text>
            </View>
          </View>
        </InfoCard>
      )}

      {/* Atalhos Rápidos */}
      <Text style={styles.sectionTitle}>Atalhos Rápidos</Text>
      <View style={styles.quickActions}>
        <QuickActionButton icon="plus-circle" label="Novo Lote" onPress={() => router.push('/novo-lote')} />
        <QuickActionButton icon="edit-3" label="Atividade" onPress={() => router.push('/diario')} />
        <QuickActionButton icon="camera" label="Saúde da Planta" onPress={() => router.push('/analise-planta')} />
        {/* Marketplace escondido até ter pagamento real — reativar com QuickActionButton "Insumos" → /marketplace */}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingTop: spacing.md,
  },
  headerLogo: {
    width: 56,
    height: 56,
    marginRight: spacing.md,
    borderRadius: borderRadius.md,
  },
  greetingText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  greetingName: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
  },
  notifButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginLeft: spacing.sm,
  },
  // Copa Café destaque principal
  copaCafeMain: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  copaCafeIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copaCafeLabel: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.text,
  },
  copaCafeSubLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 1,
  },
  copaCafeValue: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    color: colors.primary,
  },
  // KC e Dólar secundário
  cotacaoSecondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cotacaoSecondaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  cotacaoSecondaryLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  cotacaoSecondaryValue: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
  },
  cotacaoSecondaryChange: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    marginTop: 2,
  },
  cotacaoSecondaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  climaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  climaTemp: {
    fontSize: 42,
    fontWeight: '700',
    color: colors.primary,
    marginRight: spacing.lg,
  },
  climaDetails: {
    flex: 1,
  },
  climaDetail: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  climaLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  climaLoadingText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  safraGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  safraItem: {
    alignItems: 'center',
  },
  safraNumber: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.primary,
  },
  safraLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAction: {
    alignItems: 'center',
    width: 76,
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  quickActionLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  propScroll: {
    marginBottom: spacing.md,
  },
  propScrollContent: {
    gap: spacing.sm,
  },
  propPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full ?? 999,
    backgroundColor: colors.surfaceVariant,
  },
  propPillSelected: {
    backgroundColor: colors.primary,
  },
  propPillText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  propPillTextSelected: {
    color: colors.white,
  },
});
