class Toast {
	message = $state('');
	#timer: ReturnType<typeof setTimeout> | undefined;

	show(message: string, ms = 2200) {
		this.message = message;
		clearTimeout(this.#timer);
		this.#timer = setTimeout(() => (this.message = ''), ms);
	}
}

export const toast = new Toast();
