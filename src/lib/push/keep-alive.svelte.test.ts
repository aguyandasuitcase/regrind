import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ios = vi.hoisted(() => ({ value: true }));
const geo = vi.hoisted(() => ({
	permission: "granted" as string,
	callback: null as null | ((position: unknown, error?: string) => void),
}));

vi.mock("#lib/platform/os.ts", () => ({ isIosPlatform: () => ios.value }));
vi.mock("@tauri-apps/plugin-geolocation", () => ({
	checkPermissions: vi.fn(() => Promise.resolve({ location: geo.permission })),
	requestPermissions: vi.fn(() => {
		geo.permission = "granted";
		return Promise.resolve({ location: geo.permission });
	}),
	watchPosition: vi.fn((_options: unknown, cb: typeof geo.callback) => {
		geo.callback = cb;
		return Promise.resolve(7);
	}),
	clearWatch: vi.fn(() => Promise.resolve()),
}));

import * as geolocation from "@tauri-apps/plugin-geolocation";

import { keepAlive } from "#lib/push/keep-alive.svelte.ts";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
	keepAlive.stop();
	vi.mocked(geolocation.watchPosition).mockClear();
	vi.mocked(geolocation.clearWatch).mockClear();
	vi.mocked(geolocation.requestPermissions).mockClear();
	geo.permission = "granted";
	geo.callback = null;
	ios.value = true;
});

afterEach(() => {
	keepAlive.stop();
});

describe("keepAlive", () => {
	it("watches the location on iOS", async () => {
		keepAlive.start();
		await flush();
		expect(geolocation.watchPosition).toHaveBeenCalledTimes(1);
		expect(keepAlive.running).toBe(true);
	});

	it("does nothing off iOS", async () => {
		ios.value = false;
		keepAlive.start();
		await flush();
		expect(geolocation.watchPosition).not.toHaveBeenCalled();
		expect(keepAlive.running).toBe(false);
	});

	it("asks for location permission when it is still undecided", async () => {
		geo.permission = "prompt";
		keepAlive.start();
		await flush();
		expect(geolocation.requestPermissions).toHaveBeenCalled();
		expect(geolocation.watchPosition).toHaveBeenCalledTimes(1);
	});

	it("does not watch when location permission is denied", async () => {
		geo.permission = "denied";
		keepAlive.start();
		await flush();
		expect(geolocation.watchPosition).not.toHaveBeenCalled();
		expect(keepAlive.running).toBe(false);
	});

	it("is not running after a location error", async () => {
		keepAlive.start();
		await flush();
		geo.callback?.(null, "denied");
		expect(keepAlive.running).toBe(false);
	});

	it("clears the location watch on stop", async () => {
		keepAlive.start();
		await flush();
		keepAlive.stop();
		await flush();
		expect(geolocation.clearWatch).toHaveBeenCalledWith(7);
		expect(keepAlive.running).toBe(false);
	});

	it("keeps one watch when started again", async () => {
		keepAlive.start();
		keepAlive.start();
		await flush();
		expect(geolocation.watchPosition).toHaveBeenCalledTimes(1);
	});

	it("does not start a watch that was stopped while asking permission", async () => {
		geo.permission = "prompt";
		keepAlive.start();
		keepAlive.stop();
		await flush();
		expect(geolocation.watchPosition).not.toHaveBeenCalled();
	});
});
