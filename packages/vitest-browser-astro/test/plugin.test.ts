import { describe, it, expect } from 'vitest';
import { astroRenderer } from '../src/plugin';

describe('astroRenderer plugin', () => {
	it('should have the correct name', () => {
		const plugin = astroRenderer();
		expect(plugin.name).toBe('vitest:astro-renderer');
	});

	it('should enforce "pre" to run before other plugins', () => {
		const plugin = astroRenderer();
		expect(plugin.enforce).toBe('pre');
	});

	describe('load hook', () => {
		it('should intercept .astro file imports', async () => {
			const plugin = astroRenderer();
			const id = '/path/to/Component.astro';

			const result = await plugin.load?.(id);

			expect(result).toBeTruthy();
			expect(typeof result).toBe('string');
			expect(result).toContain('__astroComponent: true');
			expect(result).toContain('__path:');
			expect(result).toContain('__name: "default"');
		});

		it('should include the full path in metadata', async () => {
			const plugin = astroRenderer();
			const id = '/absolute/path/to/Card.astro';

			const result = await plugin.load?.(id);

			expect(result).toContain(JSON.stringify(id));
		});

		it('should NOT intercept non-.astro files', async () => {
			const plugin = astroRenderer();

			expect(await plugin.load?.('/path/to/file.ts')).toBeNull();
			expect(await plugin.load?.('/path/to/file.tsx')).toBeNull();
			expect(await plugin.load?.('/path/to/file.js')).toBeNull();
			expect(await plugin.load?.('/path/to/file.jsx')).toBeNull();
		});

		it('should return valid JavaScript code', async () => {
			const plugin = astroRenderer();
			const id = '/path/to/Component.astro';

			const result = await plugin.load?.(id);

			// Should not throw when parsed
			expect(() => new Function(result as string)).not.toThrow();
		});
	});

	describe('generated metadata object', () => {
		it('should be a valid export default statement', async () => {
			const plugin = astroRenderer();
			const result = await plugin.load?.('/path/to/Component.astro');

			expect(result).toContain('export default');
		});

		it('should have __astroComponent flag', async () => {
			const plugin = astroRenderer();
			const result = await plugin.load?.('/path/to/Component.astro');

			expect(result).toMatch(/__astroComponent:\s*true/);
		});

		it('should have __path property', async () => {
			const plugin = astroRenderer();
			const result = await plugin.load?.('/path/to/Component.astro');

			expect(result).toMatch(/__path:\s*"/);
		});

		it('should have __name property set to "default"', async () => {
			const plugin = astroRenderer();
			const result = await plugin.load?.('/path/to/Component.astro');

			expect(result).toMatch(/__name:\s*"default"/);
		});
	});
});
