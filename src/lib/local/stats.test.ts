import { describe, expect, it } from 'vitest';
import { rollStats } from './stats.ts';

const at = (dayOffset: number, hour = 9) => new Date(2026, 10, 2 + dayOffset, hour, 0).getTime();
const stored = (day: number, right: number, wrong: number, streak: number) => ({
	today: { right, wrong },
	streak,
	day
});

describe('rollStats', () => {
	it('keeps the numbers on the same day', () => {
		expect(rollStats(stored(at(0, 8), 3, 1, 5), at(0, 20))).toEqual({ today: { right: 3, wrong: 1 }, streak: 5 });
	});

	it('starts a new day at zero and keeps the streak if yesterday had answers', () => {
		expect(rollStats(stored(at(-1), 3, 1, 5), at(0))).toEqual({ today: { right: 0, wrong: 0 }, streak: 5 });
	});

	it('ends the streak after a day without answers', () => {
		expect(rollStats(stored(at(-1), 0, 0, 5), at(0)).streak).toBe(0);
		expect(rollStats(stored(at(-2), 4, 0, 5), at(0)).streak).toBe(0);
	});

	it('starts empty on a new device', () => {
		expect(rollStats(undefined, at(0))).toEqual({ today: { right: 0, wrong: 0 }, streak: 0 });
	});
});
