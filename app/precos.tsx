// Tela PÚBLICA (sem login): tabela de preços da Copa do dia. Existe pra reduzir
// abandono no cadastro — o produtor vê o valor do app antes de criar conta.
// Liberada no AuthGuard (app/_layout.tsx). Usa o mesmo cache offline das
// telas logadas, então funciona sem internet se já abriu alguma vez.

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { useAuthStore } from '../src/stores/authStore';
import { useCachedResource } from '../src/hooks/useCachedResource';
import { fetchCopaFeed } from '../src/services/marketFeeds';
import { CACHE_KEYS } from '../src/utils/cache';
import { CopaPriceTable } from '../src/components/prices/CopaPriceTable';

export default function PrecosPublicScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const copa = useCachedResource(CACHE_KEYS.copaPrices, fetchCopaFeed);
  const refreshCopa = copa.refresh;
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    refreshCopa();
  }, [refreshCopa]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshCopa();
    } finally {
      setRefreshing(false);
    }
  }, [refreshCopa]);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace(user ? '/(tabs)' : '/(auth)/login');
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn} accessibilityLabel="Voltar">
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Preço do café hoje</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        <CopaPriceTable
          feed={copa.data}
          loading={copa.loading}
          offline={copa.offline}
          savedAt={copa.savedAt}
          onRetry={refreshCopa}
        />

        {!user && (
          <View style={styles.ctaBox}>
            <Text style={styles.ctaTitle}>Crie sua conta grátis</Text>
            <Text style={styles.ctaText}>
              Com a conta você recebe alertas de preço, controla os custos da lavoura e anota o diário da fazenda.
            </Text>
            <TouchableOpacity style={styles.ctaButton} onPress={() => router.push('/(auth)/cadastro')}>
              <Text style={styles.ctaButtonText}>Criar conta grátis</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.loginLink} onPress={goBack}>
              <Text style={styles.loginLinkText}>Já tenho conta — Entrar</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  content: { padding: spacing.md },
  ctaBox: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ctaTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  ctaText: { fontSize: fontSize.md, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.md },
  ctaButton: {
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
  loginLink: { alignItems: 'center', paddingVertical: spacing.md },
  loginLinkText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.primary },
});
