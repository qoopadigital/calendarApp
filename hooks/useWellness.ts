import { supabase, type DailyWellness } from '@/lib/supabase';
import { useCallback, useState } from 'react';

interface UseWellnessReturn {
    wellness: DailyWellness | null;
    loading: boolean;
    error: string | null;
    fetchWellness: (fecha: string) => Promise<void>;
    upsertField: (fecha: string, field: keyof Pick<DailyWellness, 'agua_litros' | 'pasos' | 'horas_sueno'>, value: number) => Promise<void>;
}

export function useWellness(): UseWellnessReturn {
    const [wellness, setWellness] = useState<DailyWellness | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // ── Obtener registro de wellness para una fecha ───────────────────────

    const fetchWellness = useCallback(async (fecha: string) => {
        setLoading(true);
        setError(null);

        try {
            const { data, error: fetchError } = await supabase
                .from('daily_wellness')
                .select('*')
                .eq('fecha', fecha)
                .maybeSingle();

            if (fetchError) throw fetchError;

            setWellness((data as DailyWellness) ?? null);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error al cargar wellness';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Upsert de un campo individual ─────────────────────────────────────

    const upsertField = useCallback(
        async (
            fecha: string,
            field: keyof Pick<DailyWellness, 'agua_litros' | 'pasos' | 'horas_sueno'>,
            value: number
        ) => {
            setError(null);

            try {
                // Intentar obtener el registro existente
                const { data: existing } = await supabase
                    .from('daily_wellness')
                    .select('id')
                    .eq('fecha', fecha)
                    .maybeSingle();

                if (existing) {
                    // Actualizar
                    const { error: updateError } = await supabase
                        .from('daily_wellness')
                        .update({ [field]: value })
                        .eq('id', existing.id);

                    if (updateError) throw updateError;
                } else {
                    // Insertar nuevo registro con valores por defecto
                    const newRecord = {
                        fecha,
                        agua_litros: 0,
                        pasos: 0,
                        horas_sueno: 0,
                        [field]: value,
                    };

                    const { error: insertError } = await supabase
                        .from('daily_wellness')
                        .insert(newRecord);

                    if (insertError) throw insertError;
                }

                // Actualizar estado local
                setWellness((prev) => {
                    const base = prev ?? {
                        id: '',
                        user_id: null,
                        fecha,
                        agua_litros: 0,
                        pasos: 0,
                        horas_sueno: 0,
                    };
                    return { ...base, [field]: value };
                });
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Error al guardar wellness';
                console.error('[Wellness upsertField]', message, err);
                setError(message);
            }
        },
        []
    );

    return { wellness, loading, error, fetchWellness, upsertField };
}
