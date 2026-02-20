/// <reference types="vitest" />
import { getViteConfig } from "astro/config";
import { playwright } from "@vitest/browser-playwright";
import { astroRenderer } from "vitest-browser-astro/plugin";
import { getContainerRenderer as getReactRenderer } from "@astrojs/react";
import { getContainerRenderer as getVueRenderer } from "@astrojs/vue";
import { getContainerRenderer as getSvelteRenderer } from "@astrojs/svelte";

export default getViteConfig({
	plugins: [
		astroRenderer({
			renderers: [getReactRenderer(), getVueRenderer(), getSvelteRenderer()],
		}),
	],
	test: {
		include: ["test/**/*.test.ts"],
		browser: {
			enabled: true,
			instances: [{ browser: "chromium" }],
			provider: playwright(),
			headless: true,
		},
	},
});
