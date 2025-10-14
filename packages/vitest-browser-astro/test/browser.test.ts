import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '../src/index';
import SimpleCard from './fixtures/SimpleCard.astro';
import WithSlots from './fixtures/WithSlots.astro';
import ComplexProps from './fixtures/ComplexProps.astro';

describe('render() in browser', () => {
	beforeEach(async () => {
		// Clean up between tests
		document.body.innerHTML = '';
	});

	describe('basic rendering', () => {
		it('should render a simple Astro component', async () => {
			const screen = await render(SimpleCard, {
				props: {
					title: 'Hello World',
				},
			});

			expect(screen.container).toBeTruthy();
			expect(screen.container).toBeInstanceOf(HTMLElement);
			await expect.element(screen.getByTestId('card')).toBeInTheDocument();
		});

		it('should render component with all props', async () => {
			const screen = await render(SimpleCard, {
				props: {
					title: 'Test Card',
					description: 'This is a test description',
				},
			});

			await expect.element(screen.getByText('Test Card')).toBeVisible();
			await expect
				.element(screen.getByText('This is a test description'))
				.toBeVisible();
		});

		it('should handle optional props', async () => {
			const screen = await render(SimpleCard, {
				props: {
					title: 'Only Title',
				},
			});

			await expect.element(screen.getByText('Only Title')).toBeVisible();
			// Description should not be rendered
			expect(screen.container.querySelector('p')).toBeNull();
		});
	});

	describe('complex props', () => {
		it('should handle number props', async () => {
			const screen = await render(ComplexProps, {
				props: {
					count: 42,
					tags: [],
					config: { enabled: true, theme: 'dark' },
					createdAt: new Date('2024-01-01'),
				},
			});

			await expect.element(screen.getByTestId('count')).toHaveTextContent('42');
		});

		it('should handle array props', async () => {
			const screen = await render(ComplexProps, {
				props: {
					count: 0,
					tags: ['astro', 'vitest', 'testing'],
					config: { enabled: true, theme: 'light' },
					createdAt: new Date('2024-01-01'),
				},
			});

			const tagsList = screen.getByTestId('tags');
			await expect.element(tagsList).toBeInTheDocument();
			expect(tagsList.querySelectorAll('li')).toHaveLength(3);
		});

		it('should handle nested object props', async () => {
			const screen = await render(ComplexProps, {
				props: {
					count: 0,
					tags: [],
					config: { enabled: false, theme: 'dark' },
					createdAt: new Date('2024-01-01'),
				},
			});

			await expect
				.element(screen.getByTestId('config'))
				.toHaveTextContent('disabled - dark');
		});

		it('should handle Date props', async () => {
			const testDate = new Date('2024-03-15T10:30:00Z');
			const screen = await render(ComplexProps, {
				props: {
					count: 0,
					tags: [],
					config: { enabled: true, theme: 'light' },
					createdAt: testDate,
				},
			});

			await expect
				.element(screen.getByTestId('created-at'))
				.toHaveTextContent(testDate.toISOString());
		});
	});

	describe('slots', () => {
		it('should render default slot content', async () => {
			const screen = await render(WithSlots, {
				props: {
					title: 'Container Title',
				},
				slots: {
					default: '<p data-testid="default-slot">Default slot content</p>',
				},
			});

			await expect
				.element(screen.getByTestId('default-slot'))
				.toHaveTextContent('Default slot content');
		});

		it('should render named slots', async () => {
			const screen = await render(WithSlots, {
				props: {
					title: 'Container Title',
				},
				slots: {
					footer: '<p data-testid="footer-slot">Footer content</p>',
				},
			});

			await expect
				.element(screen.getByTestId('footer-slot'))
				.toHaveTextContent('Footer content');
		});

		it('should render multiple slots', async () => {
			const screen = await render(WithSlots, {
				props: {
					title: 'Container Title',
				},
				slots: {
					default: '<p data-testid="main">Main content</p>',
					footer: '<p data-testid="footer">Footer content</p>',
				},
			});

			await expect
				.element(screen.getByTestId('main'))
				.toHaveTextContent('Main content');
			await expect
				.element(screen.getByTestId('footer'))
				.toHaveTextContent('Footer content');
		});
	});

	describe('cleanup', () => {
		it('should provide unmount function', async () => {
			const screen = await render(SimpleCard, {
				props: { title: 'Test' },
			});

			expect(screen.unmount).toBeTypeOf('function');
		});

		it('should remove component from DOM when unmounted', async () => {
			const screen = await render(SimpleCard, {
				props: { title: 'Test' },
			});

			const card = screen.getByTestId('card');
			await expect.element(card).toBeInTheDocument();

			screen.unmount();

			expect(document.body.contains(screen.container)).toBe(false);
		});
	});

	describe('locators API', () => {
		it('should provide getByText locator', async () => {
			const screen = await render(SimpleCard, {
				props: { title: 'Find Me' },
			});

			expect(screen.getByText).toBeTypeOf('function');
			await expect.element(screen.getByText('Find Me')).toBeVisible();
		});

		it('should provide getByTestId locator', async () => {
			const screen = await render(SimpleCard, {
				props: { title: 'Test' },
			});

			expect(screen.getByTestId).toBeTypeOf('function');
			await expect.element(screen.getByTestId('card')).toBeVisible();
		});

		it('should provide getByRole locator', async () => {
			const screen = await render(SimpleCard, {
				props: { title: 'Test' },
			});

			expect(screen.getByRole).toBeTypeOf('function');
			await expect.element(screen.getByRole('heading')).toBeVisible();
		});
	});

	describe('metadata validation', () => {
		it('should throw error if not an Astro component', async () => {
			const notAstroComponent = { some: 'object' };

			await expect(
				render(notAstroComponent as any, { props: {} }),
			).rejects.toThrow('Not an Astro component');
		});

		it('should validate __astroComponent flag', async () => {
			const invalidComponent = {
				__path: '/some/path.astro',
				__name: 'default',
			};

			await expect(
				render(invalidComponent as any, { props: {} }),
			).rejects.toThrow();
		});
	});
});
