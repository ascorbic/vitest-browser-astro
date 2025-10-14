# PRD: vitest-browser-astro

## Problem Statement

We need to enable testing Astro components in Vitest browser mode. The core challenge is that:

1. **Browser mode tests run in a real browser** - this is where we want to test interactivity
2. **Astro components can only be rendered in Node.js** - they use the Container API which requires Node
3. **Astro components can't even be imported in the browser** - they may contain Node-only imports (fs, path, etc.)

## Solution Architecture

### High-Level Flow

```
Test File (Browser)
    → Vite Plugin Transform (Compile Time)
        → Browser Command (Node.js Runtime)
            → Astro Container API (Node.js)
                → HTML String
            → Back to Browser
        → Inject HTML into DOM
    → Return DOM Node + Locators
```

### Three Core Components

#### 1. **Vite Plugin** (`src/plugin.ts`)
Intercepts `.astro` file imports and replaces them with metadata objects:

**What it does:**
- Intercepts any `.astro` file import using Vite's `load` hook
- Replaces the module with a metadata object containing file path and export name
- No AST parsing needed - just module interception
- Simple and robust - works with any way of calling `render()`

**Key Transform Example:**
```ts
// Test file (what developer writes):
import Card from '../components/Card.astro';
const result = await render(Card, { props: { title: "Test" } });

// What the plugin generates for the Card import:
export default {
  __astroComponent: true,
  __path: '/absolute/path/to/Card.astro',
  __name: 'default',
};

// render() just reads the metadata and calls the browser command:
async function render(component, options) {
  if (!component.__astroComponent) {
    throw new Error('Not an Astro component');
  }
  const { html } = await commands.renderAstro(
    component.__path,
    component.__name,
    options.props,
    options.slots
  );
  return injectHTML(html);
}
```

#### 2. **Browser Commands** (`src/plugin.ts` - Node side)
Vitest browser commands run in Node.js but can be called from browser test code:

**Command: `renderAstro`**
```ts
async function renderAstroCommand(
  ctx: BrowserCommandContext,
  componentPath: string,
  componentName: string,
  props?: Record<string, unknown>,
  slots?: Record<string, string>
) {
  // 1. Resolve absolute path
  const absolutePath = resolve(process.cwd(), componentPath);

  // 2. Load component using Vite SSR
  const module = await ctx.project.vite.ssrLoadModule(absolutePath);
  const Component = module.default || module[componentName];

  // 3. Create Astro Container with renderers
  const container = await experimental_AstroContainer.create({
    renderers: await loadRenderers([
      // Auto-detect from project config
    ])
  });

  // 4. Render with Container API
  const html = await container.renderToString(Component, {
    props,
    slots,
    request: new Request('http://localhost:3000/test'),
  });

  return { html };
}
```

**Why this works:**
- Runs in Node.js context (has access to file system, Container API)
- Has access to `ctx.project.vite` for SSR module loading
- Can use Astro Container API which only works in Node
- Returns serializable data (HTML string) back to browser

#### 3. **Pure Rendering Functions** (`src/pure.ts`)
Browser-side utilities that run after the HTML arrives:

```ts
export function injectHTML(
  html: string,
  options?: RenderOptions
): RenderResult {
  // 1. Create container in DOM
  const container = document.createElement('div');
  document.body.appendChild(container);

  // 2. Inject HTML (preserving scripts for hydration)
  setHTMLWithScripts(container, html);

  // 3. Return result with Vitest locators
  return {
    container,
    baseElement: document.body,
    unmount: () => container.remove(),
    ...getElementLocatorSelectors(container),
  };
}
```

### API Design

#### Simple API (for developers writing tests)

```ts
import { render } from 'vitest-browser-astro';
import Card from '../components/Card.astro';
import Button from '../components/Button.astro';

test('renders card with title', async () => {
  const screen = await render(Card, {
    props: { title: 'Hello World' },
    slots: {
      default: await render(Button, {
        props: { text: 'Click me' }
      })
    }
  });

  await expect.element(screen.getByText('Hello World')).toBeVisible();
});
```

#### Configuration (in vitest.config.ts)

```ts
import { defineConfig } from 'vitest/config';
import { astroRenderer } from 'vitest-browser-astro/plugin';

export default defineConfig({
  plugins: [
    astroRenderer(), // Must be first!
  ],
  test: {
    browser: {
      enabled: true,
      name: 'chromium',
      provider: 'playwright',
    },
  },
});
```

## Technical Deep Dives

### Challenge 1: Component Import Resolution

**Problem:** Test file imports `Card.astro`, but we need to pass the file path to Node.

**Solution:** Use Vite's `load` hook to intercept `.astro` imports:
```ts
export function astroRenderer() {
  return {
    name: 'vitest:astro-renderer',
    enforce: 'pre',

    async load(id) {
      if (!id.endsWith('.astro')) return null;

      // Replace the entire module with metadata
      return `
        export default {
          __astroComponent: true,
          __path: ${JSON.stringify(id)},
          __name: 'default',
        };
      `;
    },
  };
}
```

This approach is:
- **Simpler** - no AST parsing needed
- **More robust** - works regardless of how you use the import
- **Natural** - similar to how Vite handles assets, CSS modules, etc.
- **Debuggable** - component is just a plain object

### Challenge 2: Local Component Definitions

**Problem:** Component defined in test file itself:

```ts
const TestCard = defineComponent({ /* ... */ });
await render(TestCard, {});
```

**Solution:** Similar to vitest-browser-qwik:
1. Create temporary file with component exported
2. Load that temp file with ssrLoadModule
3. Clean up temp file after render
4. (Alternative: Use eval/vm in Node - less clean but possible)

### Challenge 3: Framework Component Hydration

**Problem:** Astro component contains `<Counter client:load />` (React)

**Solution:**
1. Auto-detect renderers from Astro config
2. Load renderers into Container:
```ts
import { loadRenderers } from 'astro:container';
import { getContainerRenderer as reactRenderer } from '@astrojs/react';

const renderers = await loadRenderers([reactRenderer()]);
const container = await experimental_AstroContainer.create({ renderers });
```
3. Rendered HTML includes hydration scripts
4. `setHTMLWithScripts()` ensures scripts execute in browser

### Challenge 4: Props Serialization

**Problem:** Props must cross the browser command boundary (browser → Node), so they must be serializable.

**Solution:** Follow Astro's serialization rules exactly (same as hydrated component props):

**Supported types:**
- plain object, `number`, `string`, `Array`
- `Map`, `Set`, `RegExp`, `Date`, `BigInt`, `URL`
- `Uint8Array`, `Uint16Array`, `Uint32Array`, `Infinity`

**NOT supported:**
- functions (cannot be serialized)

This matches Astro's own limitations for `client:*` components, so it's a natural constraint:

```ts
// ✅ Supported:
render(Card, {
  props: {
    title: 'Hello',
    count: 42,
    tags: ['astro', 'vitest'],
    createdAt: new Date(),
    config: { enabled: true }
  }
})

// ❌ NOT supported (same as Astro):
render(Card, {
  props: {
    onClick: () => alert('hi')  // Functions can't serialize
  }
})
```

For server-only behavior (like event handlers), users should use inline `<script>` tags in their Astro components, just like they do in regular Astro development.

## Implementation Plan

### Phase 1: Basic Rendering (MVP)
- [ ] Create Vite plugin skeleton
- [ ] Implement basic `render()` transform for imported components
- [ ] Implement `renderAstro` browser command
- [ ] Create `injectHTML()` pure function
- [ ] Support basic props (primitives only)
- [ ] Manual testing with simple Astro component

### Phase 2: Full Feature Set
- [ ] Support slots (default and named)
- [ ] Handle local component definitions
- [ ] Complex prop types (functions, objects)
- [ ] Auto-detect and load framework renderers
- [ ] Support nested render() calls
- [ ] Cleanup and unmount lifecycle

### Phase 3: DX Improvements
- [ ] TypeScript types for all APIs
- [ ] Error messages with helpful context
- [ ] Support for Astro.request, Astro.params, Astro.locals
- [ ] Documentation and examples
- [ ] Integration tests

### Phase 4: Advanced Features
- [ ] `renderToString()` for static HTML assertions
- [ ] Support for testing with different viewport sizes
- [ ] Snapshot testing integration
- [ ] Performance optimizations (caching Container instances)

## Key Files Structure

```
packages/vitest-browser-astro/
├── src/
│   ├── index.ts           # Main export (browser-side API)
│   ├── plugin.ts          # Vite plugin + browser commands
│   ├── pure.ts            # Browser-side pure functions
│   ├── types.ts           # TypeScript definitions
│   └── utils.ts           # Shared utilities
├── test/
│   └── index.test.ts      # Self-tests
└── package.json
```

## Dependencies

```json
{
  "dependencies": {
    "@vitest/browser": "^3.x"
  },
  "peerDependencies": {
    "astro": "^5.x",
    "vitest": "^3.x",
    "vite": "^6.x"
  }
}
```

Note: With import interception, we don't need `magic-string` or `oxc-parser`! Much simpler.

## Success Criteria

1. ✅ Can render simple Astro components in browser tests
2. ✅ Props are passed correctly
3. ✅ Slots work (default and named)
4. ✅ Framework components hydrate correctly (React, Vue, etc.)
5. ✅ Vitest locators work for querying DOM
6. ✅ Cleanup happens between tests
7. ✅ Error messages are helpful
8. ✅ TypeScript autocomplete works

## Open Questions for Matt

1. Should we support `renderStatic()` for non-hydrated testing? (faster)
2. How to handle Astro middleware/context in tests?
3. Should we cache Container instances between tests for performance?
4. Any specific framework integrations to prioritize?
