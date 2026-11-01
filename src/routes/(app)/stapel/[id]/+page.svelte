<script lang="ts">
	import { tick } from 'svelte';
	import { page } from '$app/state';
	import { app } from '#lib/app.svelte.ts';
	import Kasten from '#lib/components/Kasten.svelte';
	import SideEditor from '#lib/components/SideEditor.svelte';
	import { FACH, plural, relativeDue } from '#lib/labels.ts';
	import { isDue } from '#lib/leitner.ts';
	import { mediaSrc } from '#lib/local/media.svelte.ts';
	import { toast } from '#lib/toast.svelte.ts';

	const deck = $derived(app.deck(page.params.id ?? ''));
	const cards = $derived(deck ? app.cardsOf(deck.id) : []);
	const dueCount = $derived(cards.filter((c) => isDue(c, Date.now())).length);

	// cards added on this visit are listed first and highlighted
	let fresh = $state<string[]>([]);
	const sorted = $derived(
		[...cards].sort(
			(a, b) => +fresh.includes(b.id) - +fresh.includes(a.id) || a.dueAt - b.dueAt || a.level - b.level
		)
	);

	let front = $state('');
	let back = $state('');
	let frontImage = $state<Blob | null>(null);
	let frontAudio = $state<Blob | null>(null);
	let backImage = $state<Blob | null>(null);
	let backAudio = $state<Blob | null>(null);
	let recordingFront = $state(false);
	let recordingBack = $state(false);
	let saving = $state(false);

	async function addCard(e: SubmitEvent) {
		e.preventDefault();
		if (!deck) return;
		if (recordingFront || recordingBack) {
			toast.show('Beende zuerst die Aufnahme.');
			return;
		}
		saving = true;
		try {
			const card = await app.addCard(deck.id, front.trim(), back.trim(), {
				frontImage,
				frontAudio,
				backImage,
				backAudio
			});
			fresh = [...fresh, card.id];
			front = back = '';
			frontImage = frontAudio = backImage = backAudio = null;
			toast.show('Karte hinzugefügt');
			await tick();
			document.getElementById('front-text')?.focus();
		} catch (err) {
			toast.show((err as Error).message, 4000);
		} finally {
			saving = false;
		}
	}

	let importText = $state('');

	async function importCards() {
		if (!deck) return;
		const rows = importText
			.split('\n')
			.map((line) => line.split(';').map((s) => s.trim()))
			.filter(([f, b]) => f && b)
			.map(([f, b]) => ({ front: f, back: b }));
		if (!rows.length) {
			toast.show('Keine gültigen Zeilen gefunden. Format: Vorderseite;Rückseite', 4000);
			return;
		}
		try {
			const created = await app.importCards(deck.id, rows);
			fresh = [...fresh, ...created.map((c) => c.id)];
			importText = '';
			toast.show(`${plural(created.length, 'Karte', 'Karten')} importiert`);
		} catch (err) {
			toast.show((err as Error).message, 4000);
		}
	}

	// deleting takes two taps so a slip of the finger does not lose a card
	let armed = $state<string | null>(null);
	let disarm: ReturnType<typeof setTimeout> | undefined;

	async function remove(id: string) {
		if (armed !== id) {
			armed = id;
			clearTimeout(disarm);
			disarm = setTimeout(() => (armed = null), 3000);
			return;
		}
		armed = null;
		try {
			await app.deleteCard(id);
			toast.show('Karte gelöscht');
		} catch (err) {
			toast.show((err as Error).message, 4000);
		}
	}

	const hasImage = (c: (typeof cards)[number]) => !!(c.frontImage || c.backImage);
	const hasAudio = (c: (typeof cards)[number]) => !!(c.frontAudio || c.backAudio);
</script>

<svelte:head>
	<title>{deck?.name ?? 'Stapel'} · Karteikasten</title>
</svelte:head>

<div><a class="back" href="/">← Alle Stapel</a></div>

{#if !deck}
	<p>Diesen Stapel gibt es nicht (mehr).</p>
{:else}
	<section class="hero">
		<h1>{deck.name}</h1>
		<p class="sub">{deck.languagePair || 'ohne Sprachpaar'} · {plural(cards.length, 'Karte', 'Karten')}</p>
		<div class="actions">
			<a class="btn primary" href="/lernen?stapel={deck.id}&modus=faellig" aria-disabled={dueCount === 0}>
				{dueCount} fällige lernen
			</a>
			<a class="btn" href="/lernen?stapel={deck.id}&modus=alle" aria-disabled={cards.length === 0}>
				Alle {cards.length} üben
			</a>
		</div>
	</section>

	<section class="block" aria-labelledby="h-add">
		<h2 id="h-add">Karte hinzufügen</h2>
		<form class="form" onsubmit={addCard}>
			<div class="form-row">
				<SideEditor
					id="front-text"
					label="Vorderseite"
					placeholder="la playa"
					bind:text={front}
					bind:image={frontImage}
					bind:audio={frontAudio}
					bind:recording={recordingFront}
				/>
				<SideEditor
					id="back-text"
					label="Rückseite"
					placeholder="der Strand"
					bind:text={back}
					bind:image={backImage}
					bind:audio={backAudio}
					bind:recording={recordingBack}
				/>
			</div>
			<button class="btn primary" type="submit" disabled={saving}>
				{saving ? 'Speichere …' : 'Hinzufügen'}
			</button>
			<details class="import">
				<summary>Mehrere auf einmal importieren</summary>
				<div>
					<p class="hint">Eine Karte pro Zeile, Vorder- und Rückseite durch Semikolon getrennt.</p>
					<textarea
						id="import-text"
						rows="5"
						bind:value={importText}
						placeholder={'el tenedor;die Gabel\nla llave;der Schlüssel'}
					></textarea>
					<button class="btn" type="button" onclick={importCards}>Importieren</button>
				</div>
			</details>
		</form>
	</section>

	<section class="block" aria-labelledby="h-kasten">
		<h2 id="h-kasten">Karteikasten</h2>
		<Kasten {cards} />
		<p class="hint">
			Richtig schiebt eine Karte ein Fach weiter, falsch schickt sie zurück in Fach 1. Darunter steht, wie oft
			jedes Fach abgefragt wird.
		</p>
	</section>

	<section class="block" aria-labelledby="h-cards">
		<h2 id="h-cards">Karten</h2>
		{#if sorted.length}
			<ul class="cards">
				{#each sorted as card (card.id)}
					<li class:new={fresh.includes(card.id)}>
						<span class="c-front">{card.front}</span>
						<span class="c-back">
							{card.back}
							{#if hasImage(card)}<span class="mtag">Bild</span>{/if}
							{#if hasAudio(card)}<span class="mtag">Audio</span>{/if}
						</span>
						<span class="c-when">
							<span class="tag"><span class="dot" style:background="var(--f{card.level})"></span>{FACH[card.level]}</span><br />
							{relativeDue(card)}
						</span>
						<button
							class="del"
							class:armed={armed === card.id}
							onclick={() => remove(card.id)}
							aria-label={armed === card.id ? `${card.front} wirklich löschen` : `${card.front} löschen`}
						>
							{armed === card.id ? 'Löschen?' : '×'}
						</button>
						{#if card.frontImage || card.backImage}
							{@const src = mediaSrc(app.ldb, (card.frontImage ?? card.backImage)!)}
							{#if src}<img class="thumb" {src} alt="" loading="lazy" />{/if}
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="hint">Noch keine Karten in diesem Stapel. Leg oben die erste an.</p>
		{/if}
	</section>
{/if}

<style>
	.hero {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.hero .actions {
		margin-top: 12px;
	}
	details.import summary {
		cursor: pointer;
		font-weight: 700;
		color: var(--accent);
	}
	details.import[open] summary {
		margin-bottom: 10px;
	}
	details.import > div {
		display: grid;
		gap: 10px;
	}
	.cards {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.cards li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		gap: 2px 12px;
		align-items: center;
		padding: 12px 0;
		border-bottom: 1px solid var(--line);
	}
	.cards li.new {
		animation: row-in 0.5s ease backwards;
	}
	@keyframes row-in {
		from {
			background: var(--accent-soft);
			opacity: 0;
			transform: translateY(-6px);
		}
	}
	.c-front {
		font-weight: 700;
		overflow-wrap: anywhere;
	}
	.c-back {
		color: var(--muted);
		font-size: 14px;
		grid-column: 1;
		overflow-wrap: anywhere;
	}
	.c-when {
		font: 500 12px var(--font-mono);
		color: var(--muted);
		text-align: right;
		grid-row: 1 / 3;
		grid-column: 2;
		white-space: nowrap;
	}
	.mtag {
		font: 500 11px var(--font-mono);
		border: 1px solid var(--line);
		border-radius: 5px;
		padding: 0 5px;
		margin-left: 6px;
	}
	.del {
		grid-row: 1 / 3;
		grid-column: 3;
		background: none;
		border: 0;
		color: var(--muted);
		cursor: pointer;
		font-size: 18px;
		padding: 4px 6px;
		border-radius: 6px;
	}
	.del:hover,
	.del.armed {
		color: var(--bad);
	}
	.del.armed {
		font-size: 13px;
		font-weight: 700;
		background: var(--bad-soft);
	}
	.thumb {
		grid-column: 1;
		width: 64px;
		height: 44px;
		object-fit: cover;
		border-radius: 6px;
		margin-top: 6px;
	}
</style>
