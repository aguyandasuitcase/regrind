import { afterEach, describe, expect, it, vi } from "vitest";

const plugin = vi.hoisted(() => ({
	active: vi.fn(),
	removeActive: vi.fn(() => Promise.resolve()),
}));

vi.mock("@tauri-apps/plugin-notification", () => ({
	active: plugin.active,
	removeActive: plugin.removeActive,
	isPermissionGranted: vi.fn(),
	onAction: vi.fn(),
	registerActionTypes: vi.fn(),
	requestPermission: vi.fn(),
	sendNotification: vi.fn(),
}));

import { notifications } from "#lib/notifications/notifications.svelte.ts";

const tauri = globalThis as {
	isTauri?: boolean;
	__TAURI_OS_PLUGIN_INTERNALS__?: { platform: string };
};

function runningOn(platform: string) {
	tauri.isTauri = true;
	tauri.__TAURI_OS_PLUGIN_INTERNALS__ = { platform };
}

afterEach(() => {
	delete tauri.isTauri;
	delete tauri.__TAURI_OS_PLUGIN_INTERNALS__;
	vi.clearAllMocks();
});

describe("withdrawing a conversation's notifications", () => {
	it("removes only that conversation's delivered notifications on iOS", async () => {
		runningOn("ios");
		plugin.active.mockResolvedValue([
			{ id: 1, group: "chat-a" },
			{ id: 2, group: "chat-b" },
			{ id: 3, group: "chat-a" },
			{ id: 4 },
		]);

		await notifications.withdrawConversation("chat-a");

		expect(plugin.removeActive).toHaveBeenCalledWith([{ id: 1 }, { id: 3 }]);
	});

	it("removes nothing when the conversation has none waiting", async () => {
		runningOn("ios");
		plugin.active.mockResolvedValue([{ id: 2, group: "chat-b" }]);

		await notifications.withdrawConversation("chat-a");

		expect(plugin.removeActive).not.toHaveBeenCalled();
	});

	it("does nothing off iOS", async () => {
		runningOn("macos");

		await notifications.withdrawConversation("chat-a");

		expect(plugin.active).not.toHaveBeenCalled();
	});

	it("survives the plugin failing", async () => {
		runningOn("ios");
		plugin.active.mockRejectedValue(new Error("boom"));
		const log = vi.spyOn(console, "error").mockImplementation(() => {});

		await expect(
			notifications.withdrawConversation("chat-a"),
		).resolves.toBeUndefined();
		log.mockRestore();
	});
});
