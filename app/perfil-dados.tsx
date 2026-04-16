import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { useAuthStore } from '../src/stores/authStore';
import { userService } from '../src/services/user.service';

export default function DadosPessoaisScreen() {
  const { profile, user, loadProfile } = useAuthStore();
  const [nome, setNome] = useState(profile?.nome || '');
  const [cpfCnpj, setCpfCnpj] = useState(profile?.cpf_cnpj || '');
  const [telefone, setTelefone] = useState(profile?.telefone || '');
  const [estado, setEstado] = useState(profile?.estado || '');
  const [municipio, setMunicipio] = useState(profile?.municipio || '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!user?.id) return;
    setSaving(true);
    try {
      await userService.updateProfile(user.id, { nome, cpf_cnpj: cpfCnpj, telefone, estado, municipio });
      await loadProfile();
      Alert.alert('Sucesso', 'Dados atualizados!');
      router.back();
    } catch {
      Alert.alert('Erro', 'Não foi possível salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dados Pessoais</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Nome completo</Text>
        <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholder="Seu nome" placeholderTextColor={colors.textLight} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>CPF / CNPJ</Text>
        <TextInput style={styles.input} value={cpfCnpj} onChangeText={setCpfCnpj} placeholder="000.000.000-00" keyboardType="numeric" placeholderTextColor={colors.textLight} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Telefone</Text>
        <TextInput style={styles.input} value={telefone} onChangeText={setTelefone} placeholder="(00) 00000-0000" keyboardType="phone-pad" placeholderTextColor={colors.textLight} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Estado</Text>
        <TextInput style={styles.input} value={estado} onChangeText={setEstado} placeholder="MG" placeholderTextColor={colors.textLight} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Município</Text>
        <TextInput style={styles.input} value={municipio} onChangeText={setMunicipio} placeholder="Sua cidade" placeholderTextColor={colors.textLight} />
      </View>

      <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Salvando...' : 'Salvar alterações'}</Text>
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 72 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  field: { marginBottom: spacing.md },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
  },
  saveBtn: { backgroundColor: colors.primary, height: 52, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  saveBtnText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
});
