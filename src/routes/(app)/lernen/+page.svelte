<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api, mediaUrl } from '#lib/api.ts';
	import { app } from '#lib/app.svelte.ts';
	import { newId } from '#lib/id.ts';
	import { FACH, plural } from '#lib/labels.ts';
	import { isDue } from '#lib/leitner.ts';
	import { toast } from '#lib/toast.svelte.ts';
	import type { Card, Side } from '#lib/types.ts';

	// /lernen?stapel=<id>|alle&modus=faellig|alle
	const MAX_ROUND = 30;
	const deckParam = page.url.searchParams.get('stapel') ?? 'alle';
	const practiceAll = page.url.searchParams.get('modus') === 'alle';
	const deck = deckParam === 'alle' ? undefined : app.deck(deckParam);
	const backHref = deck ? `/stapel/${deck.id}` : '/';

	/** New and low compartments first, random order within a compartment. */
	function buildQueue(): string[] {
		const now = Date.now();
		const pool = (deck ? app.cardsOf(deck.id) : app.cards).filter((c) => practiceAll || isDue(c, now));
		return pool
			.map((c) => ({ c, r: Math.random() }))
			.sort((a, b) => a.c.level - b.c.level || a.r - b.r)
			.slice(0, MAX_ROUND)
			.map((x) => x.c.id);
	}

	const initial = buildQueue();
	const empty = initial.length === 0;
	let queue = $state(initial);
	let pos = $state(0);
	let flipped = $state(false);
	let done = $state(false);
	let right = $state(0);
	let wrong = $state(0);
	let failed = $state<string[]>([]);
	const answered = new Set<string>();
	let shownAt = Date.now();

	const card = $derived(app.cards.find((c) => c.id === queue[pos]));
	const cardDeck = $derived(card ? app.deck(card.deckId) : undefined);

	// animation: a stamp first, then the card flies off to the side
	let lean = $state<'ok' | 'bad' | null>(null);
	let fly = $state<'left' | 'right' | null>(null);
	let dragging = $state(false);
	let dragX = $state(0);
	let busy = false;

	const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
	const wait = (ms: number) => new Promise((r) => setTimeout(r, reducedMotion() ? 0 : ms));

	function flip() {
		if (!flipped && card) flipped = true;
	}

	async function answer(ok: boolean, swiped = false) {
		if (!flipped || busy || !card) return;
		busy = true;
		const current = card;
		lean = ok ? 'ok' : 'bad';
		if (!swiped) await wait(220);
		fly = ok ? 'right' : 'left';
		dragging = false;
		await wait(300);

		record(current, ok);
		pos++;
		flipped = false;
		lean = null;
		fly = null;
		dragX = 0;
		shownAt = Date.now();
		busy = false;
		if (pos >= queue.length) done = true;
	}

	function record(c: Card, ok: boolean) {
		if (!answered.has(c.id)) {
			answered.add(c.id);
			if (ok) right++;
			else wrong++;
		}
		if (!ok) {
			if (!failed.includes(c.id)) failed = [...failed, c.id];
			queue.push(c.id); // asked again later in this round
		}
		app.recordAnswer(ok);
		api
			.review({ id: newId(), cardId: c.id, correct: ok, answeredAt: Date.now(), durationMs: Date.now() - shownAt })
			.then((updated) => app.upsertCard(updated))
			.catch((err) => toast.show(`Antwort nicht gespeichert: ${err.message}`, 4000));
	}

	// swipe right = richtig, left = falsch
	let startX: number | null = null;

	function pointerDown(e: PointerEvent) {
		if (!flipped || busy || (e.target as Element).closest('button')) return;
		startX = e.clientX;
		dragging = true;
		(e.currentTarget as Element).setPointerCapture(e.pointerId);
	}

	function pointerMove(e: PointerEvent) {
		if (startX === null) return;
		dragX = e.clientX - startX;
		lean = dragX > 60 ? 'ok' : dragX < -60 ? 'bad' : null;
	}

	function pointerUp() {
		if (startX === null) return;
		startX = null;
		if (Math.abs(dragX) > 90) {
			answer(dragX > 0, true);
		} else {
			dragging = false;
			dragX = 0;
			lean = null;
		}
	}

	function onKey(e: KeyboardEvent) {
		if (empty || done || (e.target as Element).matches?.('input, textarea')) return;
		if (!flipped && (e.key === ' ' || e.key === 'Enter')) {
			e.preventDefault();
			flip();
		} else if (flipped && (e.key === 'ArrowLeft' || e.key === '1')) answer(false);
		else if (flipped && (e.key === 'ArrowRight' || e.key === '2')) answer(true);
		else if (e.key === 'Escape') quit();
	}

	function quit() {
		if (answered.size) done = true;
		else goto(backHref);
	}

	function play(name: string) {
		new Audio(mediaUrl(name)).play().catch(() => toast.show('Audio konnte nicht abgespielt werden.'));
	}

	const total = $derived(right + wrong);
	const rate = $derived(total ? Math.round((right / total) * 100) : 0);
	const failedCards = $derived(failed.map((id) => app.cards.find((c) => c.id === id)).filter((c) => !!c));
</script>

<svelte:head>
	<title>Lernen · Karteikasten</title>
</svelte:head>

<svelte:window onkeydown={onKey} />

{#snippet media(c: Card, side: Side)}
	{@const image = side === 'front' ? c.frontImage : c.backImage}
	{@const audio = side === 'front' ? c.frontAudio : c.backAudio}
	{#if image}
		<img class="card-img" src={mediaUrl(image)} alt="Bild zu {c.front}" draggable="false" />
	{/if}
	{#if audio}
		<button class="play" onclick={() => play(audio)}>▶ Anhören</button>
	{/if}
{/snippet}

{#if empty}
	<section class="panel result">
		<p class="eyebrow">Nichts fällig</p>
		<h1>Für heute ist alles gelernt.</h1>
		<div class="actions">
			<a class="btn primary" href={backHref}>Zurück</a>
			{#if deck}
				<a class="btn" href="/lernen?stapel={deck.id}&modus=alle">Trotzdem alle üben</a>
			{/if}
		</div>
	</section>
{:else if done}
	<section class="panel result">
		<p class="eyebrow">Runde geschafft</p>
		<p class="big">{rate} %</p>
		<p class="sub">Erfolgsquote beim ersten Versuch über {plural(total, 'Karte', 'Karten')}</p>
		<div class="split">
			<div class="ok"><strong>{right}</strong>richtig</div>
			<div class="bd"><strong>{wrong}</strong>falsch</div>
		</div>
		{#if failedCards.length}
			<h2>Diese kommen morgen wieder</h2>
			<ul class="again">
				{#each failedCards as c (c.id)}
					<li><span>{c.front}</span><span>{c.back}</span></li>
				{/each}
			</ul>
		{/if}
		<div class="actions">
			<a class="btn primary" href="/">Zur Übersicht</a>
			{#if deck}<a class="btn" href={backHref}>Zum Stapel</a>{/if}
		</div>
	</section>
{:else if card}
	<div class="study">
		<div class="study-top">
			<button class="icon-btn" onclick={quit} aria-label="Lernrunde beenden">✕</button>
			<div class="prog" aria-hidden="true"><i style:width="{(pos / queue.length) * 100}%"></i></div>
			<span class="count">{pos + 1} / {queue.length}</span>
		</div>

		{#key pos}
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
			<article
				class="index-card enter"
				class:clickable={!flipped}
				class:drag={dragging}
				class:lean-ok={lean === 'ok'}
				class:lean-bad={lean === 'bad'}
				class:fly-right={fly === 'right'}
				class:fly-left={fly === 'left'}
				style:transform={dragging ? `translateX(${dragX}px) rotate(${dragX / 24}deg)` : undefined}
				onclick={flip}
				onpointerdown={pointerDown}
				onpointermove={pointerMove}
				onpointerup={pointerUp}
				onpointercancel={pointerUp}
				aria-live="polite"
			>
				<header class="card-meta">
					<span class="tag"><span class="dot" style:background="var(--f{card.level})"></span>{FACH[card.level]}</span>
					<span>{cardDeck?.name}</span>
				</header>
				<div class="card-body">
					<p class="front">{card.front}</p>
					{@render media(card, 'front')}
					{#if flipped}
						<div class="answer">
							<span class="eyebrow">Antwort</span>
							<p class="back">{card.back}</p>
							{@render media(card, 'back')}
						</div>
					{:else}
						<p class="tap">Tippen zum Umdrehen</p>
					{/if}
				</div>
				{#if flipped}
					<span class="stamp ok" aria-hidden="true">Richtig</span>
					<span class="stamp bad" aria-hidden="true">Falsch</span>
				{/if}
			</article>
		{/key}

		{#if flipped}
			<div class="answer-btns">
				<button class="btn bad" onclick={() => answer(false)}>Falsch <kbd>←</kbd></button>
				<button class="btn good" onclick={() => answer(true)}>Richtig <kbd>→</kbd></button>
			</div>
			<p class="hint center">Auf dem Handy kannst du die Karte auch nach links oder rechts wischen.</p>
		{:else}
			<button class="btn primary wide" onclick={flip}>Antwort zeigen <kbd>Leertaste</kbd></button>
		{/if}
	</div>
{/if}

<style>
	.study {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	.study-top {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.icon-btn {
		width: 40px;
		height: 40px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		cursor: pointer;
		font-size: 16px;
		flex: none;
	}
	.prog {
		flex: 1;
		height: 8px;
		border-radius: 99px;
		background: var(--slot);
		overflow: hidden;
	}
	.prog i {
		display: block;
		height: 100%;
		background: var(--accent);
		border-radius: 99px;
		transition: width 0.25s ease;
	}
	.count {
		font: 500 14px var(--font-mono);
		font-variant-numeric: tabular-nums;
		color: var(--muted);
		white-space: nowrap;
	}

	/* a lined index card with the margin line at the top */
	.index-card {
		position: relative;
		min-height: 340px;
		border-radius: 6px;
		border: 1px solid var(--line);
		padding: 16px 22px 26px;
		display: flex;
		flex-direction: column;
		gap: 22px;
		background-color: var(--card);
		background-image:
			linear-gradient(var(--margin), var(--margin)),
			repeating-linear-gradient(to bottom, transparent 0 35px, var(--rule) 35px 36px);
		background-size: 100% 2px, 100% calc(100% - 64px);
		background-position: 0 52px, 0 64px;
		background-repeat: no-repeat, no-repeat;
		box-shadow: 0 1px 0 var(--line), 0 18px 34px -20px var(--shadow);
		touch-action: pan-y;
		user-select: none;
		-webkit-user-select: none;
		transition:
			transform 0.3s cubic-bezier(0.5, 0, 0.75, 0),
			opacity 0.3s ease,
			box-shadow 0.12s ease;
	}
	.index-card.enter {
		animation: card-in 0.26s ease-out backwards;
	}
	.index-card.clickable {
		cursor: pointer;
	}
	.index-card.drag {
		transition: box-shadow 0.12s ease;
	}
	.index-card.lean-ok {
		box-shadow: 0 0 0 3px var(--ok), 0 18px 34px -20px var(--shadow);
	}
	.index-card.lean-bad {
		box-shadow: 0 0 0 3px var(--bad), 0 18px 34px -20px var(--shadow);
	}
	.index-card.fly-right {
		transform: translateX(120%) rotate(12deg);
		opacity: 0;
	}
	.index-card.fly-left {
		transform: translateX(-120%) rotate(-12deg);
		opacity: 0;
	}
	@keyframes card-in {
		from {
			transform: translateY(18px) scale(0.97);
			opacity: 0;
		}
	}

	.stamp {
		position: absolute;
		top: 76px;
		font: 700 22px var(--font-display);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 2px 12px;
		border: 3px solid currentColor;
		border-radius: 8px;
		opacity: 0;
		transition: opacity 0.1s ease;
		pointer-events: none;
	}
	.stamp.ok {
		color: var(--ok);
		right: 18px;
		transform: rotate(-10deg);
	}
	.stamp.bad {
		color: var(--bad);
		left: 18px;
		transform: rotate(10deg);
	}
	.lean-ok .stamp.ok,
	.lean-bad .stamp.bad {
		opacity: 1;
	}

	.card-meta {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		font-size: 13px;
		color: var(--muted);
		height: 22px;
		align-items: center;
	}
	.card-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 24px;
		padding-top: 10px;
	}
	.front {
		font: 700 clamp(28px, 7.5vw, 42px) / 1.15 var(--font-display);
		letter-spacing: -0.02em;
		overflow-wrap: anywhere;
	}
	.answer {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding-top: 18px;
		border-top: 2px dashed var(--line);
		animation: reveal 0.25s ease-out backwards;
	}
	@keyframes reveal {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
	}
	.back {
		font-size: clamp(20px, 5vw, 26px);
		line-height: 1.3;
		overflow-wrap: anywhere;
	}
	.tap {
		color: var(--muted);
		font-size: 14px;
	}
	.card-img {
		max-width: 100%;
		max-height: 180px;
		object-fit: contain;
		border-radius: 6px;
		align-self: flex-start;
	}
	.answer .card-img,
	.answer .play {
		margin-top: 6px;
	}
	.play {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--accent);
		border-radius: 99px;
		padding: 6px 14px;
		font-weight: 700;
		font-size: 14px;
		cursor: pointer;
	}
	.answer-btns {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.answer-btns .btn {
		padding-block: 16px;
		font-size: 17px;
	}

	.result {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.split {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}
	.split div {
		border-radius: 12px;
		padding: 12px 14px;
	}
	.split .ok {
		background: var(--ok-soft);
		color: var(--ok);
	}
	.split .bd {
		background: var(--bad-soft);
		color: var(--bad);
	}
	.split strong {
		display: block;
		font: 700 28px var(--font-display);
		font-variant-numeric: tabular-nums;
	}
	.again {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.again li {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 0;
		border-bottom: 1px solid var(--line);
	}
	.again li span:last-child {
		color: var(--muted);
		text-align: right;
	}
</style>
