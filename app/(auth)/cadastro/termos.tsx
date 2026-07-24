import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, fontSize, borderRadius } from '../../../src/constants/theme';
import { useCadastroStore } from '../../../src/stores/cadastroStore';
import { useAuthStore } from '../../../src/stores/authStore';
import { userService } from '../../../src/services/user.service';
import WizardProgress from '../../../src/components/auth/WizardProgress';
import { useState } from 'react';
import { translateAuthError } from '../../../src/utils/authErrors';
import { parseBRL } from '../../../src/utils/format';

function CheckItem({ checked, label, onPress, required }: { checked: boolean; label: string; onPress: () => void; required?: boolean }) {
  return (
    <TouchableOpacity style={styles.checkItem} onPress={onPress}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Feather name="check" size={16} color={colors.white} />}
      </View>
      <Text style={styles.checkLabel}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
    </TouchableOpacity>
  );
}

export default function CadastroStep5() {
  const { aceitouTermos, aceitouPrivacidade, setField, reset,
    nome, cpfCnpj, email, telefone, estado, municipio,
    nomeFazenda, areaHectares, altitudeMetros, regiaoCafeeira,
  } = useCadastroStore();
  const { user, loadProfile } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canFinish = aceitouTermos && aceitouPrivacidade;

  async function handleFinish() {
    if (!canFinish || !user) return;
    setLoading(true);
    setError('');
    try {
      // Check duplicates before creating
      const phoneE164 = '+' + (useCadastroStore.getState().countryDial || '55') + telefone.replace(/\D/g, '');
      const duplicate = await userService.checkDuplicate({ cpfCnpj, telefone: phoneE164 });
      if (duplicate) {
        setError(duplicate.message);
        setLoading(false);
        return;
      }

      // Create user profile
      await userService.createProfile({
        id: user.id,
        nome,
        cpf_cnpj: cpfCnpj.replace(/\D/g, ''),
        email,
        telefone: phoneE164,
        estado,
        municipio,
      });

      // Create farm
      await userService.createPropriedade({
        produtor_id: user.id,
        nome: nomeFazenda,
        area_total_hectares: parseBRL(areaHectares) ?? 0,
        altitude_metros: parseBRL(altitudeMetros) ?? undefined,
        regiao_cafeeira: regiaoCafeeira || undefined,
        municipio: municipio || undefined,
        estado: estado || undefined,
      });

      // Record LGPD consent
      await userService.recordConsent(user.id, 'TERMOS_USO');
      await userService.recordConsent(user.id, 'PRIVACIDADE');

      // Load profile into authStore so AuthGuard sees it
      await loadProfile();

      reset();
      router.replace('/(auth)/cadastro/concluido');
    } catch (err: any) {
      setError(translateAuthError(err.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.lg + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
    >
      <WizardProgress current={5} />

      <View style={styles.iconContainer}>
        <View style={styles.iconCircle}>
          <Feather name="shield" size={32} color={colors.primary} />
        </View>
      </View>

      <Text style={styles.title}>Termos e Privacidade</Text>
      <Text style={styles.subtitle}>
        Para finalizar seu cadastro, leia e aceite nossos termos
      </Text>

      {/* Termos de Uso */}
      <View style={styles.docCard}>
        <View style={styles.docHeader}>
          <Feather name="file-text" size={20} color={colors.primary} />
          <Text style={styles.docTitle}>Termos de Uso</Text>
        </View>
        <ScrollView style={styles.docContent} nestedScrollEnabled>
          <Text style={styles.docText}>
            Ao utilizar o Copa Café, você concorda com as seguintes condições:{'\n\n'}
            1. O Copa Café é uma plataforma de gestão para produtores de café.{'\n\n'}
            2. Você é responsável pela veracidade das informações cadastradas.{'\n\n'}
            3. Os dados de cotação são informativos e podem ter atraso.{'\n\n'}
            4. O Copa Café não se responsabiliza por decisões comerciais baseadas nas informações do app.{'\n\n'}
            5. Reservamo-nos o direito de suspender contas que violem os termos.
          </Text>
        </ScrollView>
      </View>

      <CheckItem
        checked={aceitouTermos}
        label="Li e aceito os Termos de Uso"
        onPress={() => setField('aceitouTermos', !aceitouTermos)}
        required
      />

      <CheckItem
        checked={aceitouPrivacidade}
        label="Li e aceito a Política de Privacidade (LGPD)"
        onPress={() => setField('aceitouPrivacidade', !aceitouPrivacidade)}
        required
      />

      {error ? (
        <View style={styles.errorBanner}>
          <Feather name="alert-circle" size={16} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.finishButton, (!canFinish || loading) && styles.finishButtonDisabled]}
        onPress={handleFinish}
        disabled={!canFinish || loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <>
            <Text style={styles.finishButtonText}>Criar minha conta</Text>
            <Feather name="check-circle" size={20} color={colors.white} />
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: spacing.xl },
  iconContainer: { alignItems: 'center', marginBottom: spacing.lg },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
  subtitle: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  docCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  docHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  docTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  docContent: { maxHeight: 150, padding: spacing.md },
  docText: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkLabel: { flex: 1, fontSize: fontSize.sm, color: colors.text },
  required: { color: colors.error },
  finishButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  finishButtonDisabled: { opacity: 0.5 },
  finishButtonText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  errorText: { fontSize: fontSize.sm, color: colors.error, flex: 1 },
});
