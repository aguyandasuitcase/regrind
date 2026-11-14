// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

import MessageTextInput from "./MessageTextInput.svelte";

const tauri = globalThis as {
	isTauri?: boolean;
	__TAURI_OS_PLUGIN_INTERNALS__?: { platform: string };
};

function runningOn(platform: string) {
	tauri.isTauri = true;
	tauri.__TAURI_OS_PLUGIN_INTERNALS__ = { platform };
}

afterEach(() => {
	cleanup();
	delete tauri.isTauri;
	delete tauri.__TAURI_OS_PLUGIN_INTERNALS__;
});

async function typeEnter(
	platform: string,
	init: KeyboardEventInit,
) {
	runningOn(platform);
	const submit = vi.fn((event: Event) => event.preventDefault());
	const { container } = render(MessageTextInput, {
		value: "hello",
		padding: "",
		placeholder: "Say something...",
	});
	const form = document.createElement("form");
	form.addEventListener("submit", submit);
	const input = screen.getByPlaceholderText("Say something...");
	container.append(form);
	form.append(input);
	const event = new KeyboardEvent("keydown", {
		key: "Enter",
		bubbles: true,
		cancelable: true,
		...init,
	});
	input.dispatchEvent(event);
	await Promise.resolve();
	return { submitted: submit.mock.calls.length > 0, event };
}

describe("sending with the Enter key", () => {
	it("sends on desktop", async () => {
		const { submitted, event } = await typeEnter("macos", {});
		expect(submitted).toBe(true);
		expect(event.defaultPrevented).toBe(true);
	});

	it("keeps Shift+Enter as a new line on desktop", async () => {
		const { submitted } = await typeEnter("macos", { shiftKey: true });
		expect(submitted).toBe(false);
	});

	it("sends on iOS when Enter comes from a physical keyboard", async () => {
		const { submitted } = await typeEnter("ios", { code: "Enter" });
		expect(submitted).toBe(true);
	});

	it("sends on iOS for the keypad Enter of a physical keyboard", async () => {
		const { submitted } = await typeEnter("ios", { code: "NumpadEnter" });
		expect(submitted).toBe(true);
	});

	it("keeps Shift+Enter as a new line on iOS", async () => {
		const { submitted } = await typeEnter("ios", {
			code: "Enter",
			shiftKey: true,
		});
		expect(submitted).toBe(false);
	});

	it("leaves the on-screen keyboard's return key as a new line on iOS", async () => {
		const { submitted, event } = await typeEnter("ios", { code: "" });
		expect(submitted).toBe(false);
		expect(event.defaultPrevented).toBe(false);
	});

	it("does not send while text is being composed", async () => {
		const { submitted } = await typeEnter("ios", {
			code: "Enter",
			isComposing: true,
		});
		expect(submitted).toBe(false);
	});

	it("does not send on Android from the on-screen keyboard", async () => {
		const { submitted } = await typeEnter("android", { code: "" });
		expect(submitted).toBe(false);
	});
});
