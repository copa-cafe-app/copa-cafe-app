import { View, Text, StyleSheet, TextInput, TouchableOpacity, Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, FlatList, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, spacing, fontSize, borderRadius } from '../../src/constants/theme';
import { useAuthStore } from '../../src/stores/authStore';
import { useState, useRef } from 'react';
import { translateAuthError } from '../../src/utils/authErrors';
import { COUNTRY_CODES, DEFAULT_COUNTRY, type CountryCode } from '../../src/constants/countryCodes';
import type { OtpChannel } from '../../src/services/auth.service';

type Step = 'phone' | 'otp';

export default function OtpLoginScreen() {
  const [step, setStep] = useState<Step>('phone');
  const [telefone, setTelefone] = useState('');
  const [country, setCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  // WhatsApp temporariamente desativado (aguardando aprovação Meta/Twilio) — SMS only
  const channel: OtpChannel = 'sms';
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);
  const { sendOtp, verifyOtp } = useAuthStore();

  function getE164Phone() {
    return '+' + country.dial + telefone.replace(/\D/g, '');
  }

  async function handleSendOtp() {
    const digits = telefone.replace(/\D/g, '');
    if (digits.length < 7) {
      setError('Telefone inválido');
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    setError('');
    try {
      await sendOtp(getE164Phone(), channel);
      setStep('otp');
    } catch (err: any) {
      setError(translateAuthError(err.message));
    } finally {
      setLoading(false);
    }
  }

  function handleDigit(text: string, index: number) {
    const digits = text.replace(/\D/g, '');
    const newCode = [...code];
    setError('');

    if (digits.length > 1) {
      // Paste: distribute digits starting from current index
      for (let i = 0; i < digits.length && index + i < 6; i++) {
        newCode[index + i] = digits[i];
      }
      setCode(newCode);
      const nextIndex = Math.min(index + digits.length, 5);
      inputs.current[nextIndex]?.focus();
    } else {
      newCode[index] = digits;
      setCode(newCode);
      if (digits && index < 5) {
        inputs.current[index + 1]?.focus();
      }
    }
  }

  function handleKeyPress(key: string, index: number) {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  async function handleVerify() {
    const fullCode = code.join('');
    if (fullCode.length < 6) {
      setError('Digite o código completo');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await verifyOtp(getE164Phone(), fullCode);
      if (result?.is_new_user) {
        router.replace('/(auth)/cadastro/perfil');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      setError(translateAuthError(err.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setLoading(true);
    setError('');
    try {
      await sendOtp(getE164Phone(), channel);
    } catch (err: any) {
      setError(translateAuthError(err.message));
    } finally {
      setLoading(false);
    }
  }

  // ====== TELA OTP ======
  if (step === 'otp') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.lg }} keyboardShouldPersistTaps="handled">
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Feather name="smartphone" size={32} color={colors.primary} />
          </View>
        </View>

        <Text style={styles.title}>Código de verificação</Text>
        <Text style={styles.subtitle}>
          Enviamos um código via SMS para{'\n'}
          <Text style={styles.phone}>+{country.dial} {telefone}</Text>
        </Text>

        <View style={styles.codeRow}>
          {code.map((digit, i) => (
            <TextInput
              key={i}
              ref={(ref) => { inputs.current[i] = ref; }}
              style={[styles.codeInput, digit && styles.codeInputFilled, error && styles.codeInputError]}
              value={digit}
              onChangeText={(text) => handleDigit(text, i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              keyboardType="number-pad"
              maxLength={6}
              textAlign="center"
            />
          ))}
        </View>
        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, loading && { opacity: 0.7 }]}
          onPress={handleVerify}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Verificar</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.resendBtn} onPress={handleResend} disabled={loading}>
          <Text style={styles.resendText}>Reenviar código via SMS</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkRow} onPress={() => { setStep('phone'); setCode(['', '', '', '', '', '']); setError(''); }}>
          <Feather name="arrow-left" size={16} color={colors.primary} />
          <Text style={styles.linkText}>Alterar número</Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ====== TELA TELEFONE + SELEÇÃO DE CANAL ======
  return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.lg }} keyboardShouldPersistTaps="handled">
        <View style={styles.iconContainer}>
          <View style={styles.iconCircle}>
            <Feather name="smartphone" size={32} color={colors.primary} />
          </View>
        </View>

        <Text style={styles.title}>Entrar com código</Text>
        <Text style={styles.subtitle}>Digite seu número e enviaremos um código por SMS</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Telefone</Text>
          <View style={[styles.inputWrapper, error && styles.inputError]}>
            <TouchableOpacity style={styles.countrySelector} onPress={() => setShowCountryPicker(true)}>
              <Text style={styles.countryFlag}>{country.flag}</Text>
              <Text style={styles.countryCode}>+{country.dial}</Text>
              <Feather name="chevron-down" size={14} color={colors.textLight} />
            </TouchableOpacity>
            <View style={styles.dividerLine} />
            <TextInput
              style={styles.input}
              placeholder="Seu número"
              keyboardType="phone-pad"
              value={telefone}
              onChangeText={(v) => { setTelefone(v.replace(/[^0-9]/g, '')); setError(''); }}
              placeholderTextColor={colors.textLight}
              maxLength={15}
              returnKeyType="done"
              onSubmitEditing={handleSendOtp}
            />
          </View>
          {error && <Text style={styles.errorTextBelow}>{error}</Text>}
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
                    <Text style={styles.countryItemDial}>+{item.dial}</Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </TouchableOpacity>
        </Modal>

        <TouchableOpacity
          style={[styles.button, loading && { opacity: 0.7 }]}
          onPress={handleSendOtp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Enviar código via SMS</Text>
          )}
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
  iconCircleWhatsApp: { backgroundColor: '#E8F5E9' },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
  subtitle: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 22 },
  phone: { fontWeight: '600', color: colors.text },
  inputGroup: { marginBottom: spacing.md },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, height: 54,
  },
  inputError: { borderColor: colors.error },
  countrySelector: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  countryFlag: { fontSize: 20 },
  countryCode: { fontSize: fontSize.md, fontWeight: '600', color: colors.text, marginRight: 4 },
  dividerLine: { width: 1, height: 24, backgroundColor: colors.border, marginHorizontal: spacing.sm },
  input: { flex: 1, fontSize: fontSize.lg, color: colors.text, letterSpacing: 0.5 },
  errorTextBelow: { fontSize: fontSize.xs, color: colors.error, marginTop: 4 },
  // Canal
  channelSection: { marginBottom: spacing.lg },
  channelRow: { flexDirection: 'row', gap: spacing.sm },
  channelBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    paddingVertical: 14, borderRadius: borderRadius.md,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
  },
  channelBtnActiveWA: { borderColor: '#25D366', backgroundColor: '#E8F5E9' },
  channelBtnActiveSMS: { borderColor: colors.primary, backgroundColor: colors.surfaceVariant },
  channelText: { fontSize: fontSize.md, fontWeight: '600', color: colors.textLight },
  channelTextActiveWA: { color: '#25D366' },
  channelTextActiveSMS: { color: colors.primary },
  // Botões
  button: {
    backgroundColor: colors.primary, height: 52,
    borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center',
  },
  buttonWhatsApp: { backgroundColor: '#25D366' },
  buttonText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
  resendBtn: { alignItems: 'center', marginTop: spacing.lg },
  resendText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg, gap: spacing.xs },
  linkText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
  // OTP
  codeRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  codeInput: {
    width: 48, height: 56, borderRadius: borderRadius.md,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface, fontSize: fontSize.xl,
    fontWeight: '700', color: colors.text, textAlign: 'center',
  },
  codeInputFilled: { borderColor: colors.primary },
  codeInputError: { borderColor: colors.error },
  errorText: { fontSize: fontSize.xs, color: colors.error, textAlign: 'center', marginBottom: spacing.sm },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.lg, borderTopRightRadius: borderRadius.lg, padding: spacing.lg, maxHeight: '60%' },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text, marginBottom: spacing.md, textAlign: 'center' },
  countryItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: borderRadius.sm },
  countryItemActive: { backgroundColor: colors.surfaceVariant },
  countryItemFlag: { fontSize: 22, marginRight: spacing.md },
  countryItemName: { flex: 1, fontSize: fontSize.md, color: colors.text },
  countryItemDial: { fontSize: fontSize.md, color: colors.textSecondary, fontWeight: '600' },
});
