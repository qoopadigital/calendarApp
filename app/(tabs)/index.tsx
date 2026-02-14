import Slider from '@react-native-community/slider';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import WellnessCard from '@/components/WellnessCard';
import { useEvents } from '@/hooks/useEvents';
import { useTodos } from '@/hooks/useTodos';
import { useWellness } from '@/hooks/useWellness';
import type { Evento, Todo } from '@/lib/supabase';

// ── Helpers ─────────────────────────────────────────────────────────────────

function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

// ── Colores del tema ────────────────────────────────────────────────────────

const COLORS = {
  background: '#F8F9FA',
  surface: '#FFFFFF',
  primary: '#4A90D9',
  primaryDark: '#3A7BC8',
  primaryLight: '#E8F0FE',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  error: '#EF4444',
  danger: '#DC2626',
  dangerLight: '#FEE2E2',
  accent: '#10B981',
  accentLight: '#D1FAE5',
  water: '#3B82F6',
  steps: '#F59E0B',
  sleep: '#8B5CF6',
  overlay: 'rgba(0, 0, 0, 0.4)',
} as const;

// ── Wellness config ─────────────────────────────────────────────────────────

type WellnessFieldKey = 'agua_litros' | 'pasos' | 'horas_sueno';

interface WellnessConfig {
  key: WellnessFieldKey;
  emoji: string;
  label: string;
  unit: string;
  color: string;
  maxGoal: number;
  sliderMax: number;
  sliderStep: number;
}

const WELLNESS_FIELDS: WellnessConfig[] = [
  { key: 'agua_litros', emoji: '💧', label: 'Agua', unit: 'L', color: COLORS.water, maxGoal: 6, sliderMax: 6, sliderStep: 0.5 },
  { key: 'pasos', emoji: '👣', label: 'Pasos', unit: 'pasos', color: COLORS.steps, maxGoal: 10000, sliderMax: 20000, sliderStep: 500 },
  { key: 'horas_sueno', emoji: '🛌', label: 'Sueño', unit: 'h', color: COLORS.sleep, maxGoal: 8, sliderMax: 24, sliderStep: 1 },
];

// ── Pantalla principal ──────────────────────────────────────────────────────

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const { events, loading, error, addEvent, updateEvent, deleteEvent } = useEvents();
  const { todos, loading: todosLoading, fetchTodos, addTodo, toggleTodo, updateTodo } = useTodos();
  const { wellness, loading: wellnessLoading, fetchWellness, upsertField } = useWellness();

  const [selectedDate, setSelectedDate] = useState(getTodayString);
  const [isScrollEnabled, setScrollEnabled] = useState(true);

  // ── Evento modal ────────────────────────────────────────────────────────
  const [modalVisible, setModalVisible] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Evento | null>(null);
  const [esTodoDia, setEsTodoDia] = useState(true);
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFin, setHoraFin] = useState('');

  // ── Todo modal ──────────────────────────────────────────────────────────
  const [todoModalVisible, setTodoModalVisible] = useState(false);
  const [todoTitulo, setTodoTitulo] = useState('');
  const [todoSaving, setTodoSaving] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);

  // ── Wellness modal ──────────────────────────────────────────────────────
  const [wellnessModalVisible, setWellnessModalVisible] = useState(false);
  const [activeWellnessField, setActiveWellnessField] = useState<WellnessConfig | null>(null);
  const [sliderValue, setSliderValue] = useState(0);
  const [wellnessSaving, setWellnessSaving] = useState(false);

  // ── Cargar datos cuando cambie el día ───────────────────────────────────
  useEffect(() => {
    if (selectedDate) {
      fetchTodos(selectedDate);
      fetchWellness(selectedDate);
    }
  }, [selectedDate, fetchTodos, fetchWellness]);

  // ── markedDates ─────────────────────────────────────────────────────────

  const markedDates = useMemo(() => {
    const marks: Record<
      string,
      { marked: boolean; dotColor: string; selectedColor?: string; selected?: boolean }
    > = {};

    events.forEach((evento: Evento) => {
      marks[evento.fecha] = { marked: true, dotColor: COLORS.primary };
    });

    if (selectedDate) {
      marks[selectedDate] = {
        ...marks[selectedDate],
        selected: true,
        selectedColor: COLORS.primary,
        marked: marks[selectedDate]?.marked ?? false,
        dotColor: marks[selectedDate]?.dotColor ?? COLORS.primary,
      };
    }

    return marks;
  }, [events, selectedDate]);

  // ── Event handlers ──────────────────────────────────────────────────────

  const handleDayPress = (day: DateData) => setSelectedDate(day.dateString);

  const resetEventModal = () => {
    setTitulo('');
    setDescripcion('');
    setEsTodoDia(true);
    setHoraInicio('');
    setHoraFin('');
    setEditingEvent(null);
  };

  const handleAddNew = () => { resetEventModal(); setModalVisible(true); };

  const handleEdit = (evento: Evento) => {
    setEditingEvent(evento);
    setTitulo(evento.titulo);
    setDescripcion(evento.descripcion);
    setEsTodoDia(evento.es_todo_el_dia);
    setHoraInicio(evento.hora_inicio ?? '');
    setHoraFin(evento.hora_fin ?? '');
    setModalVisible(true);
  };

  const handleDelete = (evento: Evento) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`¿Eliminar "${evento.titulo}"?`)) deleteEvent(evento.id);
    } else {
      Alert.alert('Eliminar evento', `¿Eliminar "${evento.titulo}"?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteEvent(evento.id) },
      ]);
    }
  };

  const handleSave = async () => {
    if (!titulo.trim()) return;
    if (!esTodoDia) {
      if (!isValidTime(horaInicio) || !isValidTime(horaFin)) {
        Alert.alert('Hora inválida', 'Formato HH:MM (ej: 09:30)');
        return;
      }
      if (horaInicio >= horaFin) {
        Alert.alert('Rango inválido', 'Inicio debe ser anterior a fin');
        return;
      }
    }
    setSaving(true);
    if (editingEvent) {
      await updateEvent({
        ...editingEvent,
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        es_todo_el_dia: esTodoDia,
        hora_inicio: esTodoDia ? null : horaInicio,
        hora_fin: esTodoDia ? null : horaFin,
      });
    } else {
      await addEvent({
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        fecha: selectedDate,
        es_todo_el_dia: esTodoDia,
        hora_inicio: esTodoDia ? null : horaInicio,
        hora_fin: esTodoDia ? null : horaFin,
      });
    }
    setSaving(false);
    setModalVisible(false);
    resetEventModal();
  };

  const handleCancelEvent = () => { setModalVisible(false); resetEventModal(); };

  // ── Todo handlers ───────────────────────────────────────────────────────

  const handleAddTodo = () => { setEditingTodo(null); setTodoTitulo(''); setTodoModalVisible(true); };

  const handleEditTodo = (todo: Todo) => {
    setEditingTodo(todo);
    setTodoTitulo(todo.titulo);
    setTodoModalVisible(true);
  };

  const handleSaveTodo = async () => {
    if (!todoTitulo.trim()) return;
    setTodoSaving(true);
    if (editingTodo) {
      await updateTodo(editingTodo.id, todoTitulo.trim());
    } else {
      await addTodo(todoTitulo.trim(), selectedDate);
    }
    setTodoSaving(false);
    setTodoModalVisible(false);
    setEditingTodo(null);
    setTodoTitulo('');
  };

  const handleCancelTodo = () => { setTodoModalVisible(false); setEditingTodo(null); setTodoTitulo(''); };

  // ── Wellness handlers ───────────────────────────────────────────────────

  const handleOpenWellness = (config: WellnessConfig) => {
    setActiveWellnessField(config);
    const currentVal = wellness?.[config.key] ?? 0;
    setSliderValue(currentVal);
    setWellnessModalVisible(true);
  };

  const handleSaveWellness = async () => {
    if (!activeWellnessField) return;
    setWellnessSaving(true);
    await upsertField(selectedDate, activeWellnessField.key, sliderValue);
    setWellnessSaving(false);
    setWellnessModalVisible(false);
    setActiveWellnessField(null);
  };

  const handleCancelWellness = () => {
    setWellnessModalVisible(false);
    setActiveWellnessField(null);
  };

  // ── Filtered data ───────────────────────────────────────────────────────

  const dayEvents = useMemo(
    () =>
      events
        .filter((e) => e.fecha === selectedDate)
        .sort((a, b) => {
          if (a.es_todo_el_dia && !b.es_todo_el_dia) return 1;
          if (!a.es_todo_el_dia && b.es_todo_el_dia) return -1;
          return (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? '');
        }),
    [events, selectedDate]
  );

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mi Calendario</Text>
        <Text style={styles.headerSubtitle}>Toca un día para ver o agregar eventos</Text>
      </View>

      {loading && (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.statusText}>Cargando…</Text>
        </View>
      )}

      {error && (
        <View style={styles.statusRow}>
          <Text style={[styles.statusText, { color: COLORS.error }]}>⚠ {error}</Text>
        </View>
      )}

      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false} scrollEnabled={isScrollEnabled}>
        {/* Calendario */}
        <View style={styles.calendarWrapper}>
          <Calendar
            markedDates={markedDates}
            onDayPress={handleDayPress}
            enableSwipeMonths
            theme={{
              backgroundColor: COLORS.surface,
              calendarBackground: COLORS.surface,
              textSectionTitleColor: COLORS.textSecondary,
              selectedDayBackgroundColor: COLORS.primary,
              selectedDayTextColor: '#FFFFFF',
              todayTextColor: COLORS.primary,
              dayTextColor: COLORS.text,
              textDisabledColor: '#D1D5DB',
              dotColor: COLORS.primary,
              selectedDotColor: '#FFFFFF',
              arrowColor: COLORS.primary,
              monthTextColor: COLORS.text,
              textDayFontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
              textMonthFontFamily: Platform.select({ ios: 'System', android: 'sans-serif-medium' }),
              textDayHeaderFontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
              textDayFontSize: 15,
              textMonthFontSize: 17,
              textDayHeaderFontSize: 13,
            }}
            style={styles.calendar}
          />
        </View>

        {selectedDate && (
          <View style={styles.daySectionContainer}>

            {/* ── Eventos ── */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📅 Eventos</Text>
              <Pressable style={styles.addButton} onPress={handleAddNew}>
                <Text style={styles.addButtonText}>+ Nuevo</Text>
              </Pressable>
            </View>

            {dayEvents.length === 0 ? (
              <Text style={styles.noItemsText}>Sin eventos para este día</Text>
            ) : (
              dayEvents.map((evento) => (
                <View key={evento.id} style={styles.eventCard}>
                  <View style={styles.eventInfo}>
                    <View style={styles.eventTitleRow}>
                      <Text style={styles.eventTitle}>{evento.titulo}</Text>
                      {!evento.es_todo_el_dia && evento.hora_inicio && evento.hora_fin && (
                        <View style={styles.timeBadge}>
                          <Text style={styles.timeBadgeText}>
                            {evento.hora_inicio} – {evento.hora_fin}
                          </Text>
                        </View>
                      )}
                    </View>
                    {evento.es_todo_el_dia && <Text style={styles.allDayLabel}>Todo el día</Text>}
                    {evento.descripcion ? <Text style={styles.eventDesc}>{evento.descripcion}</Text> : null}
                  </View>
                  <View style={styles.eventActions}>
                    <Pressable style={styles.actionButton} onPress={() => handleEdit(evento)} hitSlop={8}>
                      <Text style={styles.editText}>✎</Text>
                    </Pressable>
                    <Pressable style={[styles.actionButton, styles.deleteButton]} onPress={() => handleDelete(evento)} hitSlop={8}>
                      <Text style={styles.deleteText}>✕</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}

            {/* ── To Do ── */}
            <View style={[styles.sectionHeader, { marginTop: 24 }]}>
              <Text style={styles.sectionTitle}>☑ To Do</Text>
              <Pressable style={[styles.addButton, { backgroundColor: COLORS.accent }]} onPress={handleAddTodo}>
                <Text style={styles.addButtonText}>+ Tarea</Text>
              </Pressable>
            </View>

            {todosLoading ? (
              <ActivityIndicator size="small" color={COLORS.accent} style={{ marginTop: 8 }} />
            ) : todos.length === 0 ? (
              <Text style={styles.noItemsText}>Sin tareas pendientes</Text>
            ) : (
              todos.map((todo) => (
                <View key={todo.id} style={styles.todoRow}>
                  <Pressable style={styles.todoCircle} onPress={() => toggleTodo(todo.id, todo.completado)} hitSlop={8}>
                    <View style={styles.todoCircleInner} />
                  </Pressable>
                  <Text style={styles.todoTitle} numberOfLines={1} ellipsizeMode="tail">
                    {todo.titulo}
                  </Text>
                  <Pressable style={styles.todoEditButton} onPress={() => handleEditTodo(todo)} hitSlop={8}>
                    <Text style={styles.todoEditText}>✎</Text>
                  </Pressable>
                </View>
              ))
            )}

            {/* ── Wellness Dashboard ── */}
            <View style={[styles.sectionHeader, { marginTop: 24 }]}>
              <Text style={styles.sectionTitle}>💪 Wellness</Text>
            </View>

            {wellnessLoading ? (
              <ActivityIndicator size="small" color={COLORS.water} style={{ marginTop: 8 }} />
            ) : (
              <View style={styles.wellnessRow}>
                {WELLNESS_FIELDS.map((cfg) => (
                  <Pressable key={cfg.key} style={{ flex: 1 }} onPress={() => handleOpenWellness(cfg)}>
                    <WellnessCard
                      emoji={cfg.emoji}
                      label={cfg.label}
                      value={wellness?.[cfg.key] ?? 0}
                      maxValue={cfg.maxGoal}
                      unit={cfg.unit}
                      color={cfg.color}
                    />
                  </Pressable>
                ))}
              </View>
            )}

          </View>
        )}
      </ScrollView>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* Modal: EVENTO */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={handleCancelEvent}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{editingEvent ? 'Editar Evento' : 'Nuevo Evento'}</Text>
              <Text style={styles.modalDate}>{editingEvent ? editingEvent.fecha : selectedDate}</Text>

              <Text style={styles.inputLabel}>Título</Text>
              <TextInput style={styles.input} placeholder="Ej: Reunión de equipo" placeholderTextColor={COLORS.textSecondary} value={titulo} onChangeText={setTitulo} autoFocus />

              <Text style={styles.inputLabel}>Descripción</Text>
              <TextInput style={[styles.input, styles.inputMultiline]} placeholder="Agrega detalles (opcional)" placeholderTextColor={COLORS.textSecondary} value={descripcion} onChangeText={setDescripcion} multiline numberOfLines={3} textAlignVertical="top" />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Todo el día</Text>
                <Switch value={esTodoDia} onValueChange={setEsTodoDia} trackColor={{ false: COLORS.border, true: COLORS.primaryLight }} thumbColor={esTodoDia ? COLORS.primary : '#F4F3F4'} />
              </View>

              {!esTodoDia && (
                <View style={styles.timeRow}>
                  <View style={styles.timeField}>
                    <Text style={styles.inputLabel}>Hora Inicio</Text>
                    <TextInput style={styles.input} placeholder="09:00" placeholderTextColor={COLORS.textSecondary} value={horaInicio} onChangeText={setHoraInicio} keyboardType="numbers-and-punctuation" maxLength={5} />
                  </View>
                  <View style={styles.timeField}>
                    <Text style={styles.inputLabel}>Hora Fin</Text>
                    <TextInput style={styles.input} placeholder="10:00" placeholderTextColor={COLORS.textSecondary} value={horaFin} onChangeText={setHoraFin} keyboardType="numbers-and-punctuation" maxLength={5} />
                  </View>
                </View>
              )}

              <View style={styles.modalButtons}>
                <Pressable style={[styles.button, styles.buttonCancel]} onPress={handleCancelEvent}>
                  <Text style={styles.buttonCancelText}>Cancelar</Text>
                </Pressable>
                <Pressable style={[styles.button, styles.buttonSave, (!titulo.trim() || saving) && styles.buttonDisabled]} onPress={handleSave} disabled={!titulo.trim() || saving}>
                  {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.buttonSaveText}>{editingEvent ? 'Actualizar' : 'Guardar'}</Text>}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: TO-DO */}
      <Modal visible={todoModalVisible} transparent animationType="fade" onRequestClose={handleCancelTodo}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContentCentered}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{editingTodo ? 'Editar Tarea' : 'Nueva Tarea'}</Text>
              <Text style={styles.modalDate}>{selectedDate}</Text>

              <Text style={styles.inputLabel}>Tarea</Text>
              <TextInput style={styles.input} placeholder="Ej: Comprar leche" placeholderTextColor={COLORS.textSecondary} value={todoTitulo} onChangeText={setTodoTitulo} autoFocus />

              <View style={styles.modalButtons}>
                <Pressable style={[styles.button, styles.buttonCancel]} onPress={handleCancelTodo}>
                  <Text style={styles.buttonCancelText}>Cancelar</Text>
                </Pressable>
                <Pressable style={[styles.button, styles.buttonSave, { backgroundColor: COLORS.accent }, (!todoTitulo.trim() || todoSaving) && styles.buttonDisabled]} onPress={handleSaveTodo} disabled={!todoTitulo.trim() || todoSaving}>
                  {todoSaving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.buttonSaveText}>{editingTodo ? 'Actualizar' : 'Guardar'}</Text>}
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal: WELLNESS SLIDER */}
      <Modal visible={wellnessModalVisible} transparent animationType="fade" onRequestClose={handleCancelWellness}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentCentered}>
            <View style={styles.modalContent}>
              {activeWellnessField && (
                <>
                  <Text style={styles.modalTitle}>
                    {activeWellnessField.emoji} {activeWellnessField.label}
                  </Text>
                  <Text style={styles.modalDate}>{selectedDate}</Text>

                  <Text style={styles.sliderValueText}>
                    {Number.isInteger(sliderValue) ? sliderValue.toLocaleString() : sliderValue.toFixed(1)}{' '}
                    {activeWellnessField.unit}
                  </Text>

                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={activeWellnessField.sliderMax}
                    step={activeWellnessField.sliderStep}
                    value={sliderValue}
                    onValueChange={setSliderValue}
                    onSlidingStart={() => setScrollEnabled(false)}
                    onSlidingComplete={() => setScrollEnabled(true)}
                    minimumTrackTintColor={activeWellnessField.color}
                    maximumTrackTintColor={COLORS.border}
                    thumbTintColor={activeWellnessField.color}
                  />

                  <View style={styles.sliderRange}>
                    <Text style={styles.sliderRangeText}>0</Text>
                    <Text style={styles.sliderRangeText}>
                      {activeWellnessField.sliderMax.toLocaleString()} {activeWellnessField.unit}
                    </Text>
                  </View>

                  <View style={styles.modalButtons}>
                    <Pressable style={[styles.button, styles.buttonCancel]} onPress={handleCancelWellness}>
                      <Text style={styles.buttonCancelText}>Cancelar</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.button, styles.buttonSave, { backgroundColor: activeWellnessField.color }, wellnessSaving && styles.buttonDisabled]}
                      onPress={handleSaveWellness}
                      disabled={wellnessSaving}
                    >
                      {wellnessSaving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.buttonSaveText}>Guardar</Text>}
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: COLORS.text },
  headerSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 8 },
  statusText: { fontSize: 13, color: COLORS.textSecondary },

  scrollArea: { flex: 1 },

  calendarWrapper: {
    marginHorizontal: 16, borderRadius: 16, overflow: 'hidden',
    backgroundColor: COLORS.surface,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  calendar: { borderRadius: 16 },

  daySectionContainer: { marginTop: 20, paddingHorizontal: 20, paddingBottom: 32 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  addButton: { backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  addButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  noItemsText: { fontSize: 14, color: COLORS.textSecondary, fontStyle: 'italic' },

  // Event cards
  eventCard: {
    backgroundColor: COLORS.surface, padding: 14, borderRadius: 12, marginBottom: 8,
    borderLeftWidth: 3, borderLeftColor: COLORS.primary, flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  eventInfo: { flex: 1 },
  eventTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  eventTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  timeBadge: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  timeBadgeText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  allDayLabel: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  eventDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  eventActions: { flexDirection: 'row', gap: 6, marginLeft: 10 },
  actionButton: { width: 36, height: 36, borderRadius: 8, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' },
  deleteButton: { backgroundColor: COLORS.dangerLight },
  editText: { fontSize: 16 },
  deleteText: { fontSize: 16 },

  // To-do rows
  todoRow: {
    backgroundColor: COLORS.surface, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, marginBottom: 6,
    borderLeftWidth: 3, borderLeftColor: COLORS.accent, flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  todoCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: COLORS.accent, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  todoCircleInner: { width: 0, height: 0, borderRadius: 5, backgroundColor: COLORS.accent },
  todoTitle: { flex: 1, fontSize: 15, color: COLORS.text },
  todoEditButton: { width: 32, height: 32, borderRadius: 8, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  todoEditText: { fontSize: 14, color: COLORS.textSecondary },

  // Wellness
  wellnessRow: { flexDirection: 'row', gap: 10 },

  // Modal shared
  modalOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'center' },
  modalScrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  modalContentCentered: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  modalContent: { backgroundColor: COLORS.surface, borderRadius: 20, padding: 24 },
  modalTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text },
  modalDate: { fontSize: 14, color: COLORS.primary, marginTop: 4, marginBottom: 20 },

  inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.text, backgroundColor: COLORS.background, marginBottom: 16 },
  inputMultiline: { minHeight: 80 },

  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingVertical: 4 },
  switchLabel: { fontSize: 15, fontWeight: '600', color: COLORS.text },

  timeRow: { flexDirection: 'row', gap: 12 },
  timeField: { flex: 1 },

  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 4 },
  button: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonCancel: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border },
  buttonCancelText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  buttonSave: { backgroundColor: COLORS.primary },
  buttonSaveText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  buttonDisabled: { opacity: 0.5 },

  // Slider modal
  sliderValueText: { fontSize: 28, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: 8 },
  slider: { width: '100%', height: 40, marginBottom: 4 },
  sliderRange: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  sliderRangeText: { fontSize: 12, color: COLORS.textSecondary },
});
