import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../src/constants/config';

interface AnaliseResultado {
  saudavel: boolean;
  confianca: number;
  diagnostico: string;
  detalhes: string;
  recomendacoes: string[];
}

async function analisarComClaude(uri: string): Promise<AnaliseResultado> {
  // Converter imagem para base64
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });

  // Detectar tipo de mídia
  const ext = uri.split('.').pop()?.toLowerCase();
  const mediaType = ext === 'png' ? 'image/png' : 'image/jpeg';

  const res = await fetch(`${SUPABASE_URL}/functions/v1/analyze-plant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ image_base64: base64, media_type: mediaType }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro na análise');

  return data as AnaliseResultado;
}

export default function AnalisePlantaScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [resultado, setResultado] = useState<AnaliseResultado | null>(null);

  async function pickImage(fromCamera: boolean) {
    let result;
    if (fromCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Permita o acesso à câmera para tirar fotos');
        return;
      }
      result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    }

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setResultado(null);
    }
  }

  async function handleAnalise() {
    if (!imageUri) return;
    setAnalisando(true);
    try {
      const res = await analisarComClaude(imageUri);
      setResultado(res);
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Não foi possível analisar a imagem');
    } finally {
      setAnalisando(false);
    }
  }

  function handleNovaAnalise() {
    setImageUri(null);
    setResultado(null);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Saúde da Planta</Text>
        <View style={{ width: 40 }} />
      </View>

      {!imageUri ? (
        /* Seleção de imagem */
        <View style={styles.pickSection}>
          <View style={styles.iconCircle}>
            <Feather name="camera" size={40} color={colors.primary} />
          </View>
          <Text style={styles.pickTitle}>Analise sua planta</Text>
          <Text style={styles.pickSubtitle}>Tire uma foto ou escolha da galeria para verificar a saúde da sua planta de café</Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={() => pickImage(true)}>
            <Feather name="camera" size={20} color={colors.white} />
            <Text style={styles.primaryBtnText}>Tirar Foto</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={() => pickImage(false)}>
            <Feather name="image" size={20} color={colors.primary} />
            <Text style={styles.secondaryBtnText}>Escolher da Galeria</Text>
          </TouchableOpacity>

          <View style={styles.tipsCard}>
            <Text style={styles.tipsTitle}>Dicas para melhor resultado</Text>
            <View style={styles.tipRow}><Feather name="sun" size={14} color={colors.textSecondary} /><Text style={styles.tipText}>Boa iluminação natural</Text></View>
            <View style={styles.tipRow}><Feather name="maximize" size={14} color={colors.textSecondary} /><Text style={styles.tipText}>Foque nas folhas afetadas</Text></View>
            <View style={styles.tipRow}><Feather name="zoom-in" size={14} color={colors.textSecondary} /><Text style={styles.tipText}>Tire de perto para detalhes</Text></View>
            <View style={styles.tipRow}><Feather name="image" size={14} color={colors.textSecondary} /><Text style={styles.tipText}>Evite fotos borradas</Text></View>
          </View>
        </View>
      ) : (
        /* Imagem selecionada + resultado */
        <View>
          <Image source={{ uri: imageUri }} style={styles.previewImage} />

          {!resultado && !analisando && (
            <TouchableOpacity style={styles.primaryBtn} onPress={handleAnalise}>
              <Feather name="search" size={20} color={colors.white} />
              <Text style={styles.primaryBtnText}>Analisar Planta</Text>
            </TouchableOpacity>
          )}

          {analisando && (
            <View style={styles.loadingSection}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Analisando sua planta...</Text>
              <Text style={styles.loadingSubtext}>A IA está verificando sinais de doenças</Text>
            </View>
          )}

          {resultado && (
            <View style={styles.resultSection}>
              {/* Badge de status */}
              <View style={[styles.statusBadge, { backgroundColor: resultado.saudavel ? '#E8F5E9' : '#FFF3E0' }]}>
                <Feather
                  name={resultado.saudavel ? 'check-circle' : 'alert-triangle'}
                  size={24}
                  color={resultado.saudavel ? colors.success : '#E65100'}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statusTitle, { color: resultado.saudavel ? colors.success : '#E65100' }]}>
                    {resultado.diagnostico}
                  </Text>
                  <Text style={styles.statusConfianca}>Confiança: {resultado.confianca}%</Text>
                </View>
              </View>

              {/* Detalhes */}
              <View style={styles.detailCard}>
                <Text style={styles.detailTitle}>Detalhes</Text>
                <Text style={styles.detailText}>{resultado.detalhes}</Text>
              </View>

              {/* Recomendações */}
              <View style={styles.detailCard}>
                <Text style={styles.detailTitle}>Recomendações</Text>
                {resultado.recomendacoes.map((rec, i) => (
                  <View key={i} style={styles.recRow}>
                    <Text style={styles.recNumber}>{i + 1}</Text>
                    <Text style={styles.recText}>{rec}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity style={styles.secondaryBtn} onPress={handleNovaAnalise}>
                <Feather name="refresh-cw" size={20} color={colors.primary} />
                <Text style={styles.secondaryBtnText}>Nova Análise</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      <Text style={styles.disclaimer}>
        Esta análise é feita por inteligência artificial e serve como orientação inicial. Para diagnóstico definitivo, consulte um agrônomo.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingTop: 72, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  pickSection: { alignItems: 'center' },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surfaceVariant, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  pickTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  pickSubtitle: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: spacing.xl, paddingHorizontal: spacing.lg },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, height: 52, borderRadius: borderRadius.md, width: '100%', marginBottom: spacing.md },
  primaryBtnText: { color: colors.white, fontSize: fontSize.md, fontWeight: '700' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.primary, height: 52, borderRadius: borderRadius.md, width: '100%', marginBottom: spacing.md },
  secondaryBtnText: { color: colors.primary, fontSize: fontSize.md, fontWeight: '700' },
  tipsCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, width: '100%', marginTop: spacing.lg, borderWidth: 1, borderColor: colors.border },
  tipsTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  tipText: { fontSize: fontSize.sm, color: colors.textSecondary },
  previewImage: { width: '100%', height: 280, borderRadius: borderRadius.lg, marginBottom: spacing.lg },
  loadingSection: { alignItems: 'center', paddingVertical: spacing.xl },
  loadingText: { fontSize: fontSize.md, fontWeight: '600', color: colors.text, marginTop: spacing.md },
  loadingSubtext: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.xs },
  resultSection: { marginTop: spacing.sm },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: borderRadius.lg, marginBottom: spacing.md },
  statusTitle: { fontSize: fontSize.md, fontWeight: '700' },
  statusConfianca: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  detailCard: { backgroundColor: colors.surface, borderRadius: borderRadius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  detailTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  detailText: { fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: 20 },
  recRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  recNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.surfaceVariant, textAlign: 'center', lineHeight: 24, fontSize: fontSize.sm, fontWeight: '700', color: colors.primary },
  recText: { flex: 1, fontSize: fontSize.sm, color: colors.text, lineHeight: 20 },
  disclaimer: { fontSize: fontSize.xs, color: colors.textLight, textAlign: 'center', marginTop: spacing.lg, lineHeight: 16, paddingHorizontal: spacing.md },
});
