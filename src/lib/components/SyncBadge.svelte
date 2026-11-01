<script lang="ts">
	import { app } from '#lib/app.svelte.ts';

	// silent while everything is in sync; speaks up when changes are waiting or a login is needed
	const label = $derived.by(() => {
		if (app.sync === 'offline') return app.pending ? `Offline · ${app.pending} ausstehend` : 'Offline';
		if (app.sync === 'syncing' && app.pending) return 'Gleiche ab …';
		return null;
	});
</script>

{#if app.sync === 'auth'}
	<a class="badge warn" href="/login" data-sveltekit-reload>Bitte neu anmelden</a>
{:else if label}
	<span class="badge" class:off={app.sync === 'offline'} role="status">{label}</span>
{/if}

<style>
	.badge {
		font-size: 12px;
		font-weight: 700;
		padding: 4px 10px;
		border-radius: 99px;
		border: 1px solid var(--line);
		color: var(--muted);
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	.off {
		border-style: dashed;
	}
	.warn {
		color: var(--bad);
		background: var(--bad-soft);
		border-color: transparent;
		text-decoration: none;
	}
</style>
