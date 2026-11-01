<script lang="ts">
	import { onMount } from 'svelte';
	import { currentMode, setMode, type Mode } from '#lib/mode.ts';

	let mode = $state<Mode>('day');

	onMount(() => {
		mode = currentMode();
		const media = matchMedia('(prefers-color-scheme: dark)');
		const follow = () => (mode = currentMode());
		media.addEventListener('change', follow);
		return () => media.removeEventListener('change', follow);
	});

	function toggle() {
		mode = mode === 'night' ? 'day' : 'night';
		setMode(mode);
	}
</script>

<button class="mode" onclick={toggle} aria-label={mode === 'night' ? 'Tagmodus einschalten' : 'Nachtmodus einschalten'}>
	{mode === 'night' ? '☀ Tag' : '☾ Nacht'}
</button>

<style>
	.mode {
		font-weight: 700;
		font-size: 14px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 99px;
		padding: 6px 14px;
		white-space: nowrap;
		cursor: pointer;
	}
	.mode:hover {
		border-color: var(--accent);
	}
</style>
