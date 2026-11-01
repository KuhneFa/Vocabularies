<script lang="ts">
	import { onDestroy } from 'svelte';
	import { canRecord, Recorder, shrinkImage } from '#lib/media-client.ts';
	import { toast } from '#lib/toast.svelte.ts';

	// One side of a new card: its text plus an optional image (photo or file) and
	// optional audio (recorded on the spot or a file).

	interface Props {
		id: string;
		label: string;
		placeholder: string;
		text: string;
		image: Blob | null;
		audio: Blob | null;
		recording: boolean;
	}

	let {
		id,
		label,
		placeholder,
		text = $bindable(),
		image = $bindable(),
		audio = $bindable(),
		recording = $bindable()
	}: Props = $props();

	const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

	let recorder: Recorder | null = null;
	let seconds = $state(0);
	let timer: ReturnType<typeof setInterval> | undefined;

	const imageUrl = $derived(image ? URL.createObjectURL(image) : null);
	const audioUrl = $derived(audio ? URL.createObjectURL(audio) : null);
	$effect(() => {
		const urls = [imageUrl, audioUrl];
		return () => urls.forEach((u) => u && URL.revokeObjectURL(u));
	});

	async function pickImage(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (file) image = await shrinkImage(file);
	}

	function pickAudio(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		if (file.size > MAX_AUDIO_BYTES) toast.show('Die Audiodatei ist größer als 15 MB.');
		else audio = file;
	}

	async function toggleRecording() {
		if (recording && recorder) {
			clearInterval(timer);
			recording = false;
			audio = await recorder.stop();
			recorder = null;
			return;
		}
		recorder = new Recorder();
		try {
			await recorder.start();
		} catch {
			recorder = null;
			toast.show('Kein Zugriff aufs Mikrofon. Erlaube es in den Einstellungen des Browsers.', 4000);
			return;
		}
		recording = true;
		seconds = 0;
		const started = Date.now();
		timer = setInterval(() => (seconds = Math.floor((Date.now() - started) / 1000)), 250);
	}

	onDestroy(() => {
		clearInterval(timer);
		recorder?.cancel();
	});

	const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
</script>

<div class="side">
	<div class="field">
		<label for={id}>{label}</label>
		<input {id} bind:value={text} required autocomplete="off" {placeholder} />
	</div>

	<div class="media-row">
		<label class="file">
			<input class="vh" type="file" accept="image/*" onchange={pickImage} />Bild / Foto
		</label>
		{#if canRecord()}
			<button type="button" class="file" class:rec={recording} onclick={toggleRecording}>
				{recording ? `■ Stopp ${clock(seconds)}` : '● Aufnehmen'}
			</button>
		{/if}
		<label class="file">
			<input class="vh" type="file" accept="audio/*" onchange={pickAudio} />Audio-Datei
		</label>
	</div>

	{#if imageUrl || audioUrl}
		<div class="previews">
			{#if imageUrl}
				<span class="pv">
					<img src={imageUrl} alt="Bildvorschau" />
					<button type="button" onclick={() => (image = null)} aria-label="Bild entfernen">×</button>
				</span>
			{/if}
			{#if audioUrl}
				<span class="pv">
					<audio controls src={audioUrl}></audio>
					<button type="button" onclick={() => (audio = null)} aria-label="Audio entfernen">×</button>
				</span>
			{/if}
		</div>
	{/if}
</div>

<style>
	.side {
		display: grid;
		gap: 10px;
		align-content: start;
		padding: 12px;
		border: 1px solid var(--line);
		border-radius: 12px;
		background: var(--bg);
		min-width: 0;
	}
	.side .field input {
		background: var(--surface);
	}
	.media-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
	}
	.file {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 7px 10px;
		border: 1px dashed var(--line);
		border-radius: 10px;
		font-size: 13px;
		font-weight: 700;
		color: var(--accent);
		background: var(--surface);
		cursor: pointer;
		font-variant-numeric: tabular-nums;
	}
	.file:hover {
		border-color: var(--accent);
	}
	.file:focus-within {
		outline: 3px solid var(--accent);
		outline-offset: 2px;
	}
	.file.rec {
		color: var(--bad);
		background: var(--bad-soft);
		border: 1px solid var(--bad);
	}
	.previews {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
	}
	.pv {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 6px;
		border: 1px solid var(--line);
		border-radius: 10px;
		max-width: 100%;
		min-width: 0;
	}
	.pv img {
		width: 56px;
		height: 56px;
		object-fit: cover;
		border-radius: 6px;
	}
	.pv audio {
		height: 34px;
		max-width: 220px;
		min-width: 0;
	}
	.pv button {
		background: none;
		border: 0;
		color: var(--muted);
		font-size: 18px;
		cursor: pointer;
		padding: 0 4px;
	}
</style>
