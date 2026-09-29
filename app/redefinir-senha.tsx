import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useState } from 'react';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { authService } from '../src/services/auth.service';
import { useAuthStore } from '../src/stores/authStore';
import { validatePassword } from '../src/utils/validators';

export default function RedefinirSenhaScreen() {
  const insets = useSafeAreaInsets();
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleReset() {
    const senhaCheck = validatePassword(novaSenha);
    if (!senhaCheck.valid) {
      setError(senhaCheck.message!);
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setError('As senhas não coincidem');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await authService.updatePassword(novaSenha);
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Erro ao redefinir senha');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <View style={[styles.iconCircle, { backgroundColor: '#E8F5E9' }]}>
            <Feather name="check-circle" size={32} color={colors.success} />
          </View>
        </View>
        <Text style={styles.title}>Senha redefinida!</Text>
        <Text style={styles.subtitle}>Sua nova senha foi salva. Faça login com ela para continuar.</Text>
        <TouchableOpacity style={styles.button} onPress={async () => { await useAuthStore.getState().signOut(); router.replace('/(auth)/login'); }}>
          <Text style={styles.buttonText}>Ir para o login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.lg, paddingBottom: spacing.lg + insets.bottom }} keyboardShouldPersistTaps="handled">
      <View style={styles.iconContainer}>
        <View style={styles.iconCircle}>
          <Feather name="lock" size={32} color={colors.primary} />
        </View>
      </View>

      <Text style={styles.title}>Nova senha</Text>
      <Text style={styles.subtitle}>Escolha uma nova senha para sua conta</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Nova senha</Text>
        <View style={[styles.inputWrapper, error && styles.inputError]}>
          <Feather name="lock" size={18} color={colors.textLight} />
          <TextInput
            style={styles.input}
            placeholder="Mínimo 6 caracteres"
            secureTextEntry={!showSenha}
            value={novaSenha}
            onChangeText={(v) => { setNovaSenha(v); setError(''); }}
            placeholderTextColor={colors.textLight}
          />
          <TouchableOpacity onPress={() => setShowSenha(!showSenha)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={showSenha ? 'Ocultar senha' : 'Mostrar senha'}>
            <Feather name={showSenha ? 'eye-off' : 'eye'} size={18} color={colors.textLight} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Confirmar senha</Text>
        <View style={[styles.inputWrapper, error && styles.inputError]}>
          <Feather name="lock" size={18} color={colors.textLight} />
          <TextInput
            style={styles.input}
            placeholder="Repita a senha"
            secureTextEntry={!showSenha}
            value={confirmarSenha}
            onChangeText={(v) => { setConfirmarSenha(v); setError(''); }}
            placeholderTextColor={colors.textLight}
          />
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={handleReset}
        disabled={loading}
      >
        <Text style={styles.buttonText}>{loading ? 'Salvando...' : 'Redefinir senha'}</Text>
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  iconContainer: { alignItems: 'center', marginBottom: spacing.lg },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
  subtitle: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 22 },
  inputGroup: { marginBottom: spacing.md },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, height: 50, gap: spacing.sm,
  },
  inputError: { borderColor: colors.error },
  input: { flex: 1, fontSize: fontSize.md, color: colors.text },
  errorText: { fontSize: fontSize.xs, color: colors.error, marginTop: 4 },
  button: {
    backgroundColor: colors.primary, height: 52, borderRadius: borderRadius.md,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.md,
  },
  buttonText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
});
