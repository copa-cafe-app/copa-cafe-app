import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, spacing, fontSize, borderRadius } from '../../../src/constants/theme';

export default function CadastroConcluido() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Feather name="check" size={48} color={colors.white} />
        </View>

        <Text style={styles.title}>Cadastro conclu{'\u00ed'}do!</Text>

        <Text style={styles.message}>
          Sua conta foi criada com sucesso. Agora voc{'\u00ea'} pode gerenciar sua produ{'\u00e7'}{'\u00e3'}o de caf{'\u00e9'} de forma simples e eficiente.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.replace('/(tabs)')}
      >
        <Text style={styles.buttonText}>Come{'\u00e7'}ar</Text>
        <Feather name="arrow-right" size={20} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  message: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.lg,
  },
  button: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  buttonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
});
