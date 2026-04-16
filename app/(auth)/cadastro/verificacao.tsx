import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, spacing, fontSize, borderRadius } from '../../../src/constants/theme';
import { useCadastroStore } from '../../../src/stores/cadastroStore';
import { useAuthStore } from '../../../src/stores/authStore';
import WizardProgress from '../../../src/components/auth/WizardProgress';
import { useState, useRef, useEffect } from 'react';
import { translateAuthError } from '../../../src/utils/authErrors';
import type { OtpChannel } from '../../../src/services/auth.service';

export default function CadastroStep2() {
  const { telefone, countryDial } = useCadastroStore();
  const { sendOtp, verifyOtp } = useAuthStore();
  const [channel, setChannel] = useState<OtpChannel>('sms');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setInterval(() => setResendTimer((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [resendTimer]);

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

  function getE164Phone() {
    return '+' + countryDial + telefone.replace(/\D/g, '');
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
      await verifyOtp(getE164Phone(), fullCode);
      router.push('/(auth)/cadastro/perfil');
    } catch (err: any) {
      setError(translateAuthError(err.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleResend(newChannel?: OtpChannel) {
    const sendChannel = newChannel || channel;
    if (newChannel) setChannel(newChannel);
    setLoading(true);
    setError('');
    try {
      await sendOtp(getE164Phone(), sendChannel);
      setResendTimer(60);
    } catch (err: any) {
      setError(translateAuthError(err.message));
    } finally {
      setLoading(false);
    }
  }

  const maskedPhone = telefone
    ? telefone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3').replace(/(\d{3})(\d)/, '$1***')
    : '(**) *****-****';

  const channelLabel = channel === 'whatsapp' ? 'WhatsApp' : 'SMS';
  const channelIcon = channel === 'whatsapp' ? 'message-circle' : 'smartphone';
  const channelColor = channel === 'whatsapp' ? '#25D366' : colors.primary;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <WizardProgress current={2} />

      <View style={styles.iconContainer}>
        <View style={[styles.iconCircle, channel === 'whatsapp' && { backgroundColor: '#E8F5E9' }]}>
          <Feather name={channelIcon} size={32} color={channelColor} />
        </View>
      </View>

      <Text style={styles.title}>Verificação via {channelLabel}</Text>
      <Text style={styles.subtitle}>
        Enviamos um código de 6 dígitos via {channelLabel} para{'\n'}
        <Text style={styles.phone}>{maskedPhone}</Text>
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
        style={[styles.nextButton, loading && { opacity: 0.7 }]}
        onPress={handleVerify}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.nextButtonText}>Verificar</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.resendButton}
        onPress={() => handleResend()}
        disabled={resendTimer > 0}
      >
        <Text style={[styles.resendText, resendTimer > 0 && { color: colors.textLight }]}>
          {resendTimer > 0 ? `Reenviar em ${resendTimer}s` : `Reenviar via ${channelLabel}`}
        </Text>
      </TouchableOpacity>

      {/* Trocar canal */}
      <TouchableOpacity
        style={styles.switchChannel}
        onPress={() => handleResend(channel === 'whatsapp' ? 'sms' : 'whatsapp')}
        disabled={loading || resendTimer > 0}
      >
        <Feather
          name={channel === 'whatsapp' ? 'smartphone' : 'message-circle'}
          size={16}
          color={resendTimer > 0 ? colors.textLight : colors.primary}
        />
        <Text style={[styles.switchText, resendTimer > 0 && { color: colors.textLight }]}>
          Receber via {channel === 'whatsapp' ? 'SMS' : 'WhatsApp'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: spacing.lg, paddingTop: spacing.xl },
  iconContainer: { alignItems: 'center', marginBottom: spacing.lg },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
  subtitle: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 22 },
  phone: { fontWeight: '600', color: colors.text },
  codeRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  codeInput: {
    width: 48, height: 56, borderRadius: borderRadius.md,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface, fontSize: fontSize.xl,
    fontWeight: '700', color: colors.text,
  },
  codeInputFilled: { borderColor: '#25D366' },
  codeInputError: { borderColor: colors.error },
  errorText: { fontSize: fontSize.xs, color: colors.error, textAlign: 'center', marginBottom: spacing.sm },
  nextButton: {
    backgroundColor: colors.primary, height: 52,
    borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.lg,
  },
  nextButtonText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
  resendButton: { alignItems: 'center', marginTop: spacing.lg },
  resendText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
  switchChannel: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.md, gap: spacing.xs,
  },
  switchText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
});
