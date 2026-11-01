<script lang="ts">
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>Anmelden · Karteikasten</title>
</svelte:head>

<main class="login">
	<h1>Karteikasten</h1>

	{#if data.passwordSet}
		<form method="POST" class="card">
			<label for="password">Passwort</label>
			<input id="password" name="password" type="password" autocomplete="current-password" required />
			{#if form?.message}
				<p class="error" role="alert">{form.message}</p>
			{/if}
			<button type="submit" class="btn primary">Anmelden</button>
		</form>
	{:else}
		<p class="card">
			Es ist noch kein Passwort festgelegt. Setze <code>APP_PASSWORD</code> in der <code>.env</code>-Datei
			und starte die App neu.
		</p>
	{/if}
</main>

<style>
	.login {
		max-width: 380px;
		margin: 0 auto;
		padding-block: 15vh 48px;
		display: grid;
		gap: 20px;
	}
	.card {
		display: grid;
		gap: 10px;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 14px;
		padding: 18px;
	}
	label {
		font-size: 14px;
		font-weight: 700;
		color: var(--muted);
	}
	input {
		padding: 12px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--bg);
		font-size: 16px;
	}
	.error {
		color: var(--bad);
		font-size: 14px;
	}
</style>
