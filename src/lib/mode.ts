// Tag-/Nachtmodus: an explicit choice is stored per device (app.html applies it before
// the first paint); without one the app follows the system setting.

const KEY = 'vokabel-mode';
export type Mode = 'day' | 'night';

export function currentMode(): Mode {
	const m = document.documentElement.dataset.mode;
	if (m === 'day' || m === 'night') return m;
	return matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day';
}

export function setMode(mode: Mode) {
	document.documentElement.dataset.mode = mode;
	try {
		localStorage.setItem(KEY, mode);
	} catch {
		// private mode: the choice just isn't remembered
	}
}
