// Tabela de preços da Copa (cartão verde de destaque). Usada na aba Cotações e
// na tela pública /precos (antes do cadastro) — mesmo visual nas duas.

import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../../constants/theme';
import type { CopaCafeFeed } from '../../services/copaPrices.service';
import { OfflineNotice } from './OfflineNotice';

interface Props {
  feed: CopaCafeFeed | null;
  loading: boolean;
  offline: boolean;
  savedAt: number | null;
  onRetry?: () => void;
}

export function CopaPriceTable({ feed, loading, offline, savedAt, onRetry }: Props) {
  const precos = feed?.precos ?? [];
  return (
    <View style={styles.copaSection}>
      <View style={styles.copaSectionHeader}>
        <View style={styles.copaIconCircle}>
          <Feather name="coffee" size={22} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.copaSectionTitle}>Preços Copa Café</Text>
          <Text style={styles.copaSectionSubtitle}>Referência de compra — Cata 20</Text>
        </View>
        {feed?.data ? (
          <View style={styles.copaDateBadge}>
            <Feather name="calendar" size={12} color={colors.primary} />
            <Text style={styles.copaDateText}>{feed.data}</Text>
          </View>
        ) : null}
      </View>

      {offline && precos.length > 0 ? <OfflineNotice what="preços" savedAt={savedAt} /> : null}

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
      ) : precos.length === 0 ? (
        <TouchableOpacity onPress={onRetry} disabled={!onRetry}>
          <Text style={styles.copaEmpty}>
            Não foi possível carregar os preços.{onRetry ? '\nToque para tentar de novo.' : ''}
          </Text>
        </TouchableOpacity>
      ) : (
        <>
          {precos.map((item, i) => {
            const isRio = item.bebida.toLowerCase().includes('rio');
            return (
              <View key={i} style={styles.copaPriceCard}>
                <View style={styles.copaPriceLeft}>
                  <View style={[styles.copaPriceIcon, { backgroundColor: isRio ? '#FFF3E0' : '#E8F5E9' }]}>
                    <Feather name="package" size={20} color={isRio ? '#E65100' : colors.primary} />
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

          <Text style={styles.copaPosto}>Preço posto faturado</Text>
          {(feed?.notas ?? []).map((note, i) => (
            <Text key={i} style={styles.copaNote}>{note}</Text>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  copaSectionTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  copaSectionSubtitle: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 1 },
  copaDateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  copaDateText: { fontSize: fontSize.xs, fontWeight: '600', color: colors.primary },
  copaEmpty: {
    fontSize: fontSize.sm,
    color: colors.textLight,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  copaPriceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  copaPriceLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  copaPriceIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copaPriceLabel: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  copaPriceCata: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 1 },
  copaPriceRight: { alignItems: 'flex-end' },
  copaPriceValue: { fontSize: fontSize.xl, fontWeight: '800', color: colors.primary },
  copaPriceUnit: { fontSize: fontSize.xs, color: colors.textLight, marginTop: 1 },
  copaPosto: { fontSize: fontSize.xs, color: colors.textSecondary, fontStyle: 'italic', marginTop: spacing.sm },
  copaNote: { fontSize: fontSize.xs, color: colors.textLight, marginTop: 2 },
});
