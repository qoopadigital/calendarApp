import { supabase, type Evento } from '@/lib/supabase';
import { useCallback, useEffect, useState } from 'react';

interface AddEventParams {
    titulo: string;
    descripcion: string;
    fecha: string;
    es_todo_el_dia: boolean;
    hora_inicio: string | null;
    hora_fin: string | null;
}

interface UseEventsReturn {
    events: Evento[];
    loading: boolean;
    error: string | null;
    fetchEvents: () => Promise<void>;
    addEvent: (params: AddEventParams) => Promise<void>;
    updateEvent: (evento: Evento) => Promise<void>;
    deleteEvent: (id: string) => Promise<void>;
}

export function useEvents(): UseEventsReturn {
    const [events, setEvents] = useState<Evento[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // ── Obtener todos los eventos ──────────────────────────────────────────

    const fetchEvents = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const { data, error: fetchError } = await supabase
                .from('eventos')
                .select('*')
                .order('fecha', { ascending: true });

            if (fetchError) throw fetchError;

            setEvents((data as Evento[]) ?? []);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error al cargar eventos';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Insertar nuevo evento ──────────────────────────────────────────────

    const addEvent = useCallback(
        async (params: AddEventParams) => {
            setError(null);

            try {
                const { error: insertError } = await supabase.from('eventos').insert({
                    titulo: params.titulo,
                    descripcion: params.descripcion,
                    fecha: params.fecha,
                    es_todo_el_dia: params.es_todo_el_dia,
                    hora_inicio: params.hora_inicio,
                    hora_fin: params.hora_fin,
                });

                if (insertError) throw insertError;

                await fetchEvents();
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Error al guardar evento';
                setError(message);
            }
        },
        [fetchEvents]
    );

    // ── Actualizar evento existente ────────────────────────────────────────

    const updateEvent = useCallback(
        async (evento: Evento) => {
            setError(null);

            try {
                const { error: updateError } = await supabase
                    .from('eventos')
                    .update({
                        titulo: evento.titulo,
                        descripcion: evento.descripcion,
                        fecha: evento.fecha,
                        es_todo_el_dia: evento.es_todo_el_dia,
                        hora_inicio: evento.hora_inicio,
                        hora_fin: evento.hora_fin,
                    })
                    .eq('id', evento.id);

                if (updateError) throw updateError;

                await fetchEvents();
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Error al actualizar evento';
                setError(message);
            }
        },
        [fetchEvents]
    );

    // ── Eliminar evento ────────────────────────────────────────────────────

    const deleteEvent = useCallback(
        async (id: string) => {
            setError(null);

            try {
                const { error: deleteError } = await supabase
                    .from('eventos')
                    .delete()
                    .eq('id', id);

                if (deleteError) throw deleteError;

                await fetchEvents();
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Error al eliminar evento';
                setError(message);
            }
        },
        [fetchEvents]
    );

    // ── Cargar eventos al montar ───────────────────────────────────────────

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    return { events, loading, error, fetchEvents, addEvent, updateEvent, deleteEvent };
}
