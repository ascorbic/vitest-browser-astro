import { defineConfig } from 'vitest/config';
import { astroRenderer } from './src/plugin';

export default defineConfig({
	plugins: [astroRenderer()],
	test: {
		// Browser integration tests
		include: ['test/browser.test.ts'],
		browser: {
			enabled: true,
			name: 'chromium',
			provider: 'playwright',
			headless: true,
		},
	},
});
