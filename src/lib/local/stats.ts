import { addDays, startOfDay } from '#lib/leitner.ts';
import type { Stats } from '#lib/types.ts';

/** Stats as stored on the device, with the time they were last updated. */
export type StoredStats = Stats & { day: number };

/**
 * Carries stored stats over to `now`: on a new day today's counts start at zero, and the
 * streak survives only if the stored day was yesterday and had answers.
 */
export function rollStats(stored: StoredStats | undefined, now: number): Stats {
	if (!stored) return { today: { right: 0, wrong: 0 }, streak: 0 };
	const storedDay = startOfDay(stored.day);
	const today = startOfDay(now);
	if (storedDay === today) return { today: { ...stored.today }, streak: stored.streak };

	const answeredThatDay = stored.today.right + stored.today.wrong > 0;
	const keep = storedDay === addDays(today, -1) && answeredThatDay;
	return { today: { right: 0, wrong: 0 }, streak: keep ? stored.streak : 0 };
}
