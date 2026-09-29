import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, spacing, fontSize, borderRadius } from '../../../src/constants/theme';
import { useCadastroStore } from '../../../src/stores/cadastroStore';
import WizardProgress from '../../../src/components/auth/WizardProgress';
import { useState } from 'react';
import { validateCPFCNPJ } from '../../../src/utils/validators';

const estados = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

export default function CadastroStep3() {
  const { nome, cpfCnpj, estado, municipio, setField } = useCadastroStore();
  const insets = useSafeAreaInsets();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showEstados, setShowEstados] = useState(false);

  function formatCpfCnpj(value: string) {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 11) {
      return digits
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    return digits
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!nome.trim()) errs.nome = 'Nome é obrigatório';
    const cpfCnpjResult = validateCPFCNPJ(cpfCnpj);
    if (!cpfCnpjResult.valid) errs.cpfCnpj = cpfCnpjResult.message || 'CPF ou CNPJ inválido';
    if (!estado) errs.estado = 'Selecione o estado';
    if (!municipio.trim()) errs.municipio = 'Município é obrigatório';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNext() {
    if (validate()) {
      router.push('/(auth)/cadastro/fazenda');
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: spacing.lg + insets.bottom }]} keyboardShouldPersistTaps="handled">
      <WizardProgress current={3} />

      <Text style={styles.title}>Seus dados</Text>
      <Text style={styles.subtitle}>Informações pessoais do produtor</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Nome completo</Text>
        <View style={[styles.inputWrapper, errors.nome && styles.inputError]}>
          <Feather name="user" size={18} color={colors.textLight} />
          <TextInput
            style={styles.input}
            placeholder="Seu nome completo"
            value={nome}
            onChangeText={(v) => setField('nome', v)}
            placeholderTextColor={colors.textLight}
          />
        </View>
        {errors.nome && <Text style={styles.errorText}>{errors.nome}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>CPF ou CNPJ</Text>
        <View style={[styles.inputWrapper, errors.cpfCnpj && styles.inputError]}>
          <Feather name="file-text" size={18} color={colors.textLight} />
          <TextInput
            style={styles.input}
            placeholder="000.000.000-00"
            keyboardType="number-pad"
            value={cpfCnpj}
            onChangeText={(v) => setField('cpfCnpj', formatCpfCnpj(v))}
            placeholderTextColor={colors.textLight}
            maxLength={18}
          />
        </View>
        {errors.cpfCnpj && <Text style={styles.errorText}>{errors.cpfCnpj}</Text>}
      </View>

      <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.label}>Estado</Text>
          <TouchableOpacity
            style={[styles.inputWrapper, errors.estado && styles.inputError]}
            onPress={() => setShowEstados(!showEstados)}
          >
            <Feather name="map-pin" size={18} color={colors.textLight} />
            <Text style={[styles.input, !estado && { color: colors.textLight }]}>
              {estado || 'UF'}
            </Text>
            <Feather name="chevron-down" size={18} color={colors.textLight} />
          </TouchableOpacity>
          {errors.estado && <Text style={styles.errorText}>{errors.estado}</Text>}
          {showEstados && (
            <View style={styles.dropdown}>
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                {estados.map((uf) => (
                  <TouchableOpacity
                    key={uf}
                    style={[styles.dropdownItem, estado === uf && styles.dropdownItemActive]}
                    onPress={() => { setField('estado', uf); setShowEstados(false); }}
                  >
                    <Text style={[styles.dropdownText, estado === uf && styles.dropdownTextActive]}>{uf}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        <View style={[styles.inputGroup, { flex: 2, marginLeft: spacing.md }]}>
          <Text style={styles.label}>Município</Text>
          <View style={[styles.inputWrapper, errors.municipio && styles.inputError]}>
            <TextInput
              style={styles.input}
              placeholder="Sua cidade"
              value={municipio}
              onChangeText={(v) => setField('municipio', v)}
              placeholderTextColor={colors.textLight}
            />
          </View>
          {errors.municipio && <Text style={styles.errorText}>{errors.municipio}</Text>}
        </View>
      </View>

      <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
        <Text style={styles.nextButtonText}>Continuar</Text>
        <Feather name="arrow-right" size={20} color={colors.white} />
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: spacing.xl },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  subtitle: { fontSize: fontSize.md, color: colors.textSecondary, marginBottom: spacing.xl },
  row: { flexDirection: 'row' },
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
  errorText: { fontSize: fontSize.xs, color: colors.error, marginTop: 4 },
  dropdown: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  dropdownItem: { padding: spacing.md },
  dropdownItemActive: { backgroundColor: colors.surfaceVariant },
  dropdownText: { fontSize: fontSize.md, color: colors.text },
  dropdownTextActive: { color: colors.primary, fontWeight: '600' },
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
});
