/// <reference types="vitest" />
import { getViteConfig } from "astro/config";
import { astroRenderer } from "vitest-browser-astro/plugin";

export default getViteConfig({
	plugins: [
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
		}),
	],
	test: {
		// Browser integration tests
		include: ["test/**/*.test.ts"],
		browser: {
			enabled: true,
			instances: [{ browser: "chromium" }],
			provider: "playwright",
			headless: true,
		},
	},
});
