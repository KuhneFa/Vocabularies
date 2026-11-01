<script lang="ts">
	import { levelCounts } from '#lib/labels.ts';
	import type { Card } from '#lib/types.ts';

	let { cards }: { cards: Card[] } = $props();
	const counts = $derived(levelCounts(cards));
</script>

<!-- share of cards per compartment, Neu to Fach 5 -->
<span class="bar" aria-hidden="true">
	{#each counts as n, i (i)}
		{#if n}
			<span style:width="{(n / cards.length) * 100}%" style:background="var(--f{i})"></span>
		{/if}
	{/each}
</span>

<style>
	.bar {
		grid-column: 1 / -1;
		display: flex;
		height: 8px;
		border-radius: 99px;
		overflow: hidden;
		background: var(--f0);
		margin-top: 8px;
	}
	.bar span {
		display: block;
		height: 100%;
	}
</style>
