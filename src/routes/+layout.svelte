<script lang="ts">
	import '@fontsource-variable/bricolage-grotesque/opsz.css';
	import '@fontsource/atkinson-hyperlegible/latin-400.css';
	import '@fontsource/atkinson-hyperlegible/latin-700.css';
	import '@fontsource/ibm-plex-mono/latin-500.css';
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
