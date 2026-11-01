<script lang="ts">
	import { onMount } from 'svelte';
	import { app } from '#lib/app.svelte.ts';
	import ModeToggle from '#lib/components/ModeToggle.svelte';
	import SyncBadge from '#lib/components/SyncBadge.svelte';
	import Toast from '#lib/components/Toast.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	let updateReady = $state(false);

	onMount(() => {
		// the service worker takes over right after installing a new version; offer a reload
		// (not on the very first visit, when there was no previous version)
		const hadController = !!navigator.serviceWorker?.controller;
		navigator.serviceWorker?.addEventListener('controllerchange', () => {
			if (hadController) updateReady = true;
		});
		app.start();
	});

	const noDataYet = $derived(
		!app.hasSynced && app.decks.length === 0 && (app.sync === 'offline' || app.sync === 'auth')
	);
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
			<span class="name">Karteikasten</span>
		</a>
		<div class="right">
			<SyncBadge />
			<ModeToggle />
		</div>
	</div>
</header>

{#if updateReady}
	<div class="update" role="status">
		<div class="top-in">
			<span>Eine neue Version ist da.</span>
			<button class="link" onclick={() => location.reload()}>Neu laden</button>
		</div>
	</div>
{/if}

<main class="wrap">
	{#if !app.ready}
		<p class="hint">Lade deine Karten …</p>
	{:else if noDataYet}
		<div class="panel notice">
			<h1>Noch keine Daten auf diesem Gerät</h1>
			<p>
				Öffne die App einmal im Heimnetz. Dann lädt sie deine Karten und funktioniert danach auch unterwegs ohne
				Verbindung.
			</p>
			<button class="btn" onclick={() => app.syncNow()}>Nochmal versuchen</button>
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
		min-width: 0;
	}
	.brand svg {
		width: 28px;
		height: 28px;
		flex: none;
	}
	.right {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.update {
		background: var(--accent-soft);
		color: var(--ink);
		font-size: 14px;
	}
	.update .top-in {
		padding-block: 8px;
		justify-content: flex-start;
	}
	.notice {
		display: grid;
		gap: 12px;
		justify-items: start;
	}
	@media (max-width: 400px) {
		/* room for the sync badge next to the mode switch */
		.brand .name {
			display: none;
		}
	}
</style>
