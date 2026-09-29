import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, Alert, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback, useMemo } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, fontSize, borderRadius } from '../src/constants/theme';
import { useAuthStore } from '../src/stores/authStore';
import { useWeatherStore } from '../src/stores/weatherStore';
import { atividadeService, SyncDespesaError } from '../src/services/atividade.service';
import { userService } from '../src/services/user.service';
import { uploadComprovante } from '../src/utils/uploadComprovante';
import { parseBRL } from '../src/utils/format';
import { exportAtividadesPDF } from '../src/utils/exportAtividades';
import type { Propriedade } from '../src/types/user';
import {
  ATIVIDADE_LABELS,
  ATIVIDADE_CORES,
  type Atividade,
  type AtividadeTipo,
} from '../src/types/atividade';

const TIPOS: AtividadeTipo[] = ['ADUBACAO', 'PULVERIZACAO', 'PODA', 'COLHEITA', 'IRRIGACAO', 'OUTRO'];

function getWeatherIcon(code: number): keyof typeof Feather.glyphMap {
  if (code <= 1) return 'sun';
  if (code <= 3) return 'cloud';
  if (code >= 45 && code <= 48) return 'cloud'; // fog
  if (code >= 51 && code <= 67) return 'cloud-rain';
  if (code >= 71 && code <= 77) return 'cloud-snow';
  if (code >= 80 && code <= 82) return 'cloud-drizzle';
  if (code >= 95 && code <= 99) return 'cloud-lightning';
  return 'cloud';
}

function getDaysFromToday(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getConfidence(daysAhead: number): { label: string; color: string } {
  if (daysAhead <= 1) return { label: 'Confiança alta', color: colors.success };
  if (daysAhead <= 4) return { label: 'Confiança média', color: colors.warning };
  return { label: 'Confiança baixa', color: colors.textLight };
}

// Máscara DD/MM/AAAA enquanto digita
function formatDateInput(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

// DD/MM/AAAA -> YYYY-MM-DD (null se inválida)
function toISODate(text: string): string | null {
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const d = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
  if (d.getDate() !== parseInt(dd) || d.getMonth() !== parseInt(mm) - 1) return null;
  return `${yyyy}-${mm}-${dd}`;
}

function firstDayOfMonthBR(): string {
  const now = new Date();
  return `01/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
}

function todayBR(): string {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
}

export default function DiarioScreen() {
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuthStore();
  const { forecast, fetchForecast } = useWeatherStore();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });

  // Property selector state
  const [propriedades, setPropriedades] = useState<Propriedade[]>([]);
  const [selectedPropId, setSelectedPropId] = useState<string | null>(null);

  const hasMultipleCities = useMemo(() => {
    const uniqueCities = [...new Set(propriedades.map(p => p.municipio).filter(Boolean))];
    return uniqueCities.length > 1;
  }, [propriedades]);

  const selectedProp = useMemo(
    () => propriedades.find(p => p.id === selectedPropId) ?? null,
    [propriedades, selectedPropId],
  );

  // Form state
  const [tipo, setTipo] = useState<AtividadeTipo>('ADUBACAO');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [custo, setCusto] = useState('');
  const [comprovanteUri, setComprovanteUri] = useState<string | null>(null);
  const [showTipoPicker, setShowTipoPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Relatório por período (FB7)
  const [showReport, setShowReport] = useState(false);
  const [reportStart, setReportStart] = useState(firstDayOfMonthBR());
  const [reportEnd, setReportEnd] = useState(todayBR());
  const [generating, setGenerating] = useState(false);

  const loadAtividades = useCallback(async () => {
    if (!user?.id) return;
    try {
      const data = await atividadeService.listByMonth(user.id, currentMonth.year, currentMonth.month);
      setAtividades(data);
    } catch {
      // silently fail
    }
  }, [user?.id, currentMonth.year, currentMonth.month]);

  useEffect(() => {
    loadAtividades();
  }, [loadAtividades]);

  // Load propriedades on mount
  useEffect(() => {
    if (!user?.id) return;
    userService.getPropriedades(user.id).then((props) => {
      setPropriedades(props);
      if (props.length > 0) {
        setSelectedPropId(props[0].id);
      }
    }).catch(() => {});
  }, [user?.id]);

  // Fetch forecast based on selected property
  useEffect(() => {
    if (selectedProp?.municipio) {
      fetchForecast(selectedProp.municipio, selectedProp.estado);
    } else if (!forecast) {
      fetchForecast();
    }
  }, [selectedPropId, selectedProp?.municipio, selectedProp?.estado]);

  const forecastForDate = useMemo(() => {
    if (!forecast) return null;
    return forecast.find((f) => f.date === selectedDate) ?? null;
  }, [forecast, selectedDate]);

  // Build marked dates for calendar
  const markedDates: Record<string, any> = {};
  atividades.forEach((a) => {
    if (!markedDates[a.data]) {
      markedDates[a.data] = { dots: [], selected: a.data === selectedDate, selectedColor: colors.primary };
    }
    markedDates[a.data].dots.push({ key: a.id, color: ATIVIDADE_CORES[a.tipo] });
  });
  if (!markedDates[selectedDate]) {
    markedDates[selectedDate] = { selected: true, selectedColor: colors.primary, dots: [] };
  } else {
    markedDates[selectedDate].selected = true;
    markedDates[selectedDate].selectedColor = colors.primary;
  }

  const atividadesDoDia = atividades.filter((a) => a.data === selectedDate);

  function openEdit(atividade: Atividade) {
    setEditingId(atividade.id);
    setTipo(atividade.tipo);
    setTitulo(atividade.titulo);
    setDescricao(atividade.descricao || '');
    setCusto(atividade.custo ? String(atividade.custo) : '');
    setComprovanteUri(null);
    setShowModal(true);
  }

  function openNew() {
    setEditingId(null);
    setTipo('ADUBACAO');
    setTitulo('');
    setDescricao('');
    setCusto('');
    setComprovanteUri(null);
    setShowModal(true);
  }

  async function pickComprovante(fromCamera: boolean) {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permissão necessária', fromCamera ? 'Precisamos de acesso à câmera.' : 'Precisamos de acesso à galeria.');
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = { quality: 0.6, allowsEditing: true, mediaTypes: ['images'] };
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (!result.canceled && result.assets[0]) {
      setComprovanteUri(result.assets[0].uri);
    }
  }

  function askComprovanteSource() {
    Alert.alert('Anexar comprovante', undefined, [
      { text: 'Tirar foto', onPress: () => pickComprovante(true) },
      { text: 'Escolher da galeria', onPress: () => pickComprovante(false) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function handleGenerateReport() {
    if (!user?.id) return;
    const startISO = toISODate(reportStart);
    const endISO = toISODate(reportEnd);
    if (!startISO || !endISO) {
      Alert.alert('Datas inválidas', 'Use o formato DD/MM/AAAA nas duas datas.');
      return;
    }
    if (startISO > endISO) {
      Alert.alert('Período inválido', 'A data inicial deve ser anterior à data final.');
      return;
    }
    setGenerating(true);
    try {
      const lista = await atividadeService.listByRange(user.id, startISO, endISO);
      if (lista.length === 0) {
        Alert.alert('Sem atividades', 'Nenhuma atividade registrada nesse período.');
        return;
      }
      await exportAtividadesPDF(profile, lista, `${reportStart} a ${reportEnd}`);
      setShowReport(false);
    } catch (err: any) {
      Alert.alert('Erro', err.message || 'Não foi possível gerar o relatório');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!titulo.trim()) return;
    if (!user?.id) return;
    setSaving(true);
    try {
      const custoNum = parseBRL(custo) ?? 0;
      // O comprovante fica vinculado à despesa, que só existe quando há custo.
      let comprovanteUrl: string | null | undefined = undefined;
      if (comprovanteUri && custoNum > 0) {
        comprovanteUrl = await uploadComprovante(comprovanteUri, user.id);
      }

      if (editingId) {
        await atividadeService.update(editingId, {
          tipo,
          titulo: titulo.trim(),
          descricao: descricao.trim() || undefined,
          custo: custoNum > 0 ? custoNum : null,
        }, comprovanteUrl);
      } else {
        await atividadeService.create({
          produtor_id: user.id,
          tipo,
          titulo: titulo.trim(),
          descricao: descricao.trim() || undefined,
          data: selectedDate,
          custo: custoNum > 0 ? custoNum : undefined,
        }, comprovanteUrl ?? null);
      }
      setShowModal(false);
      setEditingId(null);
      setTitulo('');
      setDescricao('');
      setCusto('');
      setComprovanteUri(null);
      setTipo('ADUBACAO');
      await loadAtividades();
    } catch (err: any) {
      if (err instanceof SyncDespesaError) {
        // Mensagem já vem amigável do service. Recarrega a lista porque, na
        // edição, a atividade pode ter sido salva mesmo sem o custo.
        Alert.alert('Atenção', err.message);
        loadAtividades().catch(() => {});
      } else {
        Alert.alert('Erro', 'Não foi possível salvar a atividade. Verifique sua internet e tente novamente.');
      }
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(atividade: Atividade) {
    Alert.alert(
      'Excluir atividade',
      `Deseja excluir "${atividade.titulo}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await atividadeService.remove(atividade.id);
              await loadAtividades();
            } catch {
              Alert.alert('Erro', 'Não foi possível excluir');
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Voltar">
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Diário de Campo</Text>
        <TouchableOpacity onPress={() => setShowReport(true)} style={styles.backButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Gerar relatório em PDF">
          <Feather name="file-text" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
        {/* Property selector (only if farms in different cities) */}
        {hasMultipleCities && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.propSelector}
          >
            {propriedades.map((prop) => {
              const isSelected = prop.id === selectedPropId;
              return (
                <TouchableOpacity
                  key={prop.id}
                  style={[
                    styles.propPill,
                    isSelected ? styles.propPillSelected : styles.propPillDefault,
                  ]}
                  onPress={() => setSelectedPropId(prop.id)}
                >
                  <Text
                    style={[
                      styles.propPillText,
                      isSelected ? styles.propPillTextSelected : styles.propPillTextDefault,
                    ]}
                  >
                    {prop.nome}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Calendar */}
        <Calendar
          markingType="multi-dot"
          markedDates={markedDates}
          onDayPress={(day: DateData) => setSelectedDate(day.dateString)}
          onMonthChange={(month: DateData) => setCurrentMonth({ year: month.year, month: month.month })}
          theme={{
            backgroundColor: colors.background,
            calendarBackground: colors.background,
            todayTextColor: colors.primary,
            selectedDayBackgroundColor: colors.primary,
            selectedDayTextColor: colors.white,
            arrowColor: colors.primary,
            monthTextColor: colors.text,
            textDayFontWeight: '500',
            textMonthFontWeight: '700',
            textDayHeaderFontWeight: '600',
            textDayFontSize: 15,
            textMonthFontSize: 16,
          }}
        />

        {/* Weather forecast mini-card */}
        {forecastForDate && (() => {
          const daysAhead = getDaysFromToday(selectedDate);
          const confidence = getConfidence(daysAhead);
          const iconName = getWeatherIcon(forecastForDate.weatherCode);
          return (
            <View style={styles.weatherCard}>
              <Feather name={iconName} size={28} color={colors.primary} />
              <View style={styles.weatherInfo}>
                <View style={styles.weatherRow}>
                  <Feather name="thermometer" size={14} color={colors.textSecondary} />
                  <Text style={styles.weatherTemp}>
                    {forecastForDate.temperatureMin}° / {forecastForDate.temperatureMax}°
                  </Text>
                  <Feather name="droplet" size={14} color={colors.info} style={{ marginLeft: spacing.md }} />
                  <Text style={styles.weatherRain}>{forecastForDate.precipitationProbability}%</Text>
                </View>
                <View style={styles.weatherRow}>
                  <View style={[styles.confidenceDot, { backgroundColor: confidence.color }]} />
                  <Text style={[styles.confidenceText, { color: confidence.color }]}>{confidence.label}</Text>
                </View>
              </View>
            </View>
          );
        })()}

        {/* Activities for selected day */}
        <View style={styles.daySection}>
          <Text style={styles.daySectionTitle}>
            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>

          {atividadesDoDia.length === 0 ? (
            <View style={styles.emptyDay}>
              <Feather name="calendar" size={32} color={colors.textLight} />
              <Text style={styles.emptyDayText}>Nenhuma atividade neste dia</Text>
            </View>
          ) : (
            atividadesDoDia.map((a) => (
              <TouchableOpacity key={a.id} style={styles.atividadeCard} onPress={() => openEdit(a)} onLongPress={() => handleDelete(a)} accessibilityHint="Toque para editar">
                <View style={[styles.atividadeBadge, { backgroundColor: ATIVIDADE_CORES[a.tipo] }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.atividadeTitulo}>{a.titulo}</Text>
                  <Text style={styles.atividadeTipo}>{ATIVIDADE_LABELS[a.tipo]}</Text>
                  {a.descricao ? <Text style={styles.atividadeDesc}>{a.descricao}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {a.custo ? (
                    <Text style={styles.atividadeCusto}>R$ {a.custo.toFixed(2)}</Text>
                  ) : null}
                  <View style={styles.atividadeActions}>
                    <Feather name="edit-2" size={14} color={colors.textLight} />
                    <TouchableOpacity
                      onPress={() => handleDelete(a)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      accessibilityRole="button"
                      accessibilityLabel={`Excluir ${a.titulo}`}
                    >
                      <Feather name="trash-2" size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}

          {/* Custo total do mês */}
          {atividades.some((a) => a.custo && a.custo > 0) && (
            <View style={styles.custoTotalCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.custoTotalLabel}>Custo total — {new Date(currentMonth.year, currentMonth.month - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</Text>
              </View>
              <Text style={styles.custoTotalValue}>
                R$ {atividades.reduce((sum, a) => sum + (a.custo || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={[styles.fab, { bottom: spacing.lg + insets.bottom }]} onPress={openNew} accessibilityRole="button" accessibilityLabel="Nova atividade">
        <Feather name="plus" size={26} color={colors.white} />
      </TouchableOpacity>

      {/* Modal Nova Atividade */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalContent} contentContainerStyle={{ paddingBottom: insets.bottom }} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>{editingId ? 'Editar Atividade' : 'Nova Atividade'}</Text>
            <Text style={styles.modalDate}>
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>

            {/* Tipo */}
            <Text style={styles.fieldLabel}>Tipo</Text>
            <TouchableOpacity style={styles.selectButton} onPress={() => setShowTipoPicker(!showTipoPicker)}>
              <View style={[styles.tipoDot, { backgroundColor: ATIVIDADE_CORES[tipo] }]} />
              <Text style={styles.selectText}>{ATIVIDADE_LABELS[tipo]}</Text>
              <Feather name="chevron-down" size={16} color={colors.textLight} />
            </TouchableOpacity>
            {showTipoPicker && (
              <View style={styles.tipoList}>
                {TIPOS.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.tipoItem, t === tipo && styles.tipoItemActive]}
                    onPress={() => { setTipo(t); setShowTipoPicker(false); }}
                  >
                    <View style={[styles.tipoDot, { backgroundColor: ATIVIDADE_CORES[t] }]} />
                    <Text style={styles.tipoItemText}>{ATIVIDADE_LABELS[t]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Título */}
            <Text style={styles.fieldLabel}>Título</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ex: Adubação NPK talhão 3"
              value={titulo}
              onChangeText={setTitulo}
              placeholderTextColor={colors.textLight}
            />

            {/* Descrição */}
            <Text style={styles.fieldLabel}>Descrição (opcional)</Text>
            <TextInput
              style={[styles.textInput, { height: 72, textAlignVertical: 'top' }]}
              placeholder="Detalhes da atividade..."
              value={descricao}
              onChangeText={setDescricao}
              placeholderTextColor={colors.textLight}
              multiline
            />

            {/* Custo */}
            <Text style={styles.fieldLabel}>Custo (opcional)</Text>
            <View style={styles.custoWrapper}>
              <Text style={styles.custoPrefix}>R$</Text>
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                placeholder="0,00"
                value={custo}
                onChangeText={setCusto}
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textLight}
              />
            </View>
            {custo ? (
              <Text style={styles.custoHint}>Este custo entra automaticamente na aba Custos de Produção.</Text>
            ) : null}

            {/* Comprovante (vinculado ao custo) */}
            {custo ? (
              <>
                <Text style={styles.fieldLabel}>Comprovante (opcional)</Text>
                {comprovanteUri ? (
                  <View style={styles.compRow}>
                    <Image source={{ uri: comprovanteUri }} style={styles.compThumb} />
                    <TouchableOpacity style={styles.compAction} onPress={askComprovanteSource}>
                      <Feather name="refresh-cw" size={14} color={colors.primary} />
                      <Text style={styles.compActionText}>Trocar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.compAction} onPress={() => setComprovanteUri(null)}>
                      <Feather name="trash-2" size={14} color={colors.error} />
                      <Text style={[styles.compActionText, { color: colors.error }]}>Remover</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.compAttach} onPress={askComprovanteSource}>
                    <Feather name="paperclip" size={16} color={colors.primary} />
                    <Text style={styles.compAttachText}>Anexar comprovante</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : null}

            {/* Botões */}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, (!titulo.trim() || saving) && { opacity: 0.5 }]}
                onPress={handleSave}
                disabled={!titulo.trim() || saving}
              >
                <Text style={styles.saveText}>{saving ? 'Salvando...' : 'Salvar'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Relatório por período (FB7) */}
      <Modal visible={showReport} transparent animationType="slide" onRequestClose={() => setShowReport(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.modalOverlay}>
          <View style={[styles.reportContent, { paddingBottom: spacing.xxl + insets.bottom }]}>
            <Text style={styles.modalTitle}>Relatório por Período</Text>
            <Text style={styles.modalDate}>Escolha o intervalo (pode ser mais de um mês)</Text>

            <Text style={styles.fieldLabel}>De</Text>
            <TextInput
              style={styles.textInput}
              value={reportStart}
              onChangeText={(t) => setReportStart(formatDateInput(t))}
              placeholder="DD/MM/AAAA"
              keyboardType="number-pad"
              maxLength={10}
              placeholderTextColor={colors.textLight}
            />

            <Text style={styles.fieldLabel}>Até</Text>
            <TextInput
              style={styles.textInput}
              value={reportEnd}
              onChangeText={(t) => setReportEnd(formatDateInput(t))}
              placeholder="DD/MM/AAAA"
              keyboardType="number-pad"
              maxLength={10}
              placeholderTextColor={colors.textLight}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowReport(false)}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, generating && { opacity: 0.5 }]}
                onPress={handleGenerateReport}
                disabled={generating}
              >
                {generating ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.saveText}>Gerar PDF</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 72,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  propSelector: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  propPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  propPillSelected: {
    backgroundColor: colors.primary,
  },
  propPillDefault: {
    backgroundColor: colors.surfaceVariant,
  },
  propPillText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  propPillTextSelected: {
    color: colors.white,
  },
  propPillTextDefault: {
    color: colors.text,
  },
  weatherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  weatherInfo: { flex: 1, gap: 4 },
  weatherRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  weatherTemp: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text },
  weatherRain: { fontSize: fontSize.sm, color: colors.info },
  confidenceDot: { width: 8, height: 8, borderRadius: 4 },
  confidenceText: { fontSize: fontSize.xs, fontWeight: '500' },
  daySection: { padding: spacing.md },
  atividadeActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 4 },
  daySectionTitle: { fontSize: fontSize.md, fontWeight: '600', color: colors.text, marginBottom: spacing.md, textTransform: 'capitalize' },
  emptyDay: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  emptyDayText: { fontSize: fontSize.sm, color: colors.textLight },
  atividadeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  atividadeBadge: { width: 4, height: '100%', borderRadius: 2, marginRight: spacing.md, minHeight: 36 },
  atividadeTitulo: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  atividadeTipo: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  atividadeDesc: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 4 },
  atividadeCusto: { fontSize: fontSize.sm, fontWeight: '600', color: colors.primary },
  fab: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  modalTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text, textAlign: 'center' },
  modalDate: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.xs, marginTop: spacing.md },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  selectText: { flex: 1, fontSize: fontSize.md, color: colors.text },
  tipoDot: { width: 12, height: 12, borderRadius: 6 },
  tipoList: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
  },
  tipoItem: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm },
  tipoItemActive: { backgroundColor: colors.surfaceVariant },
  tipoItemText: { fontSize: fontSize.md, color: colors.text },
  textInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.text,
  },
  custoWrapper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  custoPrefix: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  custoHint: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: spacing.xs },
  compAttach: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: borderRadius.md, padding: spacing.md, justifyContent: 'center' },
  compAttachText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
  compRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  compThumb: { width: 56, height: 56, borderRadius: borderRadius.sm, backgroundColor: colors.surfaceVariant },
  compAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  compActionText: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '500' },
  reportContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalButtons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  saveButton: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { fontSize: fontSize.md, fontWeight: '600', color: colors.white },
  custoTotalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  custoTotalLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },
  custoTotalValue: { fontSize: fontSize.lg, fontWeight: '700', color: colors.primary },
});
