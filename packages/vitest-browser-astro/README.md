# vitest-browser-astro

Test Astro components in real browsers with [Vitest Browser Mode](https://vitest.dev/guide/browser/).

Astro components render server-side using the [Container API](https://docs.astro.build/en/reference/container-reference/). This library enables browser testing by rendering components on the server and injecting the HTML into the browser DOM. Tests run with real browser APIs.

## Installation

```bash
npm install -D vitest-browser-astro @vitest/browser playwright
```

Using pnpm:

```bash
pnpm add -D vitest-browser-astro @vitest/browser playwright
```

**Note:** This package currently requires Vitest 3.x. Vitest 4 is not yet compatible with Astro.

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
			provider: "playwright", // or 'webdriverio'
			headless: true,
		},
	},
});
```

For Astro pages that contain framework components (React, Vue, etc.), add renderers using `getContainerRenderer()` from your framework integration packages - see [Plugin options](#plugin-options).

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

See the [test fixture](https://github.com/ascorbic/vitest-browser-astro/tree/main/packages/vitest-browser-astro/test/fixtures/astro-site) for a complete working example.

## Configuration

### Plugin options

The `astroRenderer` plugin uses the [Astro Container API](https://docs.astro.build/en/reference/container-reference/) (experimental) for framework support. Configure it with `getContainerRenderer()` from your framework integration packages:

```ts
import { getContainerRenderer as getReactRenderer } from "@astrojs/react";
import { getContainerRenderer as getVueRenderer } from "@astrojs/vue";

astroRenderer({
	renderers: [getReactRenderer(), getVueRenderer()],
});
```

**Options:**

- `renderers` - Array of framework renderers obtained from `getContainerRenderer()`. Pass these if your Astro components use framework integrations.

**Note:** Only one JSX-based framework (React, Preact, or Solid) can be used at a time. Non-JSX frameworks (Vue, Svelte) can be combined with any JSX framework.

See the [Container API renderers documentation](https://docs.astro.build/en/reference/container-reference/#renderers-option) for more details.

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

Props are serialized using [devalue](https://github.com/rich-harris/devalue), and can be JSON primitives, `Date`s, `RegExp`s, `Map`s, or `Set`s.

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

Configure framework renderers in `vitest.config.ts` using `getContainerRenderer()`:

```ts
import { getViteConfig } from "astro/config";
import { astroRenderer } from "vitest-browser-astro/plugin";
import { getContainerRenderer as getReactRenderer } from "@astrojs/react";

export default getViteConfig({
	plugins: [
		astroRenderer({
			renderers: [getReactRenderer()],
		}),
	],
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
	await waitForHydration(screen);

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

Pass the `screen` result to wait for all islands, or a specific locator to wait for islands within that element:

```ts
// Wait for all islands in the component
await waitForHydration(screen);

// Wait for islands within a specific element
await waitForHydration(screen.getByTestId("header"));
```

Skip `waitForHydration()` for components without client directives. You can also manually check for hydration by waiting for the `ssr` attribute to be removed:

```ts
await expect
	.element(screen.getByTestId("my-island"))
	.not.toHaveAttribute("ssr");
```

### Supported frameworks

Any [front-end framework](https://docs.astro.build/en/guides/framework-components/) with an Astro adapter is supported. Only one JSX-based framework (React, Preact, or Solid) can be used at a time because the Astro Container API cannot distinguish between different JSX frameworks in the same test configuration. Non-JSX frameworks (Vue, Svelte) can be combined with any JSX framework.

## User Interactions

Use `userEvent` from `@vitest/browser/context` for simulating user interactions:

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

Returns an object which includes Vitest Browser's [locator selectors](https://vitest.dev/guide/browser/#locators) and an `.element()` method.

- `element()` - Returns the DOM element containing the rendered component
- `getByRole(role)` - Find element by ARIA role
- `getByAltText(altText)` - Find element by alt text
- `getByLabelText(labelText)` - Find element by associated label text
- `getByPlaceholder(placeholderText)` - Find element by placeholder text
- `getByText(text)` - Find element by text content
- `getByTitle(title)` - Find element by title attribute
- `getByTestId(id)` - Find element by `data-testid` attribute

### `waitForHydration(locator)`

Waits for framework component hydration to complete.

```ts
// Wait for all islands
await waitForHydration(screen);

// Wait for islands within a specific element
await waitForHydration(screen.getByTestId("footer"));
```

### `cleanup()`

Removes all rendered components from the DOM. Called automatically between tests.

## Troubleshooting

### Framework components not hydrating

1. Add the framework renderer using `getContainerRenderer()` in plugin options
2. Add the corresponding integration to `astro.config.mjs`
3. Use `client:load` directive on framework components
4. Call `waitForHydration()` before interacting with the component

For more issues, see [GitHub Issues](https://github.com/ascorbic/vitest-browser-astro/issues).

## Requirements

- Astro 5.x or later
- Vitest 3.x (Vitest 4 is not yet compatible with Astro)
- Vite 6.x or later

## Contributing

Contributions are welcome. Check the [GitHub repository](https://github.com/ascorbic/vitest-browser-astro) for issues and pull requests.

## License

MIT © [Matt Kane](https://github.com/ascorbic)
