# vitest-browser-astro

Test Astro components in real browsers with [Vitest Browser Mode](https://vitest.dev/guide/browser/).

Astro components render server-side using the Container API. This library enables browser testing by rendering components on the server and injecting the HTML into the browser DOM. Tests run with real browser APIs.

## Installation

```bash
npm install -D vitest-browser-astro @vitest/browser playwright
```

Using pnpm:

```bash
pnpm add -D vitest-browser-astro @vitest/browser playwright
```

Using yarn:

```bash
yarn add -D vitest-browser-astro @vitest/browser playwright
```

## Quick Start

Create `vitest.config.ts`:

```ts
import { getViteConfig } from "astro/config";
import { astroRenderer } from "vitest-browser-astro/plugin";

export default getViteConfig({
	plugins: [astroRenderer()],
	test: {
		browser: {
			enabled: true,
			name: "chromium",
			provider: "playwright",
			headless: true,
		},
	},
});
```

Write a test file:

```ts
// src/components/Card.test.ts
import { render } from "vitest-browser-astro";
import { expect, test } from "vitest";
import Card from "./Card.astro";

test("renders card title", async () => {
	const screen = await render(Card, {
		props: {
			title: "Hello World",
		},
	});

	await expect.element(screen.getByText("Hello World")).toBeVisible();
});
```

Run tests:

```bash
npx vitest
```

## Configuration

### Plugin options

The `astroRenderer` plugin accepts optional configuration for framework support:

```ts
astroRenderer({
	serverRenderers: [
		{ module: "@astrojs/react/server.js" },
		{ module: "@astrojs/vue/server.js" },
		{ module: "@astrojs/svelte/server.js" },
	],
	clientRenderers: [
		{ name: "@astrojs/react", entrypoint: "@astrojs/react/client.js" },
		{ name: "@astrojs/vue", entrypoint: "@astrojs/vue/client.js" },
		{ name: "@astrojs/svelte", entrypoint: "@astrojs/svelte/client.js" },
	],
});
```

**Options:**

- `serverRenderers` - Array of server renderer configurations for SSR. Each entry requires:
  - `module` - Path to the server renderer module
- `clientRenderers` - Array of client renderer configurations for hydration. Each entry requires:
  - `name` - Integration name
  - `entrypoint` - Path to the client renderer entrypoint

### Browser providers

#### Playwright

```ts
export default getViteConfig({
	test: {
		browser: {
			enabled: true,
			name: "chromium", // or 'firefox', 'webkit'
			provider: "playwright",
			headless: true,
		},
	},
});
```

#### WebdriverIO

```ts
export default getViteConfig({
	test: {
		browser: {
			enabled: true,
			name: "chrome",
			provider: "webdriverio",
		},
	},
});
```

## Testing Astro Components

### `props` and `slots`

Render components with `props` and `slots` by passing them to `render()`:

```ts
import { render } from "vitest-browser-astro";
import { expect, test } from "vitest";
import Card from "./Card.astro";

test("renders slot content", async () => {
	const screen = await render(Card, {
		props: { title: "Card Title" },
		slots: {
			default: "<p>Main content</p>",
			footer: "<small>Footer text</small>",
		},
	});

	await expect.element(screen.getByText("Main content")).toBeInTheDocument();
	await expect.element(screen.getByText("Footer text")).toBeInTheDocument();
});
```

Props serialize automatically using [devalue](https://github.com/rich-harris/devalue), supporting Dates, RegExps, Maps, Sets, and other non-JSON types:

```ts
import { render } from "vitest-browser-astro";
import { expect, test } from "vitest";
import Post from "./Post.astro";

test("handles Date props", async () => {
	const screen = await render(Post, {
		props: {
			title: "My Post",
			publishedAt: new Date("2024-01-15T10:00:00Z"),
			tags: new Set(["astro", "testing"]),
			metadata: new Map([["author", "Jane"]]),
		},
	});

	await expect.element(screen.getByText(/January 15, 2024/)).toBeVisible();
});
```

### Interactive components with scripts

Components with inline scripts work without additional configuration:

```astro
---
// Toggle.astro
interface Props {
	label: string;
}
const { label } = Astro.props;
---

<button data-testid="toggle">
	{label}: <span data-testid="state">OFF</span>
</button>

<script>
	document.querySelectorAll('[data-testid="toggle"]').forEach((button) => {
		const stateEl = button.querySelector('[data-testid="state"]');
		let isOn = false;

		button.addEventListener("click", () => {
			isOn = !isOn;
			stateEl.textContent = isOn ? "ON" : "OFF";
		});
	});
</script>
```

Example test:

```ts
import { render } from "vitest-browser-astro";
import { userEvent } from "@vitest/browser/context";
import { expect, test } from "vitest";
import Toggle from "./Toggle.astro";

test("toggles state on click", async () => {
	const screen = await render(Toggle, {
		props: { label: "Power" },
	});

	const state = screen.getByTestId("state");
	await expect.element(state).toHaveTextContent("OFF");

	await userEvent.click(screen.getByTestId("toggle"));
	await expect.element(state).toHaveTextContent("ON");

	await userEvent.click(screen.getByTestId("toggle"));
	await expect.element(state).toHaveTextContent("OFF");
});
```

## Testing Framework Components

Framework components (e.g. React, Vue, Svelte) require configuration for both server-side rendering and client-side hydration.

### Setup

Add the framework integration to `astro.config.mjs`:

```js
import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
	integrations: [react()],
});
```

Configure both server and client renderers in `vitest.config.ts` (see [Configuration](#plugin-options) for details).

### Testing hydrated components

Framework components with client directives require hydration before becoming interactive. Use `client:load` directive and the `waitForHydration()` utility:

```ts
import { render, waitForHydration } from "vitest-browser-astro";
import { userEvent } from "@vitest/browser/context";
import { expect, test } from "vitest";
import Counter from "./Counter.astro";

test("React counter increments on click", async () => {
	const screen = await render(Counter);

	// Wait for hydration to complete
	await waitForHydration(screen.container);

	const count = screen.getByTestId("count");
	const button = screen.getByTestId("increment");

	await expect.element(count).toHaveTextContent("0");

	await userEvent.click(button);
	await expect.element(count).toHaveTextContent("1");
});
```

Example component:

```astro
---
// Counter.astro
import ReactCounter from "./ReactCounter.tsx";
---
<ReactCounter client:load />
```

Astro wraps framework components in `<astro-island>` elements with an `ssr` attribute during server-side rendering. This attribute is removed once client-side hydration completes.

The `waitForHydration()` function waits for this attribute to be removed before proceeding.

Pass `screen.container` to wait for all islands, or a specific island element to wait for just that one. An optional timeout can be specified (default: 5000ms):

```ts
await waitForHydration(screen.container, 10000); // Wait up to 10 seconds
```

Skip `waitForHydration()` for components without client directives.

### Supported frameworks

Only one JSX-based framework (React, Preact, or Solid) can be used at a time. The Astro Container API cannot distinguish between different JSX frameworks in the same test configuration. Non-JSX frameworks (Vue, Svelte) can be combined with any JSX framework.

## User Interactions

Use `@vitest/browser/context` for simulating user interactions:

```ts
import { userEvent } from "@vitest/browser/context";

await userEvent.click(button); // Click elements
await userEvent.type(input, "Hello"); // Type text
await userEvent.keyboard("{Enter}"); // Keyboard events
await userEvent.hover(element); // Hover
```

## API Reference

### `render(component, options?)`

Renders an Astro component and returns query utilities.

```ts
const screen = await render(Component, {
	props: { title: "Hello" },
	slots: { default: "<p>Content</p>" },
});
```

Returns `RenderResult` with:

- `container` - DOM element containing the rendered component
- `getByText(text)` - Find element by text content
- `getByTestId(id)` - Find element by `data-testid` attribute
- `getByRole(role)` - Find element by ARIA role
- `unmount()` - Remove the component from the DOM
- `debug()` - Log the DOM structure

### `waitForHydration(container, timeout?)`

Waits for framework component hydration to complete (default timeout: 5000ms).

```ts
await waitForHydration(screen.container);
```

### `cleanup()`

Removes all rendered components from the DOM. Called automatically between tests.

## Troubleshooting

### TypeScript errors with `.astro` imports

Ensure `tsconfig.json` extends Astro's base configuration:

```json
{
	"extends": "astro/tsconfigs/base"
}
```

Then restart the TypeScript server.

### Tests hanging or timing out

1. Install Playwright browsers: `npx playwright install`
2. Verify `browser.enabled: true` in Vitest config
3. Run with `headless: false` to debug visually

### Framework components not hydrating

1. Add the framework to both `serverRenderers` and `clientRenderers` in plugin options
2. Add the corresponding integration to `astro.config.mjs`
3. Use `client:load` directive on framework components
4. Call `waitForHydration()` before interacting with the component

For more issues, see [GitHub Issues](https://github.com/ascorbic/vitest-browser-astro/issues).

## Requirements

- Astro 5.x or later
- Vitest 3.x or later
- Vite 6.x or later

## Contributing

Contributions are welcome. Check the [GitHub repository](https://github.com/ascorbic/vitest-browser-astro) for issues and pull requests.

## License

MIT © [Matt Kane](https://github.com/ascorbic)
