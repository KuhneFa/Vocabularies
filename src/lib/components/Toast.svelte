<script lang="ts">
	import { toast } from '#lib/toast.svelte.ts';
</script>

<div class="toast" role="status" hidden={!toast.message}>{toast.message}</div>

<style>
	.toast {
		position: fixed;
		left: 50%;
		bottom: calc(20px + env(safe-area-inset-bottom, 0px));
		transform: translateX(-50%);
		background: var(--ink);
		color: var(--bg);
		padding: 10px 16px;
		border-radius: 10px;
		font-weight: 700;
		font-size: 14px;
		z-index: 20;
		max-width: calc(100% - 32px);
	}
	.toast[hidden] {
		display: none;
	}
</style>
