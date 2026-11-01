// Media handling in the browser: shrink photos before upload, record audio.

/** Scales a photo down to at most `max` pixels on the long side, as JPEG. */
export async function shrinkImage(file: File, max = 1280): Promise<Blob> {
	try {
		const bitmap = await createImageBitmap(file);
		const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
		const canvas = document.createElement('canvas');
		canvas.width = Math.round(bitmap.width * scale);
		canvas.height = Math.round(bitmap.height * scale);
		canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
		bitmap.close();
		return await new Promise<Blob>((resolve, reject) =>
			canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/jpeg', 0.85)
		);
	} catch {
		// a format this browser cannot decode: upload as is and let the server decide
		return file;
	}
}

/** Recording needs a secure context (HTTPS or localhost) and MediaRecorder. */
export function canRecord(): boolean {
	return !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
}

export class Recorder {
	#stream: MediaStream | null = null;
	#recorder: MediaRecorder | null = null;
	#chunks: Blob[] = [];

	async start() {
		this.#stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		this.#chunks = [];
		this.#recorder = new MediaRecorder(this.#stream);
		this.#recorder.ondataavailable = (e) => {
			if (e.data.size > 0) this.#chunks.push(e.data);
		};
		this.#recorder.start();
	}

	/** Stops and returns the recording (m4a on the iPhone, webm or ogg elsewhere). */
	stop(): Promise<Blob> {
		const recorder = this.#recorder!;
		return new Promise((resolve) => {
			recorder.onstop = () => {
				this.#release();
				resolve(new Blob(this.#chunks, { type: recorder.mimeType || 'audio/mp4' }));
			};
			recorder.stop();
		});
	}

	cancel() {
		if (this.#recorder?.state === 'recording') {
			this.#recorder.onstop = null;
			this.#recorder.stop();
		}
		this.#release();
	}

	#release() {
		this.#stream?.getTracks().forEach((t) => t.stop());
		this.#stream = null;
	}
}
