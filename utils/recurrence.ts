import {
    differenceInCalendarWeeks,
    getDate,
    getDay,
    getMonth,
    parseISO,
} from 'date-fns';

import type { Evento } from '@/lib/supabase';

/**
 * Determine whether a (possibly recurring) event should appear on `targetDateStr`.
 *
 * Rules:
 *  - Always show if `event.fecha === targetDateStr` (exact match).
 *  - If recurrence !== 'none', also show if the target date is AFTER the
 *    event's origin date and the recurrence pattern matches.
 */
export function shouldShowOnDate(event: Evento, targetDateStr: string): boolean {
    try {
        // Guard against missing/invalid dates
        if (!event.fecha || !targetDateStr) return false;

        // Check exception dates — skip this date if it's excluded
        if (event.exception_dates && event.exception_dates.includes(targetDateStr)) {
            return false;
        }

        // Exact match — always show
        if (event.fecha === targetDateStr) return true;

        const recurrence = event.recurrence ?? 'none';
        if (recurrence === 'none') return false;

        const origin = parseISO(event.fecha);
        const target = parseISO(targetDateStr);

        // Validate parsed dates
        if (isNaN(origin.getTime()) || isNaN(target.getTime())) return false;

        // Only show on dates ON or AFTER the origin
        if (target < origin) return false;

        switch (recurrence) {
            case 'daily':
                return true;

            case 'weekly':
                return getDay(target) === getDay(origin);

            case 'biweekly': {
                if (getDay(target) !== getDay(origin)) return false;
                const weeksDiff = differenceInCalendarWeeks(target, origin, { weekStartsOn: 1 });
                return weeksDiff % 2 === 0;
            }

            case 'monthly':
                return getDate(target) === getDate(origin);

            case 'yearly':
                return getDate(target) === getDate(origin) && getMonth(target) === getMonth(origin);

            default:
                return false;
        }
    } catch {
        // If anything fails (bad date format, etc.), just don't show the event
        return false;
    }
}
