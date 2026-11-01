import { describe, expect, it } from 'vitest';
import { addDays, isDue, replay, startOfDay } from './leitner';

// Mon 2 Nov 2026, 09:00 in Berlin
const MON_9 = new Date(2026, 10, 2, 9, 0).getTime();
const at = (dayOffset: number, hour = 9) => new Date(2026, 10, 2 + dayOffset, hour, 0).getTime();
const right = (t: number) => ({ correct: true, answeredAt: t });
const wrong = (t: number) => ({ correct: false, answeredAt: t });

describe('replay', () => {
	it('keeps a new card in compartment 0 and due right away', () => {
		expect(replay(MON_9, [])).toEqual({ level: 0, dueAt: MON_9 });
	});

	it('moves one compartment up per correct answer, with growing intervals', () => {
		expect(replay(MON_9, [right(at(0))])).toEqual({ level: 1, dueAt: addDays(MON_9, 1) });
		expect(replay(MON_9, [right(at(0)), right(at(1))])).toEqual({ level: 2, dueAt: addDays(at(1), 2) });
		expect(replay(MON_9, [right(at(0)), right(at(1)), right(at(3))])).toEqual({
			level: 3,
			dueAt: addDays(at(3), 4)
		});
	});

	it('stops at compartment 5 with a 16-day interval', () => {
		const reviews = [0, 1, 3, 7, 15, 31, 47].map((d) => right(at(d)));
		expect(replay(MON_9, reviews)).toEqual({ level: 5, dueAt: addDays(at(47), 16) });
	});

	it('sends a card back to compartment 1 on a wrong answer, due the next day', () => {
		const reviews = [right(at(0)), right(at(1)), right(at(3)), wrong(at(7))];
		expect(replay(MON_9, reviews)).toEqual({ level: 1, dueAt: addDays(at(7), 1) });
	});

	it('keeps a card in compartment 1 when it is right again on the same day it was wrong', () => {
		const reviews = [right(at(0)), right(at(1)), wrong(at(3, 9)), right(at(3, 9.5))];
		expect(replay(MON_9, reviews)).toEqual({ level: 1, dueAt: addDays(at(3), 1) });
	});

	it('moves up normally again on the day after a wrong answer', () => {
		const reviews = [wrong(at(0)), right(at(0, 10)), right(at(1))];
		expect(replay(MON_9, reviews)).toEqual({ level: 2, dueAt: addDays(at(1), 2) });
	});

	it('gives the same result regardless of the order reviews arrive in', () => {
		const reviews = [right(at(0)), wrong(at(1)), right(at(2)), right(at(3))];
		const shuffled = [reviews[2], reviews[0], reviews[3], reviews[1]];
		expect(replay(MON_9, shuffled)).toEqual(replay(MON_9, reviews));
	});
});

describe('isDue', () => {
	it('treats a card as due for the whole day it falls on', () => {
		const state = { level: 2, dueAt: startOfDay(at(2)) };
		expect(isDue(state, at(1, 23))).toBe(false);
		expect(isDue(state, at(2, 0))).toBe(true);
		expect(isDue(state, at(5))).toBe(true);
	});

	it('handles the switch to winter time', () => {
		// 25 Oct 2026 is the DST change in Berlin; a 1-day interval must still land on midnight
		const sat = new Date(2026, 9, 24, 20, 0).getTime();
		expect(new Date(addDays(sat, 1)).getHours()).toBe(0);
		expect(new Date(addDays(sat, 1)).getDate()).toBe(25);
	});
});
