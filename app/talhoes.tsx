import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { supabase } from '../src/services/supabase';
import { useAuthStore } from '../src/stores/authStore';

interface Talhao {
  id: string;
  nome: string;
  area_hectares: number;
  variedade: string | null;
  altitude_metros: number | null;
  ano_plantio: number | null;
  status: string;
}

export default function TalhoesScreen() {
  const { user } = useAuthStore();
  const [talhoes, setTalhoes] = useState<Talhao[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nome, setNome] = useState('');
  const [area, setArea] = useState('');
  const [variedade, setVariedade] = useState('');
  const [altitude, setAltitude] = useState('');
  const [anoPlantio, setAnoPlantio] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      setLoading(true);
      supabase
        .from('talhoes')
        .select('*')
        .eq('produtor_id', user.id)
        .order('criado_em', { ascending: false })
        .then(({ data, error }) => {
          if (!error && data) setTalhoes(data as Talhao[]);
          setLoading(false);
        });
    }, [user?.id])
  );

  async function handleSave() {
    if (!nome || !area) { Alert.alert('Atenção', 'Preencha nome e área'); return; }
    if (!user?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('talhoes').insert({
        produtor_id: user.id,
        nome,
        area_hectares: parseFloat(area),
        variedade: variedade || null,
        altitude_metros: altitude ? parseInt(altitude) : null,
        ano_plantio: anoPlantio ? parseInt(anoPlantio) : null,
      });
      if (error) throw error;
      Alert.alert('Sucesso', 'Talhão cadastrado!');
      setShowModal(false);
      setNome(''); setArea(''); setVariedade(''); setAltitude(''); setAnoPlantio('');
      // Reload
      const { data: reloaded } = await supabase.from('talhoes').select('*').eq('produtor_id', user.id).order('criado_em', { ascending: false });
      if (reloaded) setTalhoes(reloaded as Talhao[]);
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Não foi possível salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Talhões</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 80 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {talhoes.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="grid" size={48} color={colors.textLight} />
              <Text style={styles.emptyText}>Nenhum talhão cadastrado</Text>
              <Text style={styles.emptySubtext}>Toque no + para criar seu primeiro talhão</Text>
            </View>
          ) : (
            talhoes.map((t) => (
              <View key={t.id} style={styles.card}>
                <View style={styles.cardIcon}>
                  <Feather name="grid" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{t.nome}</Text>
                  <Text style={styles.cardDetail}>{t.variedade || 'Sem variedade'} • {t.area_hectares} ha</Text>
                  {(t.altitude_metros || t.ano_plantio) && (
                    <Text style={styles.cardDetail}>
                      {t.altitude_metros ? `Altitude: ${t.altitude_metros}m` : ''}
                      {t.altitude_metros && t.ano_plantio ? ' • ' : ''}
                      {t.ano_plantio ? `Plantio: ${t.ano_plantio}` : ''}
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
        <Feather name="plus" size={26} color={colors.white} />
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>Novo Talhão</Text>

            <Text style={styles.label}>Nome</Text>
            <TextInput style={styles.input} value={nome} onChangeText={setNome} placeholder="Ex: Talhão 5" placeholderTextColor={colors.textLight} />

            <Text style={styles.label}>Área (hectares)</Text>
            <TextInput style={styles.input} value={area} onChangeText={setArea} placeholder="10" keyboardType="decimal-pad" placeholderTextColor={colors.textLight} />

            <Text style={styles.label}>Variedade</Text>
            <TextInput style={styles.input} value={variedade} onChangeText={setVariedade} placeholder="Ex: Bourbon" placeholderTextColor={colors.textLight} />

            <Text style={styles.label}>Altitude (metros)</Text>
            <TextInput style={styles.input} value={altitude} onChangeText={setAltitude} placeholder="1050" keyboardType="numeric" placeholderTextColor={colors.textLight} />

            <Text style={styles.label}>Ano de plantio</Text>
            <TextInput style={styles.input} value={anoPlantio} onChangeText={setAnoPlantio} placeholder="2020" keyboardType="numeric" placeholderTextColor={colors.textLight} />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
                <Text style={styles.saveText}>{saving ? 'Salvando...' : 'Salvar'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingTop: 72, paddingBottom: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  list: { padding: spacing.md, paddingBottom: 100 },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: fontSize.lg, fontWeight: '600', color: colors.textSecondary, marginTop: spacing.md },
  emptySubtext: { fontSize: fontSize.sm, color: colors.textLight, marginTop: spacing.xs },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  cardIcon: { width: 44, height: 44, borderRadius: borderRadius.md, backgroundColor: colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  cardName: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  cardDetail: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  fab: { position: 'absolute', bottom: spacing.lg, right: spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.surface, borderTopLeftRadius: borderRadius.lg, borderTopRightRadius: borderRadius.lg, padding: spacing.lg, maxHeight: '80%' },
  modalTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: spacing.md },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs, marginTop: spacing.md },
  input: { backgroundColor: colors.background, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, fontSize: fontSize.md, color: colors.text },
  modalButtons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  cancelBtn: { flex: 1, height: 48, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  saveBtn: { flex: 1, height: 48, borderRadius: borderRadius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: fontSize.md, fontWeight: '600', color: colors.white },
});
