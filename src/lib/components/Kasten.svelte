<script lang="ts">
	import { FACH, INTERVAL_LABEL, levelCounts } from '#lib/labels.ts';
	import type { Card } from '#lib/types.ts';

	let { cards }: { cards: Card[] } = $props();
	const counts = $derived(levelCounts(cards));
	const max = $derived(Math.max(1, ...counts));
</script>

<div class="kasten" role="img" aria-label={counts.map((n, i) => `${FACH[i]}: ${n}`).join(', ')}>
	{#each counts as n, i (i)}
		<div class="fach">
			<span class="n">{n}</span>
			<div class="slot">
				<i style:height="{n ? Math.max(8, (n / max) * 100) : 0}%" style:background="var(--f{i})"></i>
			</div>
			<span class="l">{i === 0 ? 'Neu' : i}<small>{INTERVAL_LABEL[i]}</small></span>
		</div>
	{/each}
</div>

<style>
	.kasten {
		display: grid;
		grid-template-columns: repeat(6, minmax(0, 1fr));
		gap: 8px;
	}
	.fach {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}
	.n {
		font: 500 15px var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.slot {
		width: 100%;
		height: 96px;
		background: var(--slot);
		border-radius: 8px 8px 4px 4px;
		display: flex;
		align-items: flex-end;
		overflow: hidden;
	}
	.slot i {
		display: block;
		width: 100%;
		border-radius: 6px 6px 0 0;
		transition: height 0.3s ease;
	}
	.l {
		font-size: 13px;
		font-weight: 700;
		text-align: center;
		line-height: 1.2;
	}
	.l small {
		display: block;
		font: 500 11px var(--font-mono);
		color: var(--muted);
	}
</style>
