import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Modal, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, spacing, fontSize, borderRadius } from '../../../src/constants/theme';
import { useCadastroStore } from '../../../src/stores/cadastroStore';
import { useAuthStore } from '../../../src/stores/authStore';
import WizardProgress from '../../../src/components/auth/WizardProgress';
import { useState } from 'react';
import { translateAuthError } from '../../../src/utils/authErrors';
import { COUNTRY_CODES, DEFAULT_COUNTRY, type CountryCode } from '../../../src/constants/countryCodes';

export default function CadastroStep1() {
  const { email, senha, telefone, setField } = useCadastroStore();
  const { signUp } = useAuthStore();
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [country, setCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  function validate() {
    const errs: Record<string, string> = {};
    if (!email.includes('@')) errs.email = 'Email inválido';
    if (senha.length < 8) errs.senha = 'Mínimo 8 caracteres';
    if (!/[A-Z]/.test(senha)) errs.senha = 'Precisa ter 1 letra maiúscula';
    if (!/[0-9]/.test(senha)) errs.senha = 'Precisa ter 1 número';
    if (senha !== confirmarSenha) errs.confirmarSenha = 'Senhas não conferem';
    if (telefone.replace(/\D/g, '').length < 10) errs.telefone = 'Telefone inválido';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleNext() {
    if (!validate()) return;
    setLoading(true);
    try {
      // signUp — se user já existe, ignora e segue
      try {
        await signUp(email, senha);
      } catch (signUpErr: any) {
        const msg = signUpErr?.message?.toLowerCase() || '';
        if (!msg.includes('already registered') && !msg.includes('already been registered')) {
          throw signUpErr;
        }
      }
      // Save country dial and send OTP
      setField('countryDial', country.dial);
      const { sendOtp } = useAuthStore.getState();
      const e164Phone = '+' + country.dial + telefone.replace(/\D/g, '');
      await sendOtp(e164Phone, 'sms');
      router.push('/(auth)/cadastro/verificacao');
    } catch (err: any) {
      setErrors({ email: translateAuthError(err.message) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <WizardProgress current={1} />

      <Text style={styles.title}>Crie sua conta</Text>
      <Text style={styles.subtitle}>Comece com seus dados de acesso</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Email</Text>
        <View style={[styles.inputWrapper, errors.email && styles.inputError]}>
          <Feather name="mail" size={18} color={colors.textLight} />
          <TextInput
            style={styles.input}
            placeholder="seu@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={(v) => setField('email', v)}
            placeholderTextColor={colors.textLight}
          />
        </View>
        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Senha</Text>
        <View style={[styles.inputWrapper, errors.senha && styles.inputError]}>
          <Feather name="lock" size={18} color={colors.textLight} />
          <TextInput
            style={styles.input}
            placeholder="Mínimo 8 caracteres"
            secureTextEntry={!showPassword}
            value={senha}
            onChangeText={(v) => setField('senha', v)}
            placeholderTextColor={colors.textLight}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color={colors.textLight} />
          </TouchableOpacity>
        </View>
        {errors.senha && <Text style={styles.errorText}>{errors.senha}</Text>}
        <Text style={styles.hint}>1 maiúscula, 1 número, mín. 8 caracteres</Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Confirmar senha</Text>
        <View style={[styles.inputWrapper, errors.confirmarSenha && styles.inputError]}>
          <Feather name="lock" size={18} color={colors.textLight} />
          <TextInput
            style={styles.input}
            placeholder="Repita a senha"
            secureTextEntry={!showPassword}
            value={confirmarSenha}
            onChangeText={setConfirmarSenha}
            placeholderTextColor={colors.textLight}
          />
        </View>
        {errors.confirmarSenha && <Text style={styles.errorText}>{errors.confirmarSenha}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Telefone</Text>
        <View style={[styles.inputWrapper, errors.telefone && styles.inputError]}>
          <TouchableOpacity style={styles.countrySelector} onPress={() => setShowCountryPicker(true)}>
            <Text style={styles.countryFlag}>{country.flag}</Text>
            <Text style={styles.countryDial}>+{country.dial}</Text>
            <Feather name="chevron-down" size={14} color={colors.textLight} />
          </TouchableOpacity>
          <View style={styles.dividerLine} />
          <TextInput
            style={styles.input}
            placeholder="Seu número"
            keyboardType="phone-pad"
            value={telefone}
            onChangeText={(v) => setField('telefone', v.replace(/[^0-9]/g, ''))}
            placeholderTextColor={colors.textLight}
            maxLength={15}
          />
        </View>
        {errors.telefone && <Text style={styles.errorText}>{errors.telefone}</Text>}
      </View>

      <Modal visible={showCountryPicker} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCountryPicker(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Selecionar país</Text>
            <FlatList
              data={COUNTRY_CODES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.countryItem, item.code === country.code && styles.countryItemActive]}
                  onPress={() => { setCountry(item); setShowCountryPicker(false); }}
                >
                  <Text style={styles.countryItemFlag}>{item.flag}</Text>
                  <Text style={styles.countryItemName}>{item.name}</Text>
                  <Text style={styles.countryItemDialCode}>+{item.dial}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
        <Text style={styles.nextButtonText}>Continuar</Text>
        <Feather name="arrow-right" size={20} color={colors.white} />
      </TouchableOpacity>

      <View style={styles.loginRow}>
        <Text style={styles.loginText}>Já tem conta? </Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.loginLink}>Faça login</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: spacing.xl },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  subtitle: { fontSize: fontSize.md, color: colors.textSecondary, marginBottom: spacing.xl },
  inputGroup: { marginBottom: spacing.md },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 50,
    gap: spacing.sm,
  },
  inputError: { borderColor: colors.error },
  input: { flex: 1, fontSize: fontSize.md, color: colors.text },
  countrySelector: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  countryFlag: { fontSize: 20 },
  countryDial: { fontSize: fontSize.md, fontWeight: '600', color: colors.text, marginRight: 4 },
  dividerLine: { width: 1, height: 24, backgroundColor: colors.border },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.lg, borderTopRightRadius: borderRadius.lg, padding: spacing.lg, maxHeight: '60%' },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.md, textAlign: 'center' },
  countryItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: borderRadius.sm },
  countryItemActive: { backgroundColor: colors.surfaceVariant },
  countryItemFlag: { fontSize: 22, marginRight: spacing.md },
  countryItemName: { flex: 1, fontSize: fontSize.md, color: colors.text },
  countryItemDialCode: { fontSize: fontSize.md, color: colors.textSecondary, fontWeight: '600' },
  hint: { fontSize: fontSize.xs, color: colors.textLight, marginTop: 4 },
  errorText: { fontSize: fontSize.xs, color: colors.error, marginTop: 4 },
  nextButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  nextButtonText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  loginText: { fontSize: fontSize.sm, color: colors.textSecondary },
  loginLink: { fontSize: fontSize.sm, fontWeight: '700', color: colors.primary },
});
