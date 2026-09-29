import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { useAuthStore } from '../src/stores/authStore';

function ReadOnlyField({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.readonlyBox}>
        <Text style={styles.readonlyValue}>{value || '—'}</Text>
        <Feather name="lock" size={16} color={colors.textLight} />
      </View>
    </View>
  );
}

export default function DadosPessoaisScreen() {
  const { profile } = useAuthStore();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Voltar">
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dados Pessoais</Text>
        <View style={{ width: 40 }} />
      </View>

      <ReadOnlyField label="Nome completo" value={profile?.nome} />
      <ReadOnlyField label="CPF / CNPJ" value={profile?.cpf_cnpj} />
      <ReadOnlyField label="Telefone" value={profile?.telefone} />
      <ReadOnlyField label="Estado" value={profile?.estado} />
      <ReadOnlyField label="Município" value={profile?.municipio} />

      <View style={styles.note}>
        <Feather name="info" size={16} color={colors.textSecondary} />
        <Text style={styles.noteText}>
          Esses dados não podem ser alterados por aqui. Para corrigir alguma informação, fale com o suporte em Perfil → Fale Conosco.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 72, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  field: { marginBottom: spacing.md },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  readonlyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  readonlyValue: { fontSize: fontSize.md, color: colors.textSecondary, flex: 1 },
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  noteText: { flex: 1, fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
});
