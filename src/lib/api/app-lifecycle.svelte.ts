import { callMethod } from "#lib/api/methods.ts";
import { isMobilePlatform } from "#lib/platform/os.ts";
import { keepAlive } from "#lib/push/keep-alive.svelte.ts";

class AppLifecycle {
	active = $state(true);
	#pending: Promise<void> | null = null;

	constructor() {
		if (typeof document === "undefined" || !isMobilePlatform()) return;
		document.addEventListener("visibilitychange", () => {
			// While the keep-alive runs the app is meant to stay reachable in the
			// background, so it must not tell the backend it went away.
			if (document.visibilityState === "hidden") {
				if (!keepAlive.running) void this.deactivate();
			} else void this.activate();
		});
	}

	activate(): Promise<void> {
		return this.#set(true);
	}

	deactivate(): Promise<void> {
		return this.#set(false);
	}

	#set(active: boolean): Promise<void> {
		if (this.active === active) return this.#pending ?? Promise.resolve();
		this.active = active;
		this.#pending = callMethod("set_app_active", { active })
			.then(() => undefined)
			.catch((error: unknown) => {
				console.error("[lifecycle] set_app_active failed", error);
			})
			.finally(() => {
				this.#pending = null;
			});
		return this.#pending;
	}
}

export const appLifecycle = new AppLifecycle();
