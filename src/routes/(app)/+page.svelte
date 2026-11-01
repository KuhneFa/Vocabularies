<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '#lib/api.ts';
	import { app } from '#lib/app.svelte.ts';
	import FachBar from '#lib/components/FachBar.svelte';
	import { newId } from '#lib/id.ts';
	import { FACH, plural } from '#lib/labels.ts';
	import { isDue } from '#lib/leitner.ts';
	import { toast } from '#lib/toast.svelte.ts';

	const now = Date.now();
	const due = $derived(app.cards.filter((c) => isDue(c, now)));
	const decksWithDue = $derived(new Set(due.map((c) => c.deckId)).size);
	const answered = $derived(app.stats.today.right + app.stats.today.wrong);
	const rate = $derived(answered ? `${Math.round((app.stats.today.right / answered) * 100)} %` : '–');

	let showNewDeck = $state(false);
	let name = $state('');
	let languagePair = $state('');
	let saving = $state(false);

	async function createDeck(e: SubmitEvent) {
		e.preventDefault();
		saving = true;
		try {
			const deck = await api.createDeck({ id: newId(), name: name.trim(), languagePair: languagePair.trim() });
			app.decks.push(deck);
			toast.show('Stapel angelegt');
			await goto(`/stapel/${deck.id}`);
		} catch (err) {
			toast.show((err as Error).message, 4000);
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Karteikasten</title>
</svelte:head>

<section class="panel today" aria-labelledby="h-today">
	<div class="today-head">
		<p class="eyebrow" id="h-today">Heute fällig</p>
		<p class="big">{due.length}</p>
		<p class="sub">
			{due.length ? `Karten aus ${plural(decksWithDue, 'Stapel', 'Stapeln')}` : 'Alles erledigt für heute.'}
		</p>
	</div>
	<a class="btn primary wide" href="/lernen?stapel=alle&modus=faellig" aria-disabled={due.length === 0}>
		Fällige Karten lernen
	</a>
	<dl class="stats">
		<div><dt>Serie</dt><dd>{plural(app.stats.streak, 'Tag', 'Tage')}</dd></div>
		<div><dt>Heute gelernt</dt><dd>{answered}</dd></div>
		<div><dt>Erfolgsquote</dt><dd>{rate}</dd></div>
	</dl>
</section>

<section class="block" aria-labelledby="h-decks">
	<div class="block-head">
		<h2 id="h-decks">Stapel</h2>
		<button class="btn small" onclick={() => (showNewDeck = !showNewDeck)} aria-expanded={showNewDeck}>
			Neuer Stapel
		</button>
	</div>

	{#if showNewDeck}
		<form class="form" onsubmit={createDeck}>
			<div class="form-row">
				<div class="field">
					<label for="nd-name">Name</label>
					<!-- svelte-ignore a11y_autofocus -->
					<input id="nd-name" bind:value={name} required autocomplete="off" placeholder="z. B. Französisch B1" autofocus />
				</div>
				<div class="field">
					<label for="nd-pair">Sprachpaar</label>
					<input id="nd-pair" bind:value={languagePair} autocomplete="off" placeholder="FR → DE" />
				</div>
			</div>
			<button class="btn primary" type="submit" disabled={saving}>Stapel anlegen</button>
		</form>
	{/if}

	{#if app.decks.length}
		<ul class="decks">
			{#each app.decks as deck (deck.id)}
				{@const cards = app.cardsOf(deck.id)}
				{@const dueHere = cards.filter((c) => isDue(c, now)).length}
				<li>
					<a class="deck" href="/stapel/{deck.id}">
						<span class="deck-name">{deck.name}</span>
						<span class="chip" class:zero={!dueHere}>{dueHere} fällig</span>
						<span class="deck-meta">
							{deck.languagePair || 'ohne Sprachpaar'} · {plural(cards.length, 'Karte', 'Karten')} ·
							{cards.filter((c) => c.level === 5).length} gemeistert
						</span>
						<FachBar {cards} />
					</a>
				</li>
			{/each}
		</ul>
		<ul class="legend" aria-label="Legende">
			{#each FACH as label, i (i)}
				<li><span class="dot" style:background="var(--f{i})"></span>{label}</li>
			{/each}
		</ul>
	{:else}
		<p class="hint">Noch keine Stapel. Leg mit „Neuer Stapel“ deinen ersten an.</p>
	{/if}
</section>

<footer class="foot">
	<form method="POST" action="/logout">
		<button class="link" type="submit">Abmelden</button>
	</form>
</footer>

<style>
	.today {
		display: grid;
		gap: 18px;
	}
	.today-head {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
		margin: 0;
		padding-top: 16px;
		border-top: 1px solid var(--line);
	}
	.stats div {
		min-width: 0;
	}
	.stats dt {
		font-size: 13px;
		color: var(--muted);
	}
	.stats dd {
		margin: 2px 0 0;
		font: 500 18px var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.decks {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.deck {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 4px 12px;
		align-items: center;
		color: var(--ink);
		text-decoration: none;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 14px;
		padding: 16px;
		transition: border-color 0.15s ease;
	}
	.deck:hover {
		border-color: var(--accent);
	}
	.deck-name {
		font: 700 18px var(--font-display);
		min-width: 0;
	}
	.deck-meta {
		color: var(--muted);
		font-size: 14px;
		grid-column: 1 / -1;
	}
	.chip {
		font: 500 13px var(--font-mono);
		padding: 4px 10px;
		border-radius: 99px;
		white-space: nowrap;
		background: var(--accent-soft);
		color: var(--accent);
		font-variant-numeric: tabular-nums;
	}
	.chip.zero {
		background: transparent;
		color: var(--muted);
		border: 1px solid var(--line);
	}
	.foot {
		font-size: 14px;
		border-top: 1px solid var(--line);
		padding-top: 16px;
	}
	@media (max-width: 420px) {
		.stats dd {
			font-size: 16px;
		}
	}
</style>
