import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Image, ActivityIndicator, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, spacing, fontSize, borderRadius } from '../../src/constants/theme';
import { useAuthStore } from '../../src/stores/authStore';
import { useState, useRef } from 'react';
import { translateAuthError } from '../../src/utils/authErrors';
import { isDeviceTrusted, trustDevice } from '../../src/utils/deviceTrust';

type Step = 'credentials' | 'otp';

export default function LoginScreen() {
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);
  const { signIn, sendOtp, verifyOtp, signInWithGoogle, signInWithFacebook } = useAuthStore();
  // Telefone guardado após login pra enviar OTP
  const [userPhone, setUserPhone] = useState('');

  async function handleOAuth(provider: 'google' | 'facebook') {
    setLoading(true);
    setError('');
    try {
      if (provider === 'google') {
        await signInWithGoogle();
      } else {
        await signInWithFacebook();
      }
      const { profile } = useAuthStore.getState();
      if (profile) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/cadastro/perfil');
      }
    } catch (err: any) {
      if (err.message !== 'Login cancelado') {
        setError(err.message || 'Erro no login');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    if (!email || !password) {
      setError('Preencha email e senha');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signIn(email, password);
      const { profile, user } = useAuthStore.getState();
      if (!profile) {
        // Sem perfil = novo usuário, auth guard redireciona
        router.replace('/(auth)/cadastro/perfil');
        return;
      }
      // 2FA só em dispositivo novo: pula o SMS se a conta tem skip_2fa OU se este
      // aparelho já passou pelo 2FA antes (dispositivo confiável).
      const trusted = user?.id ? await isDeviceTrusted(user.id) : false;
      if (profile.skip_2fa || trusted || !profile.telefone) {
        router.replace('/(tabs)');
      } else {
        setUserPhone(profile.telefone);
        await useAuthStore.getState().sendOtp(profile.telefone, 'sms');
        setStep('otp');
      }
    } catch (err: any) {
      setError(translateAuthError(err.message));
    } finally {
      setLoading(false);
    }
  }

  function handleDigit(text: string, index: number) {
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);
    setError('');
    if (text && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handleKeyPress(key: string, index: number) {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  async function handleVerify2FA() {
    const fullCode = code.join('');
    if (fullCode.length < 6) {
      setError('Digite o código completo');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Já estamos logados, só precisamos confirmar o OTP no Twilio
      const { SUPABASE_URL, SUPABASE_ANON_KEY } = await import('../../src/constants/config');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ phone: userPhone, code: fullCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Código inválido');
      // Passou pelo 2FA: marca este aparelho como confiável (não pede SMS de novo aqui)
      const { user } = useAuthStore.getState();
      if (user?.id) await trustDevice(user.id);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(translateAuthError(err.message));
    } finally {
      setLoading(false);
    }
  }

  // ====== TELA 2FA (OTP) ======
  if (step === 'otp') {
    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.logoContainer}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#E3F2FD', alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="shield" size={32} color={colors.primary} />
            </View>
          </View>

          <Text style={styles.otpTitle}>Verificação em 2 etapas</Text>
          <Text style={styles.otpSubtitle}>
            Enviamos um código SMS para{'\n'}
            <Text style={{ fontWeight: '600', color: colors.text }}>{userPhone.replace(/(\+\d{2})(\d{2})(\d+)(\d{4})/, '$1 ($2) •••••$4')}</Text>
          </Text>

          <View style={styles.codeRow}>
            {code.map((digit, i) => (
              <TextInput
                key={i}
                ref={(ref) => { inputs.current[i] = ref; }}
                style={[styles.codeInput, digit && styles.codeInputFilled, error ? styles.codeInputError : {}]}
                value={digit}
                onChangeText={(text) => handleDigit(text, i)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
                keyboardType="number-pad"
                maxLength={1}
                textAlign="center"
              />
            ))}
          </View>
          {error ? <Text style={styles.otpError}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.loginButton, loading && { opacity: 0.7 }]}
            onPress={handleVerify2FA}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.loginButtonText}>Confirmar</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={{ alignItems: 'center', marginTop: 20 }} onPress={() => { setStep('credentials'); setCode(['', '', '', '', '', '']); setError(''); }}>
            <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>Voltar ao login</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ====== TELA LOGIN ======
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/vertical.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.tagline}>Gestão inteligente para o cafeicultor</Text>
        </View>

        {/* Error */}
        {error ? (
          <View style={styles.errorBanner}>
            <Feather name="alert-circle" size={16} color={colors.error} />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : null}

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputWrapper}>
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
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Senha</Text>
            <View style={styles.inputWrapper}>
              <Feather name="lock" size={18} color={colors.textLight} />
              <TextInput
                style={styles.input}
                placeholder="Sua senha"
                secureTextEntry
                value={password}
                onChangeText={(v) => { setPassword(v); setError(''); }}
                placeholderTextColor={colors.textLight}
              />
            </View>
          </View>

          <TouchableOpacity onPress={() => router.push('/(auth)/recuperar-senha')}>
            <Text style={styles.forgotPassword}>Esqueci minha senha</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginButton, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.loginButtonText}>Entrar</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Login alternativo — Google escondido até OAuth ser configurado */}
          <TouchableOpacity style={[styles.socialButton, { width: '100%' }]} onPress={() => router.push('/(auth)/sms-login')}>
            <Feather name="smartphone" size={20} color={colors.text} />
            <Text style={styles.socialText}>Entrar com código por SMS</Text>
          </TouchableOpacity>

          <View style={styles.signupRow}>
            <Text style={styles.signupText}>Não tem conta? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/cadastro')}>
              <Text style={styles.signupLink}>Cadastre-se</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  logoContainer: { alignItems: 'center', marginBottom: spacing.xl },
  logo: { width: 200, height: 180, marginBottom: spacing.md },
  tagline: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  errorBannerText: { fontSize: fontSize.sm, color: colors.error, flex: 1 },
  form: {},
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
  input: { flex: 1, fontSize: fontSize.md, color: colors.text },
  forgotPassword: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600', textAlign: 'right', marginBottom: spacing.lg },
  loginButton: {
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { marginHorizontal: spacing.md, fontSize: fontSize.xs, color: colors.textLight },
  socialRow: { flexDirection: 'row', gap: spacing.md },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  socialText: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  signupRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  signupText: { fontSize: fontSize.sm, color: colors.textSecondary },
  signupLink: { fontSize: fontSize.sm, fontWeight: '700', color: colors.primary },
  // OTP 2FA
  otpTitle: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
  otpSubtitle: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl, lineHeight: 22 },
  codeRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  codeInput: {
    width: 48, height: 56, borderRadius: borderRadius.md,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface, fontSize: fontSize.xl,
    fontWeight: '700', color: colors.text, textAlign: 'center',
  },
  codeInputFilled: { borderColor: colors.primary },
  codeInputError: { borderColor: colors.error },
  otpError: { fontSize: fontSize.xs, color: colors.error, textAlign: 'center', marginBottom: spacing.sm },
});
