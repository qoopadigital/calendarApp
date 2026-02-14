import { supabase, type Todo } from '@/lib/supabase';
import { useCallback, useState } from 'react';

interface UseTodosReturn {
    todos: Todo[];
    loading: boolean;
    error: string | null;
    fetchTodos: (fecha: string) => Promise<void>;
    addTodo: (titulo: string, fecha: string) => Promise<void>;
    toggleTodo: (id: string, completadoActual: boolean) => Promise<void>;
    updateTodo: (id: string, nuevoTitulo: string) => Promise<void>;
}

export function useTodos(): UseTodosReturn {
    const [todos, setTodos] = useState<Todo[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // ── Obtener tareas pendientes de una fecha ────────────────────────────

    const fetchTodos = useCallback(async (fecha: string) => {
        setLoading(true);
        setError(null);

        try {
            const { data, error: fetchError } = await supabase
                .from('todos')
                .select('*')
                .eq('fecha', fecha)
                .eq('completado', false)
                .order('titulo', { ascending: true });

            if (fetchError) throw fetchError;

            setTodos((data as Todo[]) ?? []);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error al cargar tareas';
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Agregar tarea ─────────────────────────────────────────────────────

    const addTodo = useCallback(
        async (titulo: string, fecha: string) => {
            setError(null);

            try {
                const { error: insertError } = await supabase.from('todos').insert({
                    titulo,
                    fecha,
                    completado: false,
                });

                if (insertError) throw insertError;

                await fetchTodos(fecha);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Error al guardar tarea';
                setError(message);
            }
        },
        [fetchTodos]
    );

    // ── Marcar / desmarcar como completada ─────────────────────────────────

    const toggleTodo = useCallback(
        async (id: string, completadoActual: boolean) => {
            setError(null);

            try {
                const { error: toggleError } = await supabase
                    .from('todos')
                    .update({ completado: !completadoActual })
                    .eq('id', id);

                if (toggleError) throw toggleError;

                // Quitar de la lista local inmediatamente (solo mostramos pendientes)
                setTodos((prev) => prev.filter((t) => t.id !== id));
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Error al actualizar tarea';
                setError(message);
            }
        },
        []
    );

    // ── Editar título ─────────────────────────────────────────────────────

    const updateTodo = useCallback(
        async (id: string, nuevoTitulo: string) => {
            setError(null);

            try {
                const { error: updateError } = await supabase
                    .from('todos')
                    .update({ titulo: nuevoTitulo })
                    .eq('id', id);

                if (updateError) throw updateError;

                // Actualizar localmente
                setTodos((prev) =>
                    prev.map((t) => (t.id === id ? { ...t, titulo: nuevoTitulo } : t))
                );
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Error al editar tarea';
                setError(message);
            }
        },
        []
    );

    return { todos, loading, error, fetchTodos, addTodo, toggleTodo, updateTodo };
}
