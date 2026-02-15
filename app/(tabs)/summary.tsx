import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useEvents } from '@/hooks/useEvents';
import { useTodos } from '@/hooks/useTodos';
import { useWellness } from '@/hooks/useWellness';
import type { Evento } from '@/lib/supabase';
import { shouldShowOnDate } from '@/utils/recurrence';

// ── Colors (matching Home) ──────────────────────────────────────────────────

const COLORS = {
    background: '#F8F9FA',
    surface: '#FFFFFF',
    primary: '#4A90D9',
    primaryDark: '#3A7BC8',
    primaryLight: '#E8F0FE',
    text: '#1A1A2E',
    textSecondary: '#6B7280',
    border: '#E5E7EB',
    accent: '#10B981',
    accentLight: '#D1FAE5',
    water: '#3B82F6',
    steps: '#F59E0B',
    sleep: '#8B5CF6',
    completed: '#9CA3AF',
    completedBg: '#F3F4F6',
} as const;

// ── Helper ──────────────────────────────────────────────────────────────────

function getTodayString(): string {
    return format(new Date(), 'yyyy-MM-dd');
}

// ── Summary Screen ──────────────────────────────────────────────────────────

export default function SummaryScreen() {
    const insets = useSafeAreaInsets();
    const today = getTodayString();

    const { events, loading: eventsLoading, fetchEvents } = useEvents();
    const { allTodos, loading: todosLoading, fetchAllTodos, toggleTodo } = useTodos();
    const { wellness, loading: wellnessLoading, fetchWellness } = useWellness();

    const [upcomingExpanded, setUpcomingExpanded] = useState(false);

    // Fetch data every time this tab gains focus
    useFocusEffect(
        useCallback(() => {
            fetchEvents();
            fetchAllTodos(today);
            fetchWellness(today);
        }, [today, fetchEvents, fetchAllTodos, fetchWellness])
    );

    // ── Derived data ────────────────────────────────────────────────────────

    const todayEvents = useMemo(
        () =>
            events
                .filter((e) => shouldShowOnDate(e, today))
                .sort((a, b) => {
                    if (a.es_todo_el_dia && !b.es_todo_el_dia) return 1;
                    if (!a.es_todo_el_dia && b.es_todo_el_dia) return -1;
                    return (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? '');
                }),
        [events, today]
    );

    const LOOK_AHEAD_DAYS = 30;

    const upcomingEvents = useMemo(() => {
        const projectedEvents: (Evento & { _projectedDate: string })[] = [];

        // Paso A: Eventos únicos (no recurrentes) con fecha futura
        events
            .filter((e) => (e.recurrence ?? 'none') === 'none' && e.fecha > today)
            .forEach((evt) => projectedEvents.push({ ...evt, _projectedDate: evt.fecha }));

        // Paso B: Proyección de eventos recurrentes día por día
        const recurringEvents = events.filter((e) => (e.recurrence ?? 'none') !== 'none');

        if (recurringEvents.length > 0) {
            const todayDate = new Date(today + 'T00:00:00');
            for (let i = 1; i <= LOOK_AHEAD_DAYS; i++) {
                const d = new Date(todayDate);
                d.setDate(d.getDate() + i);
                const dateStr = format(d, 'yyyy-MM-dd');

                recurringEvents.forEach((evt) => {
                    if (shouldShowOnDate(evt, dateStr)) {
                        projectedEvents.push({ ...evt, _projectedDate: dateStr });
                    }
                });
            }
        }

        // Ordenar cronológicamente, luego por hora
        projectedEvents.sort((a, b) => {
            const dateComp = a._projectedDate.localeCompare(b._projectedDate);
            if (dateComp !== 0) return dateComp;
            return (a.hora_inicio ?? '').localeCompare(b.hora_inicio ?? '');
        });

        // Agrupar por fecha
        const grouped: { date: string; label: string; events: Evento[] }[] = [];
        let currentDate = '';

        projectedEvents.forEach((evt) => {
            if (evt._projectedDate !== currentDate) {
                currentDate = evt._projectedDate;
                const d = new Date(currentDate + 'T00:00:00');
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const label = isSameDay(d, tomorrow)
                    ? `Mañana, ${format(d, 'd MMM', { locale: es })}`
                    : format(d, 'EEEE d MMM', { locale: es });
                grouped.push({ date: currentDate, label, events: [] });
            }
            grouped[grouped.length - 1].events.push(evt);
        });

        return grouped;
    }, [events, today]);

    const pendingTodos = useMemo(
        () => allTodos.filter((t) => !t.completado),
        [allTodos]
    );

    const completedTodos = useMemo(
        () => allTodos.filter((t) => t.completado),
        [allTodos]
    );

    // ── Render ──────────────────────────────────────────────────────────────

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Resumen</Text>
                <Text style={styles.headerSubtitle}>
                    {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
                </Text>
            </View>

            <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
                {/* ═══════════════════════════════════════════════════════════════════ */}
                {/* SECTION: Hoy de un vistazo */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🌟 Hoy de un vistazo</Text>

                    {/* Wellness mini-cards */}
                    {wellnessLoading ? (
                        <ActivityIndicator size="small" color={COLORS.water} style={{ marginTop: 8 }} />
                    ) : (
                        <View style={styles.wellnessRow}>
                            <View style={[styles.wellnessMini, { borderLeftColor: COLORS.water }]}>
                                <Text style={styles.wellnessEmoji}>💧</Text>
                                <Text style={styles.wellnessValue}>
                                    {wellness?.agua_litros ?? 0}<Text style={styles.wellnessUnit}> L</Text>
                                </Text>
                            </View>
                            <View style={[styles.wellnessMini, { borderLeftColor: COLORS.steps }]}>
                                <Text style={styles.wellnessEmoji}>👣</Text>
                                <Text style={styles.wellnessValue}>
                                    {(wellness?.pasos ?? 0).toLocaleString()}<Text style={styles.wellnessUnit}> pasos</Text>
                                </Text>
                            </View>
                            <View style={[styles.wellnessMini, { borderLeftColor: COLORS.sleep }]}>
                                <Text style={styles.wellnessEmoji}>🛌</Text>
                                <Text style={styles.wellnessValue}>
                                    {wellness?.horas_sueno ?? 0}<Text style={styles.wellnessUnit}> h</Text>
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* Today's events */}
                    <Text style={styles.subsectionTitle}>📅 Eventos de hoy</Text>
                    {eventsLoading ? (
                        <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 8 }} />
                    ) : todayEvents.length === 0 ? (
                        <Text style={styles.emptyText}>Sin eventos para hoy</Text>
                    ) : (
                        todayEvents.map((evt) => (
                            <View key={evt.id} style={styles.eventCard}>
                                <View style={styles.eventDot} />
                                <View style={styles.eventInfo}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={styles.eventTitle}>{evt.titulo}</Text>
                                        {evt.recurrence && evt.recurrence !== 'none' && (
                                            <Text style={{ fontSize: 13 }}>🔄</Text>
                                        )}
                                    </View>
                                    <Text style={styles.eventTime}>
                                        {evt.es_todo_el_dia
                                            ? 'Todo el día'
                                            : (evt.hora_inicio && evt.hora_fin)
                                                ? `${evt.hora_inicio} – ${evt.hora_fin}`
                                                : 'Sin hora'}
                                    </Text>
                                    {evt.video_url ? (
                                        <Pressable style={styles.joinButton} onPress={() => {
                                            const url = evt.video_url;
                                            if (!url || !url.trim()) return;
                                            let safeUrl = url.trim();
                                            if (!safeUrl.startsWith('http://') && !safeUrl.startsWith('https://')) {
                                                safeUrl = 'https://' + safeUrl;
                                            }
                                            Linking.openURL(safeUrl).catch(() => { });
                                        }}>
                                            <Text style={styles.joinButtonText}>📹 Unirse</Text>
                                        </Pressable>
                                    ) : null}
                                </View>
                            </View>
                        ))
                    )}
                </View>

                {/* ═══════════════════════════════════════════════════════════════════ */}
                {/* SECTION: Gestión de Tareas */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>☑ Gestión de Tareas</Text>

                    {todosLoading ? (
                        <ActivityIndicator size="small" color={COLORS.accent} style={{ marginTop: 8 }} />
                    ) : allTodos.length === 0 ? (
                        <Text style={styles.emptyText}>Sin tareas para hoy</Text>
                    ) : (
                        <>
                            {/* Pending todos */}
                            {pendingTodos.map((todo) => (
                                <Pressable
                                    key={todo.id}
                                    style={styles.todoRow}
                                    onPress={() => toggleTodo(todo.id, todo.completado)}
                                >
                                    <View style={styles.todoCircle}>
                                        <View style={styles.todoCircleEmpty} />
                                    </View>
                                    <Text style={styles.todoText}>{todo.titulo}</Text>
                                </Pressable>
                            ))}

                            {/* Completed todos */}
                            {completedTodos.length > 0 && (
                                <View style={styles.completedSection}>
                                    <Text style={styles.completedHeader}>
                                        Completadas ({completedTodos.length})
                                    </Text>
                                    {completedTodos.map((todo) => (
                                        <Pressable
                                            key={todo.id}
                                            style={[styles.todoRow, styles.todoRowCompleted]}
                                            onPress={() => toggleTodo(todo.id, todo.completado)}
                                        >
                                            <View style={[styles.todoCircle, styles.todoCircleChecked]}>
                                                <Text style={styles.checkmark}>✓</Text>
                                            </View>
                                            <Text style={[styles.todoText, styles.todoTextCompleted]}>
                                                {todo.titulo}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                            )}
                        </>
                    )}
                </View>

                {/* ═══════════════════════════════════════════════════════════════════ */}
                {/* SECTION: Próximos Eventos (Accordion) */}
                <View style={styles.section}>
                    <Pressable
                        style={styles.accordionHeader}
                        onPress={() => setUpcomingExpanded((prev) => !prev)}
                    >
                        <Text style={styles.sectionTitle}>📅 Próximos eventos</Text>
                        <Text style={styles.accordionArrow}>
                            {upcomingExpanded ? '▲' : '▼'}
                        </Text>
                    </Pressable>

                    {upcomingExpanded && (
                        <View style={styles.accordionContent}>
                            {upcomingEvents.length === 0 ? (
                                <Text style={styles.emptyText}>Sin eventos próximos</Text>
                            ) : (
                                upcomingEvents.map((group) => (
                                    <View key={group.date} style={styles.upcomingGroup}>
                                        <Text style={styles.upcomingDateLabel}>{group.label}</Text>
                                        {group.events.map((evt) => (
                                            <View key={evt.id} style={styles.upcomingEventRow}>
                                                <View style={styles.upcomingEventDot} />
                                                <Text style={styles.upcomingEventTitle} numberOfLines={1}>
                                                    {evt.titulo}
                                                </Text>
                                                <Text style={styles.upcomingEventTime}>
                                                    {evt.es_todo_el_dia
                                                        ? 'Todo el día'
                                                        : evt.hora_inicio ?? ''}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                ))
                            )}
                        </View>
                    )}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },

    header: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: COLORS.text,
    },
    headerSubtitle: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginTop: 4,
        textTransform: 'capitalize',
    },

    scrollArea: {
        flex: 1,
    },

    // ── Sections ──────────────────────────────────────────────────────────

    section: {
        marginHorizontal: 20,
        marginTop: 16,
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 1,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 14,
    },
    subsectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginTop: 18,
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    emptyText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        fontStyle: 'italic',
    },

    // ── Wellness mini-cards ───────────────────────────────────────────────

    wellnessRow: {
        flexDirection: 'row',
        gap: 10,
    },
    wellnessMini: {
        flex: 1,
        backgroundColor: COLORS.background,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderLeftWidth: 3,
        alignItems: 'center',
    },
    wellnessEmoji: {
        fontSize: 20,
        marginBottom: 4,
    },
    wellnessValue: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.text,
    },
    wellnessUnit: {
        fontSize: 12,
        fontWeight: '400',
        color: COLORS.textSecondary,
    },

    // ── Today's events ────────────────────────────────────────────────────

    eventCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: COLORS.background,
        borderRadius: 10,
        marginBottom: 6,
    },
    eventDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.primary,
        marginRight: 12,
    },
    eventInfo: {
        flex: 1,
    },
    eventTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: COLORS.text,
    },
    eventTime: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 2,
    },

    // ── Todos ─────────────────────────────────────────────────────────────

    todoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: COLORS.background,
        borderRadius: 10,
        marginBottom: 6,
    },
    todoRowCompleted: {
        backgroundColor: COLORS.completedBg,
    },
    todoCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: COLORS.accent,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    todoCircleEmpty: {
        width: 0,
        height: 0,
    },
    todoCircleChecked: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
    },
    checkmark: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    todoText: {
        flex: 1,
        fontSize: 15,
        color: COLORS.text,
    },
    todoTextCompleted: {
        textDecorationLine: 'line-through',
        color: COLORS.completed,
    },
    completedSection: {
        marginTop: 12,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        paddingTop: 12,
    },
    completedHeader: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.completed,
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    // ── Accordion ─────────────────────────────────────────────────────────

    accordionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    accordionArrow: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginBottom: 14,
    },
    accordionContent: {
        marginTop: 4,
    },

    // ── Upcoming events ───────────────────────────────────────────────────

    upcomingGroup: {
        marginBottom: 16,
    },
    upcomingDateLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.primary,
        marginBottom: 8,
        textTransform: 'capitalize',
    },
    upcomingEventRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: COLORS.background,
        borderRadius: 10,
        marginBottom: 4,
    },
    upcomingEventDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: COLORS.primary,
        marginRight: 10,
    },
    upcomingEventTitle: {
        flex: 1,
        fontSize: 14,
        color: COLORS.text,
    },
    upcomingEventTime: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginLeft: 8,
    },

    // Video join button
    joinButton: {
        marginTop: 4, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: 6, backgroundColor: '#E0F2FE',
    },
    joinButtonText: { fontSize: 12, fontWeight: '600', color: '#0284C7' },
});
