import RNDateTimePicker from '@react-native-community/datetimepicker';
import Slider from '@react-native-community/slider';
import { addDays, addHours, addWeeks, format, isSameDay, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
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
import type { Evento, Recurrence, Todo } from '@/lib/supabase';
import { shouldShowOnDate } from '@/utils/recurrence';

const RECURRENCE_OPTIONS: { value: Recurrence; label: string }[] = [
  { value: 'none', label: 'Nunca' },
  { value: 'daily', label: 'Diario' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Bisemanal' },
  { value: 'monthly', label: 'Mensual' },
  { value: 'yearly', label: 'Anual' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function getTodayString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function getFriendlyDateString(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00');
  if (isSameDay(date, new Date())) {
    return `Hoy, ${format(date, 'd MMM', { locale: es })}`;
  }
  return format(date, 'EEEE d MMM', { locale: es }); // e.g. "lunes 14 feb"
}

function getWeekDays(startDate: Date) {
  const start = startOfWeek(startDate, { weekStartsOn: 1 }); // Monday
  return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
}

/** Build a Date for the given YYYY-MM-DD string at a specific hour */
function buildDateAtHour(dateStr: string, hour: number): Date {
  const d = new Date(dateStr + 'T00:00:00');
  d.setHours(hour, 0, 0, 0);
  return d;
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
  const { events, loading, error, fetchEvents, addEvent, updateEvent, deleteEvent, addExceptionDate } = useEvents();
  const { todos, loading: todosLoading, fetchTodos, addTodo, toggleTodo, updateTodo } = useTodos();
  const { wellness, loading: wellnessLoading, error: wellnessError, fetchWellness, upsertField } = useWellness();

  // Log wellness errors for debugging
  if (wellnessError) console.error('[Wellness]', wellnessError);

  const [selectedDate, setSelectedDate] = useState(getTodayString);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [isScrollEnabled, setScrollEnabled] = useState(true);

  // ── Calendar modal ──────────────────────────────────────────────────────
  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [modalSelectedDate, setModalSelectedDate] = useState(getTodayString); // To track selection inside modal before confirming

  // ── Evento modal ────────────────────────────────────────────────────────
  const [modalVisible, setModalVisible] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Evento | null>(null);
  const [esTodoDia, setEsTodoDia] = useState(true);
  const [fechaInicio, setFechaInicio] = useState<Date>(() => buildDateAtHour(getTodayString(), 9));
  const [fechaFin, setFechaFin] = useState<Date>(() => buildDateAtHour(getTodayString(), 10));
  const [videoUrl, setVideoUrl] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('none');

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

  // ── Cargar datos cuando cambie el día O cuando la pantalla gane foco ────
  useFocusEffect(
    useCallback(() => {
      fetchEvents();
      if (selectedDate) {
        fetchTodos(selectedDate);
        fetchWellness(selectedDate);
      }
    }, [selectedDate, fetchEvents, fetchTodos, fetchWellness])
  );

  // ── markedDates ─────────────────────────────────────────────────────────

  // Event-only marks (no selection – used by Calendar modal dots)
  // Projects recurring events onto a ±45-day window from today
  const eventMarks = useMemo(() => {
    const marks: Record<
      string,
      { marked: boolean; dotColor: string; selectedColor?: string; selected?: boolean }
    > = {};

    const today = new Date();
    const rangeStart = addDays(today, -45);
    const RANGE_DAYS = 90;

    for (let i = 0; i < RANGE_DAYS; i++) {
      const d = addDays(rangeStart, i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const hasEvent = events.some((evt) => shouldShowOnDate(evt, dateStr));
      if (hasEvent) {
        marks[dateStr] = { marked: true, dotColor: COLORS.primary };
      }
    }

    return marks;
  }, [events]);

  // Full markedDates (events + selected day highlight)
  const markedDates = useMemo(() => {
    const marks = { ...eventMarks };

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
  }, [eventMarks, selectedDate]);

  // ── Event handlers ──────────────────────────────────────────────────────

  // ── Event handlers ──────────────────────────────────────────────────────

  const handleDayPress = (day: DateData) => setSelectedDate(day.dateString);


  const handleCalendarDayPress = (day: DateData) => {
    setModalSelectedDate(day.dateString);
  };

  const confirmCalendarSelection = () => {
    setSelectedDate(modalSelectedDate);
    setCurrentWeekStart(startOfWeek(new Date(modalSelectedDate + 'T00:00:00'), { weekStartsOn: 1 }));
    setCalendarModalVisible(false);
    // Open create event modal using modalSelectedDate directly (not stale selectedDate)
    setTimeout(() => {
      resetEventModal();
      setFechaInicio(buildDateAtHour(modalSelectedDate, 9));
      setFechaFin(buildDateAtHour(modalSelectedDate, 10));
      setModalVisible(true);
    }, 300);
  };

  const handleWeekDayPress = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    setSelectedDate(dateStr);
  };

  const handlePrevWeek = () => setCurrentWeekStart((prev) => addWeeks(prev, -1));
  const handleNextWeek = () => setCurrentWeekStart((prev) => addWeeks(prev, 1));

  const weekDays = useMemo(() => getWeekDays(currentWeekStart), [currentWeekStart]);

  const resetEventModal = () => {
    setTitulo('');
    setDescripcion('');
    setEsTodoDia(true);
    setFechaInicio(buildDateAtHour(selectedDate, 9));
    setFechaFin(buildDateAtHour(selectedDate, 10));
    setVideoUrl('');
    setRecurrence('none');
    setEditingEvent(null);
  };

  const handleAddNew = () => {
    resetEventModal();
    setFechaInicio(buildDateAtHour(selectedDate, 9));
    setFechaFin(buildDateAtHour(selectedDate, 10));
    setModalVisible(true);
  };

  // ── Date picker change handlers ──────────────────────────────────────

  const handleStartDateChange = (_event: unknown, date?: Date) => {
    if (!date) return;
    setFechaInicio(date);
    // Auto-adjust: if new start >= end, push end to start + 1h
    if (date >= fechaFin) {
      setFechaFin(addHours(date, 1));
    }
  };

  const handleEndDateChange = (_event: unknown, date?: Date) => {
    if (!date) return;
    // Only accept if end > start
    if (date <= fechaInicio) {
      setFechaFin(addHours(fechaInicio, 1));
    } else {
      setFechaFin(date);
    }
  };


  const handleEdit = (evento: Evento) => {
    setEditingEvent(evento);
    setTitulo(evento.titulo ?? '');
    setDescripcion(evento.descripcion ?? '');
    setEsTodoDia(evento.es_todo_el_dia ?? true);
    setVideoUrl(evento.video_url ?? '');
    setRecurrence(evento.recurrence ?? 'none');

    // Build a safe fecha fallback
    const safeFecha = evento.fecha || getTodayString();

    // Parse existing time strings back into Date objects
    if (evento.hora_inicio && evento.hora_fin) {
      try {
        const [startH, startM] = evento.hora_inicio.split(':').map(Number);
        const [endH, endM] = evento.hora_fin.split(':').map(Number);
        const startDate = new Date(safeFecha + 'T00:00:00');
        startDate.setHours(startH, startM, 0, 0);
        const endDate = new Date(safeFecha + 'T00:00:00');
        endDate.setHours(endH, endM, 0, 0);
        setFechaInicio(startDate);
        setFechaFin(endDate);
      } catch {
        // Fallback if time parsing fails
        setFechaInicio(buildDateAtHour(safeFecha, 9));
        setFechaFin(buildDateAtHour(safeFecha, 10));
      }
    } else {
      setFechaInicio(buildDateAtHour(safeFecha, 9));
      setFechaFin(buildDateAtHour(safeFecha, 10));
    }

    setModalVisible(true);
  };

  const handleEditFromModal = (evento: Evento) => {
    // Close the calendar modal FIRST, then open edit modal after a short delay
    setCalendarModalVisible(false);
    setTimeout(() => {
      handleEdit(evento);
    }, 350);
  };

  const handleJoinVideo = (url: string | null | undefined) => {
    if (!url || !url.trim()) {
      Alert.alert('Error', 'No hay enlace de videollamada.');
      return;
    }
    let safeUrl = url.trim();
    if (!safeUrl.startsWith('http://') && !safeUrl.startsWith('https://')) {
      safeUrl = 'https://' + safeUrl;
    }
    try {
      Linking.openURL(safeUrl).catch(() => {
        Alert.alert('Error', 'No se pudo abrir el enlace.');
      });
    } catch {
      Alert.alert('Error', 'Enlace inválido.');
    }
  };

  const handleDelete = (evento: Evento, dateContext?: string) => {
    const isRecurring = (evento.recurrence ?? 'none') !== 'none';

    if (!isRecurring) {
      // Non-recurring: simple confirmation
      if (Platform.OS === 'web') {
        if (window.confirm(`¿Eliminar "${evento.titulo}"?`)) deleteEvent(evento.id);
      } else {
        Alert.alert('Eliminar evento', `¿Eliminar "${evento.titulo}"?`, [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: () => deleteEvent(evento.id) },
        ]);
      }
      return;
    }

    // Recurring: 3-option alert
    const exceptionDate = dateContext || selectedDate;
    Alert.alert(
      'Eliminar evento recurrente',
      `"${evento.titulo}" se repite. ¿Qué deseas hacer?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Solo este día',
          onPress: () => addExceptionDate(evento.id, exceptionDate),
        },
        {
          text: 'Todos los futuros',
          style: 'destructive',
          onPress: () => deleteEvent(evento.id),
        },
      ]
    );
  };

  const handleDeleteFromModal = (evento: Evento) => {
    handleDelete(evento, modalSelectedDate);
  };

  const handleSave = async () => {
    if (!titulo.trim()) return;

    // The date is always the selectedDate (already chosen before opening modal)
    const fechaStr = selectedDate;
    const horaInicioStr = format(fechaInicio, 'HH:mm');
    const horaFinStr = format(fechaFin, 'HH:mm');

    setSaving(true);
    if (editingEvent) {
      await updateEvent({
        id: editingEvent.id,
        user_id: editingEvent.user_id,
        fecha: fechaStr,
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        es_todo_el_dia: esTodoDia,
        hora_inicio: esTodoDia ? null : horaInicioStr,
        hora_fin: esTodoDia ? null : horaFinStr,
        video_url: videoUrl.trim() || null,
        recurrence,
        exception_dates: editingEvent.exception_dates ?? null,
      });
    } else {
      await addEvent({
        titulo: titulo.trim(),
        descripcion: descripcion.trim(),
        fecha: fechaStr,
        es_todo_el_dia: esTodoDia,
        hora_inicio: esTodoDia ? null : horaInicioStr,
        hora_fin: esTodoDia ? null : horaFinStr,
        video_url: videoUrl.trim() || null,
        recurrence,
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
        .filter((e) => shouldShowOnDate(e, selectedDate))
        .sort((a, b) => {
          if (a.es_todo_el_dia && !b.es_todo_el_dia) return 1;
          if (!a.es_todo_el_dia && b.es_todo_el_dia) return -1;
          return (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? '');
        }),
    [events, selectedDate]
  );


  const modalDateEvents = useMemo(
    () => events.filter((e) => shouldShowOnDate(e, modalSelectedDate)),
    [events, modalSelectedDate]
  );

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header Minimalista */}
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.headerDate}>{getFriendlyDateString(selectedDate)}</Text>
          <Text style={styles.headerSubtitle}>Tu agenda diaria</Text>
        </View>
        <Pressable
          style={styles.headerAddButton}
          onPress={() => {
            setModalSelectedDate(selectedDate); // Initialize modal with current selection
            setCalendarModalVisible(true);
          }}
        >
          <Text style={styles.headerAddButtonText}>+ Agendar</Text>
        </Pressable>
      </View>

      {/* WeekStrip */}
      <View style={styles.weekStripContainer}>
        <Pressable onPress={handlePrevWeek} style={styles.weekNavButton} hitSlop={12}>
          <Text style={styles.weekNavText}>{'<'}</Text>
        </Pressable>
        <View style={styles.weekDaysRow}>
          {weekDays.map((date) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const isSelected = dateStr === selectedDate;
            const isToday = isSameDay(date, new Date());
            const hasEvent = events.some((evt) => shouldShowOnDate(evt, dateStr));

            return (
              <Pressable
                key={dateStr}
                style={[
                  styles.weekDayItem,
                  isSelected && styles.weekDayItemSelected,
                  !isSelected && isToday && styles.weekDayItemToday,
                ]}
                onPress={() => handleWeekDayPress(date)}
              >
                <Text style={[
                  styles.weekDayName,
                  isSelected && styles.weekDayTextSelected,
                  !isSelected && isToday && styles.weekDayTextToday,
                ]}>
                  {format(date, 'EEE', { locale: es })}
                </Text>
                <Text style={[
                  styles.weekDayNumber,
                  isSelected && styles.weekDayTextSelected,
                  !isSelected && isToday && styles.weekDayTextToday,
                ]}>
                  {format(date, 'd')}
                </Text>

                {/* Event Dot Indicator */}
                {hasEvent && (
                  <View style={[
                    styles.weekDayDot,
                    isSelected ? { backgroundColor: '#FFFFFF' } : { backgroundColor: COLORS.primary }
                  ]} />
                )}
              </Pressable>
            );
          })}
        </View>
        <Pressable onPress={handleNextWeek} style={styles.weekNavButton} hitSlop={12}>
          <Text style={styles.weekNavText}>{'>'}</Text>
        </Pressable>
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

        {/* Cuerpo del Dashboard */}
        <View style={styles.daySectionContainer}>

          {/* ── Eventos ── */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📅 Eventos</Text>
          </View>

          {dayEvents.length === 0 ? (
            <Text style={styles.noItemsText}>Sin eventos para este día</Text>
          ) : (
            dayEvents.map((evento) => (
              <View key={evento.id} style={styles.eventCard}>
                <View style={styles.eventInfo}>
                  <View style={styles.eventTitleRow}>
                    <Text style={styles.eventTitle}>{evento.titulo}</Text>
                    {evento.recurrence && evento.recurrence !== 'none' && (
                      <Text style={styles.recurrenceBadge}>🔄</Text>
                    )}
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
                  {evento.video_url ? (
                    <Pressable style={styles.joinButton} onPress={() => handleJoinVideo(evento.video_url)}>
                      <Text style={styles.joinButtonText}>📹 Unirse</Text>
                    </Pressable>
                  ) : null}
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
      </ScrollView>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* Modal: CALENDARIO SELECCIÓN */}
      <Modal visible={calendarModalVisible} transparent animationType="fade" onRequestClose={() => setCalendarModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentCentered}>
            <View style={[styles.modalContent, { maxHeight: '85%' }]}>
              <Text style={styles.modalTitle}>Selecciona fecha</Text>
              <View style={{ height: 16 }} />
              <Calendar
                key={modalSelectedDate}
                initialDate={modalSelectedDate}
                markedDates={{
                  ...eventMarks,
                  [modalSelectedDate]: {
                    ...eventMarks[modalSelectedDate],
                    selected: true,
                    selectedColor: COLORS.primary,
                    selectedTextColor: '#FFFFFF',
                  },
                }}
                onDayPress={handleCalendarDayPress}
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

              {/* Event Preview List */}
              <View style={styles.modalPreviewContainer}>
                <Text style={styles.modalPreviewTitle}>Eventos para el {format(new Date(modalSelectedDate + 'T00:00:00'), 'd MMM', { locale: es })}:</Text>
                <ScrollView style={{ maxHeight: 100, marginBottom: 12 }}>
                  {modalDateEvents.length === 0 ? (
                    <Text style={styles.noItemsText}>Sin eventos agendados.</Text>
                  ) : (
                    modalDateEvents.map(evt => (
                      <View key={evt.id} style={styles.miniEventRow}>
                        <View style={styles.miniEventInfo}>
                          <View style={[styles.miniEventDot, { backgroundColor: COLORS.primary }]} />
                          <Text style={styles.miniEventTitle} numberOfLines={1}>{evt.titulo}</Text>
                          <Text style={styles.miniEventTime}>
                            {evt.es_todo_el_dia ? 'Todo el día' : (evt.hora_inicio ?? 'Sin hora')}
                          </Text>
                        </View>
                        <View style={styles.miniEventActions}>
                          <Pressable style={styles.miniActionButton} onPress={() => handleEditFromModal(evt)} hitSlop={8}>
                            <Text style={styles.miniActionText}>✎</Text>
                          </Pressable>
                          <Pressable style={[styles.miniActionButton, styles.miniDeleteButton]} onPress={() => handleDeleteFromModal(evt)} hitSlop={8}>
                            <Text style={[styles.miniActionText, { color: COLORS.error }]}>✕</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))
                  )}
                </ScrollView>
              </View>

              <View style={styles.modalButtons}>
                <Pressable style={[styles.button, styles.buttonCancel]} onPress={() => setCalendarModalVisible(false)}>
                  <Text style={styles.buttonCancelText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, styles.buttonSave]}
                  onPress={confirmCalendarSelection}
                >
                  <Text style={styles.buttonSaveText}>Confirmar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* Modal: EVENTO */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={handleCancelEvent}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{editingEvent ? 'Editar Evento' : 'Nuevo Evento'}</Text>
              <Text style={styles.modalDate}>
                {esTodoDia
                  ? format(fechaInicio, 'dd/MM/yyyy')
                  : `${format(fechaInicio, 'dd/MM/yyyy HH:mm')} – ${format(fechaFin, 'HH:mm')}`}
              </Text>

              <Text style={styles.inputLabel}>Título</Text>
              <TextInput style={styles.input} placeholder="Ej: Reunión de equipo" placeholderTextColor={COLORS.textSecondary} value={titulo} onChangeText={setTitulo} autoFocus />

              <Text style={styles.inputLabel}>Descripción</Text>
              <TextInput style={[styles.input, styles.inputMultiline]} placeholder="Agrega detalles (opcional)" placeholderTextColor={COLORS.textSecondary} value={descripcion} onChangeText={setDescripcion} multiline numberOfLines={3} textAlignVertical="top" />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Todo el día</Text>
                <Switch value={esTodoDia} onValueChange={setEsTodoDia} trackColor={{ false: COLORS.border, true: COLORS.primaryLight }} thumbColor={esTodoDia ? COLORS.primary : '#F4F3F4'} />
              </View>

              <Text style={styles.inputLabel}>Enlace de videollamada</Text>
              <TextInput style={styles.input} placeholder="https://zoom.us/j/..." placeholderTextColor={COLORS.textSecondary} value={videoUrl} onChangeText={setVideoUrl} keyboardType="url" autoCapitalize="none" autoCorrect={false} />

              <Text style={styles.inputLabel}>Repetir evento</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recurrenceScroll}>
                <View style={styles.recurrenceRow}>
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.value}
                      style={[styles.recurrenceChip, recurrence === opt.value && styles.recurrenceChipActive]}
                      onPress={() => setRecurrence(opt.value)}
                    >
                      <Text style={[styles.recurrenceChipText, recurrence === opt.value && styles.recurrenceChipTextActive]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>

              {!esTodoDia && (
                /* ── Solo selectores de HORA ── */
                <View style={styles.datePickerSection}>
                  <View style={styles.datePickerRow}>
                    <Text style={styles.datePickerLabel}>🟢 Desde</Text>
                    <RNDateTimePicker
                      value={fechaInicio}
                      mode="time"
                      display="compact"
                      onChange={handleStartDateChange}
                      locale="es-ES"
                      accentColor={COLORS.primary}
                    />
                  </View>
                  <View style={styles.datePickerDivider} />
                  <View style={styles.datePickerRow}>
                    <Text style={styles.datePickerLabel}>🔴 Hasta</Text>
                    <RNDateTimePicker
                      value={fechaFin}
                      mode="time"
                      display="compact"
                      minimumDate={fechaInicio}
                      onChange={handleEndDateChange}
                      locale="es-ES"
                      accentColor={COLORS.primary}
                    />
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

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerDate: { fontSize: 28, fontWeight: '700', color: COLORS.text },
  headerSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  headerAddButton: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  headerAddButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 15,
  },

  // WeekStrip Styles
  weekStripContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  weekNavButton: {
    padding: 10,
  },
  weekNavText: {
    fontSize: 18,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
    paddingHorizontal: 4,
  },
  weekDayItem: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 12,
    minWidth: 40,
  },
  weekDayItemSelected: {
    backgroundColor: COLORS.primary,
  },
  weekDayItemToday: {
    backgroundColor: COLORS.primaryLight,
  },
  weekDayName: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  weekDayNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  weekDayTextSelected: {
    color: '#FFFFFF',
  },
  weekDayTextToday: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  weekDayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 4,
  },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 8 },
  statusText: { fontSize: 13, color: COLORS.textSecondary },

  scrollArea: { flex: 1 },

  calendar: { borderRadius: 16 },

  daySectionContainer: { marginTop: 10, paddingHorizontal: 20, paddingBottom: 32 },
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

  // Date picker styles
  datePickerSection: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  datePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  datePickerLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  datePickerDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 0,
  },

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

  // Modal Preview Styles
  modalPreviewContainer: {
    marginTop: 16,
    marginBottom: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  modalPreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  miniEventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8, // Increased spacing
    paddingVertical: 4,
  },
  miniEventInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  miniEventDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 8,
  },
  miniEventTitle: {
    fontSize: 14, // Slightly larger
    color: COLORS.text,
    flex: 1,
    marginRight: 8,
  },
  miniEventTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
    minWidth: 50,
    textAlign: 'right',
  },
  miniEventActions: {
    flexDirection: 'row',
    gap: 12, // Space between buttons
  },
  miniActionButton: {
    padding: 4,
  },
  miniDeleteButton: {},
  miniActionText: {
    fontSize: 16,
    color: COLORS.primary,
  },

  // Recurrence chips
  recurrenceScroll: { marginBottom: 16 },
  recurrenceRow: { flexDirection: 'row', gap: 8 },
  recurrenceChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.border,
  },
  recurrenceChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  recurrenceChipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  recurrenceChipTextActive: { color: '#FFFFFF' },

  // Video join button
  joinButton: {
    marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 8, backgroundColor: '#E0F2FE',
  },
  joinButtonText: { fontSize: 13, fontWeight: '600', color: '#0284C7' },

  // Recurrence badge on card
  recurrenceBadge: { fontSize: 14 }
});
