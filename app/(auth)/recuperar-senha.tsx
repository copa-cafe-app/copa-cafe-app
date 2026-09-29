import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Modal, FlatList } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, fontSize, borderRadius } from '../../src/constants/theme';
import { useAuthStore } from '../../src/stores/authStore';
import { useState } from 'react';
import { translateAuthError } from '../../src/utils/authErrors';
import { validateEmail } from '../../src/utils/validators';
import { COUNTRY_CODES, DEFAULT_COUNTRY, type CountryCode } from '../../src/constants/countryCodes';

type Mode = 'email' | 'sms';

export default function RecuperarSenhaScreen() {
  const [mode, setMode] = useState<Mode>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { resetPassword, sendOtp, verifyOtp } = useAuthStore();
  const insets = useSafeAreaInsets();

  function getE164Phone() {
    return '+' + country.dial + phone.replace(/\D/g, '');
  }

  async function handleSendEmail() {
    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      setError(emailCheck.message!);
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(translateAuthError(err.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleSendSms() {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 8) {
      setError('Telefone inválido');
      return;
    }
    setLoading(true);
    try {
      await sendOtp(getE164Phone(), 'sms');
      setCodeSent(true);
    } catch (err: any) {
      setError(translateAuthError(err.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode() {
    if (code.length < 4) {
      setError('Código inválido');
      return;
    }
    setLoading(true);
    try {
      await verifyOtp(getE164Phone(), code);
      // Logado via OTP — redirecionar pra redefinir senha
      router.replace('/redefinir-senha');
    } catch (err: any) {
      setError(translateAuthError(err.message));
    } finally {
      setLoading(false);
    }
  }

  // Tela de sucesso (email enviado)
  if (sent) {
    return (
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <View style={[styles.iconCircle, { backgroundColor: '#E8F5E9' }]}>
            <Feather name="mail" size={32} color={colors.primary} />
          </View>
        </View>
        <Text style={styles.title}>Email enviado!</Text>
        <Text style={styles.subtitle}>
          Enviamos um link de recuperação para{'\n'}
          <Text style={{ fontWeight: '600', color: colors.text }}>{email}</Text>
        </Text>
        <Text style={styles.hint}>Verifique sua caixa de entrada e spam</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Voltar ao login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Tela de código SMS enviado
  if (codeSent) {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.lg, paddingBottom: spacing.lg + insets.bottom }} keyboardShouldPersistTaps="handled">
        <View style={styles.iconContainer}>
          <View style={[styles.iconCircle, { backgroundColor: '#E8F5E9' }]}>
            <Feather name="smartphone" size={32} color={colors.primary} />
          </View>
        </View>
        <Text style={styles.title}>Código enviado!</Text>
        <Text style={styles.subtitle}>
          Digite o código que enviamos para{'\n'}
          <Text style={{ fontWeight: '600', color: colors.text }}>+{country.dial} {phone}</Text>
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Código</Text>
          <View style={[styles.inputWrapper, error && styles.inputError]}>
            <Feather name="hash" size={18} color={colors.textLight} />
            <TextInput
              style={styles.input}
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={(v) => { setCode(v); setError(''); }}
              placeholderTextColor={colors.textLight}
            />
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        <TouchableOpacity
          style={[styles.button, loading && { opacity: 0.7 }]}
          onPress={handleVerifyCode}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Verificando...' : 'Verificar código'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backLink} onPress={() => { setCodeSent(false); setError(''); }}>
          <Feather name="arrow-left" size={16} color={colors.primary} />
          <Text style={styles.backText}>Reenviar código</Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.lg, paddingBottom: spacing.lg + insets.bottom }} keyboardShouldPersistTaps="handled">
      <View style={styles.iconContainer}>
        <View style={styles.iconCircle}>
          <Feather name="key" size={32} color={colors.primary} />
        </View>
      </View>

      <Text style={styles.title}>Recuperar senha</Text>
      <Text style={styles.subtitle}>Escolha como deseja recuperar sua senha</Text>

      {/* Toggle Email / SMS */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'email' && styles.toggleActive]}
          onPress={() => { setMode('email'); setError(''); }}
        >
          <Feather name="mail" size={16} color={mode === 'email' ? colors.white : colors.primary} />
          <Text style={[styles.toggleText, mode === 'email' && styles.toggleTextActive]}>Email</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, mode === 'sms' && styles.toggleActive]}
          onPress={() => { setMode('sms'); setError(''); }}
        >
          <Feather name="smartphone" size={16} color={mode === 'sms' ? colors.white : colors.primary} />
          <Text style={[styles.toggleText, mode === 'sms' && styles.toggleTextActive]}>SMS</Text>
        </TouchableOpacity>
      </View>

      {mode === 'email' ? (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <View style={[styles.inputWrapper, error && styles.inputError]}>
            <Feather name="mail" size={18} color={colors.textLight} />
            <TextInput
              style={styles.input}
              placeholder="seu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={(v) => { setEmail(v); setError(''); }}
              placeholderTextColor={colors.textLight}
            />
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      ) : (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Telefone</Text>
          <View style={[styles.inputWrapper, error && styles.inputError]}>
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
              value={phone}
              onChangeText={(v) => { setPhone(v.replace(/[^0-9]/g, '')); setError(''); }}
              placeholderTextColor={colors.textLight}
              maxLength={15}
            />
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      )}

      <Modal visible={showCountryPicker} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCountryPicker(false)}>
          <View style={[styles.modalContent, { paddingBottom: spacing.lg + insets.bottom }]}>
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
                  <Text style={styles.countryItemDial}>+{item.dial}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={mode === 'email' ? handleSendEmail : handleSendSms}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Enviando...' : mode === 'email' ? 'Enviar link' : 'Enviar código SMS'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
        <Feather name="arrow-left" size={16} color={colors.primary} />
        <Text style={styles.backText}>Voltar ao login</Text>
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
  hint: { fontSize: fontSize.sm, color: colors.textLight, textAlign: 'center', marginBottom: spacing.xl },
  toggleRow: {
    flexDirection: 'row', gap: spacing.sm,
    marginBottom: spacing.xl, alignSelf: 'center',
  },
  toggleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full || 24, borderWidth: 1.5,
    borderColor: colors.primary, backgroundColor: 'transparent',
  },
  toggleActive: { backgroundColor: colors.primary },
  toggleText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.primary },
  toggleTextActive: { color: colors.white },
  inputGroup: { marginBottom: spacing.lg },
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
  countryItemDial: { fontSize: fontSize.md, color: colors.textSecondary, fontWeight: '600' },
  button: {
    backgroundColor: colors.primary, height: 52, borderRadius: borderRadius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  buttonText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
  backLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl, gap: spacing.xs },
  backText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
});
