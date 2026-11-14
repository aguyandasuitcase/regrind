import {
	checkPermissions,
	clearWatch,
	requestPermissions,
	watchPosition,
} from "@tauri-apps/plugin-geolocation";

import { isIosPlatform } from "#lib/platform/os.ts";

/**
 * iOS suspends a backgrounded app within seconds, and the WebSocket that
 * produces our local notifications goes with it. An app with a running
 * location watch (UIBackgroundModes `location`) is not suspended, so this
 * keeps a low-accuracy watch going while the app is in the background.
 *
 * Experimental, and not a guarantee. The watch keeps the app process alive,
 * but whether iOS also keeps the page's JavaScript running depends on the iOS
 * version. iOS can still end the app under memory pressure, and a location
 * watch costs battery and shows the location indicator.
 *
 * It needs background updates enabled in the geolocation plugin, which
 * `src-tauri/patches/tauri-plugin-geolocation@*.patch` does when Info.plist
 * declares the `location` background mode.
 */
class KeepAlive {
	/** True while the location watch is actually delivering. */
	running = $state(false);
	#watch: Promise<number> | null = null;
	#wanted = false;
	#starting = false;
	#unlock: (() => void) | null = null;

	start(): void {
		if (!isIosPlatform() || typeof document === "undefined") return;
		this.#wanted = true;
		this.#play();
	}

	stop(): void {
		this.#wanted = false;
		this.#clearUnlock();
		this.running = false;
		const current = this.#watch;
		this.#watch = null;
		void current?.then((id) => clearWatch(id)).catch(() => undefined);
	}

	#play(): void {
		if (!this.#wanted) return;
		// A location prompt can need a tap first, so always be ready to retry on
		// the next tap.
		this.#waitForGesture();
		this.#begin().then(
			() => this.#clearUnlock(),
			() => undefined,
		);
	}

	async #begin(): Promise<void> {
		if (this.#watch || this.#starting) return;
		this.#starting = true;
		try {
			await this.#open();
		} finally {
			this.#starting = false;
		}
	}

	async #open(): Promise<void> {
		let permissions = await checkPermissions();
		if (
			permissions.location === "prompt" ||
			permissions.location === "prompt-with-rationale"
		)
			permissions = await requestPermissions(["location"]);
		if (permissions.location !== "granted")
			throw new Error("location permission not granted");
		if (!this.#wanted) return;
		const watch = watchPosition(
			{ enableHighAccuracy: false, timeout: 0, maximumAge: 0 },
			(_position, error) => {
				this.running = !error;
			},
		);
		this.#watch = watch;
		try {
			await watch;
		} catch (error) {
			if (this.#watch === watch) this.#watch = null;
			throw error;
		}
		this.running = this.#wanted;
	}

	#waitForGesture(): void {
		if (this.#unlock) return;
		const unlock = () => this.#play();
		this.#unlock = unlock;
		for (const type of ["touchend", "pointerup", "click"])
			document.addEventListener(type, unlock, { passive: true });
	}

	#clearUnlock(): void {
		const unlock = this.#unlock;
		if (!unlock) return;
		for (const type of ["touchend", "pointerup", "click"])
			document.removeEventListener(type, unlock);
		this.#unlock = null;
	}
}

export const keepAlive = new KeepAlive();
