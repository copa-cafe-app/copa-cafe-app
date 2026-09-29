import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../../constants/theme';
import { formatCacheStamp } from '../../utils/cache';

/** Aviso discreto: "Sem conexão — mostrando preços de 29/09 às 14:32". */
export function OfflineNotice({ what, savedAt }: { what: string; savedAt: number | null }) {
  if (!savedAt) return null;
  return (
    <View style={styles.box}>
      <Feather name="wifi-off" size={14} color={colors.textSecondary} />
      <Text style={styles.text}>
        Sem conexão — mostrando {what} de {formatCacheStamp(savedAt)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FFF8E1',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginBottom: spacing.sm,
  },
  text: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
});
