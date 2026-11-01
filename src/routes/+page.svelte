<svelte:head>
	<title>Karteikasten</title>
</svelte:head>

<main class="home">
	<h1>Karteikasten</h1>
	<p>Du bist angemeldet. Übersicht, Stapel und Lernrunde kommen als Nächstes.</p>
	<form method="POST" action="/logout">
		<button type="submit" class="btn">Abmelden</button>
	</form>
</main>

<style>
	.home {
		max-width: 680px;
		margin: 0 auto;
		padding-block: 32px;
		display: grid;
		gap: 16px;
		justify-items: start;
	}
</style>
