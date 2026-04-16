import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, spacing, fontSize, borderRadius } from '../../../src/constants/theme';
import { useCadastroStore } from '../../../src/stores/cadastroStore';
import WizardProgress from '../../../src/components/auth/WizardProgress';
import { coffeeRegions, certificationTypes } from '../../../src/constants/varieties';
import { useState } from 'react';

export default function CadastroStep4() {
  const { nomeFazenda, areaHectares, altitudeMetros, regiaoCafeeira, certificacoes, setField } = useCadastroStore();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showRegioes, setShowRegioes] = useState(false);
  const [showCerts, setShowCerts] = useState(false);

  function toggleCert(cert: string) {
    const current = certificacoes || [];
    if (current.includes(cert)) {
      setField('certificacoes', current.filter((c: string) => c !== cert));
    } else {
      setField('certificacoes', [...current, cert]);
    }
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!nomeFazenda.trim()) errs.nomeFazenda = 'Nome da propriedade é obrigatório';
    if (!areaHectares) errs.areaHectares = 'Informe a área';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleNext() {
    if (validate()) {
      router.push('/(auth)/cadastro/termos');
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <WizardProgress current={4} />

      <Text style={styles.title}>Sua fazenda</Text>
      <Text style={styles.subtitle}>Dados da propriedade rural</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Nome da propriedade</Text>
        <View style={[styles.inputWrapper, errors.nomeFazenda && styles.inputError]}>
          <Feather name="home" size={18} color={colors.textLight} />
          <TextInput
            style={styles.input}
            placeholder='Ex: "Fazenda Santa Clara"'
            value={nomeFazenda}
            onChangeText={(v) => setField('nomeFazenda', v)}
            placeholderTextColor={colors.textLight}
          />
        </View>
        {errors.nomeFazenda && <Text style={styles.errorText}>{errors.nomeFazenda}</Text>}
      </View>

      <View style={styles.row}>
        <View style={[styles.inputGroup, { flex: 1 }]}>
          <Text style={styles.label}>Área (hectares)</Text>
          <View style={[styles.inputWrapper, errors.areaHectares && styles.inputError]}>
            <TextInput
              style={styles.input}
              placeholder="45"
              keyboardType="numeric"
              value={areaHectares}
              onChangeText={(v) => setField('areaHectares', v)}
              placeholderTextColor={colors.textLight}
            />
            <Text style={styles.unit}>ha</Text>
          </View>
          {errors.areaHectares && <Text style={styles.errorText}>{errors.areaHectares}</Text>}
        </View>

        <View style={[styles.inputGroup, { flex: 1, marginLeft: spacing.md }]}>
          <Text style={styles.label}>Altitude (metros)</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="1050"
              keyboardType="numeric"
              value={altitudeMetros}
              onChangeText={(v) => setField('altitudeMetros', v)}
              placeholderTextColor={colors.textLight}
            />
            <Text style={styles.unit}>m</Text>
          </View>
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Região cafeeira</Text>
        <TouchableOpacity
          style={styles.inputWrapper}
          onPress={() => setShowRegioes(!showRegioes)}
        >
          <Feather name="map" size={18} color={colors.textLight} />
          <Text style={[styles.input, !regiaoCafeeira && { color: colors.textLight }]}>
            {regiaoCafeeira || 'Selecione a região'}
          </Text>
          <Feather name="chevron-down" size={18} color={colors.textLight} />
        </TouchableOpacity>
        {showRegioes && (
          <View style={styles.dropdown}>
            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
              {coffeeRegions.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.dropdownItem, regiaoCafeeira === r && styles.dropdownItemActive]}
                  onPress={() => { setField('regiaoCafeeira', r); setShowRegioes(false); }}
                >
                  <Text style={[styles.dropdownText, regiaoCafeeira === r && styles.dropdownTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Certificações (opcional)</Text>
        <TouchableOpacity
          style={styles.inputWrapper}
          onPress={() => setShowCerts(!showCerts)}
        >
          <Feather name="award" size={18} color={colors.textLight} />
          <Text style={[styles.input, certificacoes.length === 0 && { color: colors.textLight }]}>
            {certificacoes.length > 0 ? `${certificacoes.length} selecionada(s)` : 'Selecione certificações'}
          </Text>
          <Feather name="chevron-down" size={18} color={colors.textLight} />
        </TouchableOpacity>
        {showCerts && (
          <View style={styles.dropdown}>
            <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
              {certificationTypes.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.dropdownItem, certificacoes.includes(c) && styles.dropdownItemActive]}
                  onPress={() => toggleCert(c)}
                >
                  <View style={styles.checkRow}>
                    <Feather
                      name={certificacoes.includes(c) ? 'check-square' : 'square'}
                      size={18}
                      color={certificacoes.includes(c) ? colors.primary : colors.textLight}
                    />
                    <Text style={[styles.dropdownText, { marginLeft: spacing.sm }]}>{c}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
        {certificacoes.length > 0 && (
          <View style={styles.certTags}>
            {certificacoes.map((c: string) => (
              <View key={c} style={styles.certTag}>
                <Text style={styles.certTagText}>{c}</Text>
                <TouchableOpacity onPress={() => toggleCert(c)}>
                  <Feather name="x" size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
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
  unit: { fontSize: fontSize.sm, color: colors.textLight, fontWeight: '600' },
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
  checkRow: { flexDirection: 'row', alignItems: 'center' },
  certTags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  certTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    gap: 4,
  },
  certTagText: { fontSize: fontSize.xs, color: colors.primary, fontWeight: '500' },
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
