import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, Modal, FlatList, SafeAreaView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { useAuthStore } from '../src/stores/authStore';
import { supabase } from '../src/services/supabase';
import { coffeeVarieties } from '../src/constants/varieties';

const PROCESSOS = ['Natural', 'Lavado', 'Honey', 'Descascado', 'Cereja Descascado'];
const SAFRAS = ['2026/27', '2025/26', '2024/25'];
const BEBIDAS = ['Estritamente Mole', 'Mole', 'Apenas Mole', 'Dura', 'Riada', 'Rio', 'Rio Zona'];
const PENEIRAS = ['17/18', '16/17', '15/16', '14/15', '13', 'Moka', 'Bica corrida'];

type PickerModalProps = {
  visible: boolean;
  title: string;
  options: string[];
  onSelect: (value: string) => void;
  onClose: () => void;
};

function PickerModal({ visible, title, options, onSelect, onClose }: PickerModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Feather name="x" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => { onSelect(item); onClose(); }}
              >
                <Text style={styles.modalItemText}>{item}</Text>
              </TouchableOpacity>
            )}
            style={styles.modalList}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export default function NovoLoteScreen() {
  const { user } = useAuthStore();
  const [variedade, setVariedade] = useState('');
  const [variedadeOutro, setVariedadeOutro] = useState('');
  const [processo, setProcesso] = useState('');
  const [safra, setSafra] = useState('2025/26');
  const [sacas, setSacas] = useState('');
  const [preco, setPreco] = useState('');
  const [bebida, setBebida] = useState('');
  const [peneira, setPeneira] = useState('');
  const [cata, setCata] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [showVariedade, setShowVariedade] = useState(false);
  const [showProcesso, setShowProcesso] = useState(false);
  const [showBebida, setShowBebida] = useState(false);
  const [showPeneira, setShowPeneira] = useState(false);

  async function handleSave() {
    if (!variedade || !processo || !sacas) {
      Alert.alert('Atenção', 'Preencha variedade, processo e quantidade de sacas');
      return;
    }
    if (variedade === 'Outro' && !variedadeOutro.trim()) {
      Alert.alert('Atenção', 'Informe o nome da variedade');
      return;
    }
    if (!user?.id) return;
    const variedadeFinal = variedade === 'Outro' ? variedadeOutro.trim() : variedade;
    setSaving(true);
    try {
      const { error } = await supabase.from('lotes').insert({
        produtor_id: user.id,
        variedade: variedadeFinal,
        processo: processo.toUpperCase().replace(/ /g, '_'),
        safra,
        quantidade_sacas: parseInt(sacas),
        preco_por_saca: preco ? parseFloat(preco) : null,
        bebida: bebida || null,
        peneira: peneira || null,
        cata: cata ? parseInt(cata) : null,
        notas_sensoriais: notas || null,
        status: 'RASCUNHO',
      });
      if (error) throw error;
      Alert.alert('Sucesso', 'Lote criado!');
      router.back();
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Não foi possível criar o lote');
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
        <Text style={styles.headerTitle}>Novo Lote</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Variedade */}
      <Text style={styles.label}>Variedade</Text>
      <TouchableOpacity style={styles.select} onPress={() => setShowVariedade(true)}>
        <Text style={variedade ? styles.selectText : styles.selectPlaceholder}>{variedade || 'Selecione a variedade'}</Text>
        <Feather name="chevron-down" size={16} color={colors.textLight} />
      </TouchableOpacity>
      <PickerModal
        visible={showVariedade}
        title="Variedade"
        options={coffeeVarieties}
        onSelect={setVariedade}
        onClose={() => setShowVariedade(false)}
      />
      {variedade === 'Outro' && (
        <TextInput
          style={[styles.input, { marginTop: spacing.sm }]}
          value={variedadeOutro}
          onChangeText={setVariedadeOutro}
          placeholder="Digite o nome da variedade"
          placeholderTextColor={colors.textLight}
        />
      )}

      {/* Processo */}
      <Text style={styles.label}>Processo</Text>
      <TouchableOpacity style={styles.select} onPress={() => setShowProcesso(true)}>
        <Text style={processo ? styles.selectText : styles.selectPlaceholder}>{processo || 'Selecione o processo'}</Text>
        <Feather name="chevron-down" size={16} color={colors.textLight} />
      </TouchableOpacity>
      <PickerModal
        visible={showProcesso}
        title="Processo"
        options={PROCESSOS}
        onSelect={setProcesso}
        onClose={() => setShowProcesso(false)}
      />

      {/* Safra */}
      <Text style={styles.label}>Safra</Text>
      <View style={styles.safraRow}>
        {SAFRAS.map((s) => (
          <TouchableOpacity key={s} style={[styles.safraBtn, safra === s && styles.safraBtnActive]} onPress={() => setSafra(s)}>
            <Text style={[styles.safraText, safra === s && styles.safraTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Sacas */}
      <Text style={styles.label}>Quantidade de sacas</Text>
      <TextInput style={styles.input} value={sacas} onChangeText={setSacas} placeholder="Ex: 50" keyboardType="numeric" placeholderTextColor={colors.textLight} />

      {/* Preço */}
      <Text style={styles.label}>Preço por saca (opcional)</Text>
      <View style={styles.priceRow}>
        <Text style={styles.pricePrefix}>R$</Text>
        <TextInput style={[styles.input, { flex: 1 }]} value={preco} onChangeText={setPreco} placeholder="1.480,00" keyboardType="decimal-pad" placeholderTextColor={colors.textLight} />
      </View>

      {/* Bebida */}
      <Text style={styles.label}>Bebida (opcional)</Text>
      <TouchableOpacity style={styles.select} onPress={() => setShowBebida(true)}>
        <Text style={bebida ? styles.selectText : styles.selectPlaceholder}>{bebida || 'Selecione a bebida'}</Text>
        <Feather name="chevron-down" size={16} color={colors.textLight} />
      </TouchableOpacity>
      <PickerModal
        visible={showBebida}
        title="Bebida"
        options={BEBIDAS}
        onSelect={setBebida}
        onClose={() => setShowBebida(false)}
      />

      {/* Peneira */}
      <Text style={styles.label}>Peneira (opcional)</Text>
      <TouchableOpacity style={styles.select} onPress={() => setShowPeneira(true)}>
        <Text style={peneira ? styles.selectText : styles.selectPlaceholder}>{peneira || 'Selecione a peneira'}</Text>
        <Feather name="chevron-down" size={16} color={colors.textLight} />
      </TouchableOpacity>
      <PickerModal
        visible={showPeneira}
        title="Peneira"
        options={PENEIRAS}
        onSelect={setPeneira}
        onClose={() => setShowPeneira(false)}
      />

      {/* Cata */}
      <Text style={styles.label}>Cata - defeitos (opcional)</Text>
      <TextInput style={styles.input} value={cata} onChangeText={setCata} placeholder="Ex: 20" keyboardType="numeric" placeholderTextColor={colors.textLight} />

      {/* Notas sensoriais */}
      <Text style={styles.label}>Notas sensoriais (opcional)</Text>
      <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={notas} onChangeText={setNotas} placeholder="Ex: Chocolate, caramelo, frutas vermelhas" multiline placeholderTextColor={colors.textLight} />

      <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Salvando...' : 'Criar Lote'}</Text>
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 72, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  label: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs, marginTop: spacing.md },
  input: { backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, fontSize: fontSize.md, color: colors.text },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  selectText: { fontSize: fontSize.md, color: colors.text },
  selectPlaceholder: { fontSize: fontSize.md, color: colors.textLight },
  safraRow: { flexDirection: 'row', gap: spacing.sm },
  safraBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, backgroundColor: colors.surfaceVariant },
  safraBtnActive: { backgroundColor: colors.primary },
  safraText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: '500' },
  safraTextActive: { color: colors.white },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pricePrefix: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  saveBtn: { backgroundColor: colors.primary, height: 52, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl },
  saveBtnText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  modalCloseBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  modalList: { paddingBottom: spacing.xl },
  modalItem: { padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalItemText: { fontSize: fontSize.md, color: colors.text },
});
