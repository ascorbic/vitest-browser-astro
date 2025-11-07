import { commands } from "vitest/browser";
import { beforeEach } from "vitest";
import { stringify } from "devalue";
import type { AstroComponentFactory } from "astro/runtime/server/index.js";
import { cleanup, injectHTML } from "./pure";
import type {
	AstroComponentMetadata,
	RenderOptions,
	RenderResult,
} from "./types";

export type {
	AstroComponentMetadata,
	RenderOptions,
	RenderResult,
} from "./types";

export { cleanup, waitForHydration } from "./pure";

/**
 * Renders an Astro component in the browser using Vitest browser mode
 *
 * @param component - The imported Astro component (will be metadata object after plugin transform)
 * @param options - Render options including props and slots
 * @returns RenderResult with container, locators, and cleanup functions
 *
 * @example
 * ```ts
 * import { render } from 'vitest-browser-astro';
 * import Card from './Card.astro';
 *
 * test('renders card', async () => {
 *   const screen = await render(Card, {
 *     props: { title: 'Hello' }
 *   });
 *   await expect.element(screen.getByText('Hello')).toBeVisible();
 * });
 * ```
 */
export async function render(
	component: AstroComponentFactory | AstroComponentMetadata,
	options: RenderOptions = {},
): Promise<RenderResult> {
	// Cast to metadata object - at runtime this will be our transformed metadata
	const metadata = component as unknown as AstroComponentMetadata;

	// Validate that this is an Astro component metadata object
	if (!metadata?.__astroComponent) {
		throw new Error(
			"Not an Astro component. Make sure you imported an .astro file and the vitest-browser-astro plugin is configured.",
		);
	}

	// Serialize props using devalue to preserve Dates, RegExps, etc.
	const serializedProps = options.props ? stringify(options.props) : undefined;

	// Call the browser command to render in Node.js
	const { html } = await commands.renderAstro(
		metadata.__path,
		metadata.__name,
		serializedProps,
		options.slots,
	);

	// Inject the HTML into the browser DOM
	return injectHTML(html, {
		container: options.container,
		baseElement: options.baseElement,
	});
}

// Automatically cleanup between tests
beforeEach(async () => {
	await cleanup();
});

// Extend Vitest browser context types
declare module "vitest/browser" {
	interface BrowserCommands {
		renderAstro: (
			componentPath: string,
			componentName: string,
			serializedProps?: string,
			slots?: Record<string, string>,
		) => Promise<{ html: string }>;
	}
}
