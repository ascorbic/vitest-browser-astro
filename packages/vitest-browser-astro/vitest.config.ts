import { defineConfig } from 'vitest/config';
import { astroRenderer } from './src/plugin';

export default defineConfig({
	plugins: [astroRenderer()],
	test: {
		// Unit tests run in Node
		include: ['test/plugin.test.ts'],
		// Browser tests run separately
		exclude: ['test/browser.test.ts'],
	},
});
