<script lang="ts">
	import { onMount } from 'svelte';
	import { app } from '#lib/app.svelte.ts';
	import ModeToggle from '#lib/components/ModeToggle.svelte';
	import Toast from '#lib/components/Toast.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	onMount(() => {
		app.load();
	});
</script>

<header class="top">
	<div class="top-in">
		<a class="brand" href="/" aria-label="Zur Übersicht">
			<svg viewBox="0 0 28 28" aria-hidden="true">
				<rect x="6" y="3" width="18" height="13" rx="2" fill="var(--f2)"></rect>
				<rect x="3" y="8" width="18" height="13" rx="2" fill="var(--accent)"></rect>
				<rect x="3" y="11" width="18" height="1.5" fill="var(--margin)"></rect>
				<rect x="3" y="21" width="22" height="4" rx="1.5" fill="var(--f4)"></rect>
			</svg>
			Karteikasten
		</a>
		<ModeToggle />
	</div>
</header>

<main class="wrap">
	{#if app.status === 'loading'}
		<p class="hint">Lade deine Karten …</p>
	{:else if app.status === 'error'}
		<div class="panel notice">
			<p>{app.error}</p>
			<button class="btn" onclick={() => app.load()}>Nochmal versuchen</button>
		</div>
	{:else}
		{@render children()}
	{/if}
</main>

<Toast />

<style>
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		color: var(--ink);
		text-decoration: none;
		font: 700 18px var(--font-display);
		letter-spacing: -0.01em;
	}
	.brand svg {
		width: 28px;
		height: 28px;
		flex: none;
	}
	.notice {
		display: grid;
		gap: 12px;
		justify-items: start;
	}
</style>
