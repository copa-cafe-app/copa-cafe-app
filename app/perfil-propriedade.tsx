import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, useEffect } from 'react';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { useAuthStore } from '../src/stores/authStore';
import { supabase } from '../src/services/supabase';
import { parseBRL } from '../src/utils/format';

export default function PropriedadeScreen() {
  const { user } = useAuthStore();
  const [nome, setNome] = useState('');
  const [area, setArea] = useState('');
  const [altitude, setAltitude] = useState('');
  const [regiao, setRegiao] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [propId, setPropId] = useState<string | null>(null);

  useEffect(() => {
    loadProp();
  }, []);

  async function loadProp() {
    if (!user?.id) return;
    try {
      const { data } = await supabase.from('propriedades').select('*').eq('produtor_id', user.id).limit(1).single();
      if (data) {
        setPropId(data.id);
        setNome(data.nome || '');
        setArea(data.area_total_hectares?.toString() || '');
        setAltitude(data.altitude_metros?.toString() || '');
        setRegiao(data.regiao_cafeeira || '');
      }
    } catch {} finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!user?.id) return;
    setSaving(true);
    try {
      const updates = {
        nome,
        area_total_hectares: parseBRL(area),
        altitude_metros: parseBRL(altitude),
        regiao_cafeeira: regiao || null,
      };
      if (propId) {
        await supabase.from('propriedades').update(updates).eq('id', propId);
      } else {
        await supabase.from('propriedades').insert({ ...updates, produtor_id: user.id });
      }
      Alert.alert('Sucesso', 'Propriedade atualizada!');
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
        <Text style={styles.headerTitle}>Propriedade</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Nome da propriedade</Text>
        <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholder="Ex: Fazenda Santa Clara" placeholderTextColor={colors.textLight} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Área total (hectares)</Text>
        <TextInput style={styles.input} value={area} onChangeText={setArea} placeholder="45" keyboardType="decimal-pad" placeholderTextColor={colors.textLight} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Altitude (metros)</Text>
        <TextInput style={styles.input} value={altitude} onChangeText={setAltitude} placeholder="1050" keyboardType="decimal-pad" placeholderTextColor={colors.textLight} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Região cafeeira</Text>
        <TextInput style={styles.input} value={regiao} onChangeText={setRegiao} placeholder="Ex: Matas de Minas" placeholderTextColor={colors.textLight} />
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
