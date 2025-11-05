import { getElementLocatorSelectors } from "@vitest/browser/utils";
import type { Locator } from "@vitest/browser/context";
import { expect } from "vitest";
import type { RenderOptions, RenderResult } from "./types";

const mountedContainers = new Set<HTMLElement>();

/**
 * Injects HTML with proper script execution for hydration
 * Extracts and re-adds scripts to ensure they execute after DOM is ready
 */
function setHTMLWithScripts(container: HTMLElement, html: string): void {
	// Create a temporary container to parse the HTML
	const temp = document.createElement("div");
	temp.innerHTML = html;

	// Extract script elements and their attributes
	const scriptElements = Array.from(temp.querySelectorAll("script"));
	const scriptData = scriptElements.map((script) => ({
		src: script.getAttribute("src"),
		type: script.getAttribute("type"),
		textContent: script.textContent,
	}));

	// Remove scripts from the temp container
	scriptElements.forEach((script) => script.remove());

	// Insert the HTML without scripts first
	const range = document.createRange();
	range.selectNode(container);
	const fragment = range.createContextualFragment(temp.innerHTML);
	container.appendChild(fragment);

	// Now add scripts - they will execute after the DOM is ready
	// Add a unique timestamp to module script URLs to bypass browser caching
	// This ensures scripts re-execute for each dynamically injected component
	scriptData.forEach(({ src, type, textContent }) => {
		const script = document.createElement("script");
		if (type) script.type = type;
		if (src) {
			// Add timestamp to prevent module caching for dynamic injection
			const separator = src.includes("?") ? "&" : "?";
			script.src = `${src}${separator}_t=${Date.now()}`;
		}
		if (textContent) script.textContent = textContent;
		container.appendChild(script);
	});
}

/**
 * Sets up container elements in the DOM
 */
function setupContainer(
	baseElement?: HTMLElement,
	container?: HTMLElement,
): { container: HTMLElement; baseElement: HTMLElement } {
	if (!baseElement) {
		baseElement = document.body;
	}

	if (!container) {
		container = document.createElement("div");
		baseElement.appendChild(container);
	}

	return { container, baseElement };
}

/**
 * Creates a render result with locators
 */
function createRenderResult(
	container: HTMLElement,
	baseElement: HTMLElement,
): RenderResult {
	mountedContainers.add(container);
	return {
		element: () => container,
		...getElementLocatorSelectors(baseElement),
	};
}

/**
 * Injects rendered HTML into the DOM and returns a render result
 * This runs in the browser after the HTML arrives from Node
 */
export function injectHTML(
	html: string,
	options: RenderOptions = {},
): RenderResult {
	const { container, baseElement } = setupContainer(
		options.baseElement,
		options.container,
	);

	setHTMLWithScripts(container, html);

	return createRenderResult(container, baseElement);
}

/**
 * Cleanup function to remove all mounted containers
 */
export async function cleanup(): Promise<void> {
	mountedContainers.forEach((container) => {
		container.innerHTML = "";
		if (container.parentNode === document.body) {
			document.body.removeChild(container);
		}
	});
	mountedContainers.clear();
}

/**
 * Wait for Astro island hydration to complete.
 *
 * When Astro renders framework components with client directives (e.g., client:load),
 * it wraps them in <astro-island> elements. The island has an 'ssr' attribute during
 * server-side rendering, which is removed once client-side hydration completes.
 *
 * Call this before interacting with framework components to ensure event handlers
 * are attached and the component is fully interactive.
 *
 * @param container - Either a Locator or RenderResult to search for astro-island children
 *
 * @example
 * ```ts
 * // Wait for all islands in the render result
 * const screen = await render(Counter);
 * await waitForHydration(screen);
 *
 * // Wait for a specific island
 * await waitForHydration(screen.getByTestId('my-island'));
 * ```
 */
export async function waitForHydration(
	container: Locator | RenderResult,
): Promise<void> {
	// Poll until all astro-island children no longer have the ssr attribute
	await expect
		.poll(
			() => container.element().querySelectorAll("astro-island[ssr]").length,
		)
		.toBe(0);
}
