import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../../constants/theme';

const steps = ['Conta', 'Verificação', 'Perfil', 'Fazenda', 'Termos'];

export default function WizardProgress({ current }: { current: number }) {
  return (
    <View style={styles.container}>
      <View style={styles.barBackground}>
        <View style={[styles.barFill, { width: `${(current / steps.length) * 100}%` }]} />
      </View>
      <Text style={styles.label}>
        Etapa {current} de {steps.length} — {steps[current - 1]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  barBackground: {
    height: 4,
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  label: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
