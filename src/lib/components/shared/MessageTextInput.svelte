<script lang="ts">
	import type { Snippet } from "svelte";

	import { Textarea } from "#lib/components/ui/textarea/index.ts";
	import { isMobilePlatform } from "#lib/platform/os.ts";

	let {
		value = $bindable(),
		ref = $bindable(null),
		onEscape,
		placeholder,
		padding,
		disabled,
		onkeydown,
		trailing,
		...props
	}: import("svelte").ComponentProps<typeof Textarea> & {
		padding: string;
		onEscape?: () => void;
		/** A button inside the field's end, on its last line. */
		trailing?: Snippet;
	} = $props();

	const isMobile = isMobilePlatform();

	// https://bugs.webkit.org/show_bug.cgi?id=165004
	function isCompositionKeydown(event: KeyboardEvent): boolean {
		return event.isComposing || event.keyCode === 229;
	}

	// An on-screen keyboard's return key starts a new line, so only a key press
	// from a physical keyboard sends on a touch device. Those carry a key code
	// ("Enter"); the on-screen keyboard's presses have none.
	function sendsOnEnter(event: KeyboardEvent): boolean {
		if (!isMobile) return true;
		return event.code === "Enter" || event.code === "NumpadEnter";
	}
</script>

<div class="relative flex min-w-0 flex-1">
	<Textarea
		{...props}
		{placeholder}
		class={[
			"h-fit! max-h-31.5 min-h-10 flex-1 rounded-md border-0 bg-muted py-2.5 leading-5 placeholder-shown:truncate",
			padding,
		]}
		enterkeyhint={isMobile ? "enter" : "send"}
		onkeydown={(
			event: KeyboardEvent & {
				currentTarget: EventTarget & HTMLTextAreaElement;
			},
		) => {
			onkeydown?.(event);
			if (event.key === "Escape" && onEscape) {
				event.preventDefault();
				onEscape();
				return;
			}
			if (
				event.key === "Enter" &&
				!event.shiftKey &&
				!isCompositionKeydown(event) &&
				sendsOnEnter(event)
			) {
				event.preventDefault();
				event.currentTarget.form?.requestSubmit();
			}
		}}
		bind:value
		bind:ref
		{disabled}
	/>
	{#if trailing}
		<div class="absolute right-1 bottom-1">{@render trailing()}</div>
	{/if}
</div>
