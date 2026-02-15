import { supabase, type Todo } from '@/lib/supabase';
import { useCallback, useState } from 'react';

interface UseTodosReturn {
    todos: Todo[];
    allTodos: Todo[];
    loading: boolean;
    error: string | null;
    fetchTodos: (fecha: string) => Promise<void>;
    fetchAllTodos: (fecha: string) => Promise<void>;
    addTodo: (titulo: string, fecha: string) => Promise<void>;
    toggleTodo: (id: string, completadoActual: boolean) => Promise<void>;
    updateTodo: (id: string, nuevoTitulo: string) => Promise<void>;
}

export function useTodos(): UseTodosReturn {
    const [todos, setTodos] = useState<Todo[]>([]);
    const [allTodos, setAllTodos] = useState<Todo[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // ── Obtener tareas PENDIENTES de una fecha ─────────────────────────────

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

    // ── Obtener TODAS las tareas de una fecha (pendientes + completadas) ──

    const fetchAllTodos = useCallback(async (fecha: string) => {
        setError(null);

        try {
            const { data, error: fetchError } = await supabase
                .from('todos')
                .select('*')
                .eq('fecha', fecha)
                .order('completado', { ascending: true })
                .order('titulo', { ascending: true });

            if (fetchError) throw fetchError;

            setAllTodos((data as Todo[]) ?? []);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Error al cargar tareas';
            setError(message);
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
                await fetchAllTodos(fecha);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Error al guardar tarea';
                setError(message);
            }
        },
        [fetchTodos, fetchAllTodos]
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

                // Update pending list
                if (!completadoActual) {
                    // Was pending → now completed: remove from pending list
                    setTodos((prev) => prev.filter((t) => t.id !== id));
                } else {
                    // Was completed → now pending: will be re-fetched
                }

                // Update allTodos list locally
                setAllTodos((prev) =>
                    prev.map((t) =>
                        t.id === id ? { ...t, completado: !completadoActual } : t
                    )
                );
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

                // Actualizar localmenteq
                setTodos((prev) =>
                    prev.map((t) => (t.id === id ? { ...t, titulo: nuevoTitulo } : t))
                );
                setAllTodos((prev) =>
                    prev.map((t) => (t.id === id ? { ...t, titulo: nuevoTitulo } : t))
                );
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Error al editar tarea';
                setError(message);
            }
        },
        []
    );

    return { todos, allTodos, loading, error, fetchTodos, fetchAllTodos, addTodo, toggleTodo, updateTodo };
}
