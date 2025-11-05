import type { Locator, LocatorSelectors } from "@vitest/browser/context";

/**
 * Metadata object that replaces .astro imports in browser context
 */
export interface AstroComponentMetadata {
	__astroComponent: true;
	__path: string;
	__name: string;
}

/**
 * Options for rendering an Astro component
 */
export interface RenderOptions {
	props?: Record<string, unknown>;
	slots?: Record<string, string>;
	container?: HTMLElement;
	baseElement?: HTMLElement;
}

/**
 * Result returned from render() function
 */
export interface RenderResult extends LocatorSelectors {
	element: () => HTMLElement;
}
