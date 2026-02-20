import { describe, it, expect, beforeEach } from "vitest";
import { userEvent } from "vitest/browser";
import { render, waitForHydration } from "vitest-browser-astro";
import SimpleCard from "../src/components/SimpleCard.astro";
import WithSlots from "../src/components/WithSlots.astro";
import ComplexProps from "../src/components/ComplexProps.astro";
import Counter from "../src/components/Counter.astro";
import ToggleButton from "../src/components/ToggleButton.astro";
import WithReact from "../src/components/WithReact.astro";
import WithVue from "../src/components/WithVue.astro";
import WithSvelte from "../src/components/WithSvelte.astro";

describe("render() in browser", () => {
	beforeEach(async () => {
		// Clean up between tests
		document.body.innerHTML = "";
	});

	describe("basic rendering", () => {
		it("should render a simple Astro component", async () => {
			const screen = await render(SimpleCard, {
				props: {
					title: "Hello World",
				},
			});

			expect(screen.element()).toBeTruthy();
			expect(screen.element()).toBeInstanceOf(HTMLElement);
			await expect.element(screen.getByTestId("card")).toBeInTheDocument();
		});

		it("should render component with all props", async () => {
			const screen = await render(SimpleCard, {
				props: {
					title: "Test Card",
					description: "This is a test description",
				},
			});

			await expect.element(screen.getByText("Test Card")).toBeVisible();
			await expect
				.element(screen.getByText("This is a test description"))
				.toBeVisible();
		});

		it("should handle optional props", async () => {
			const screen = await render(SimpleCard, {
				props: {
					title: "Only Title",
				},
			});

			await expect.element(screen.getByText("Only Title")).toBeVisible();
			// Description should not be rendered
			expect(screen.element().querySelector("p")).toBeNull();
		});
	});

	describe("complex props", () => {
		it("should handle number props", async () => {
			const screen = await render(ComplexProps, {
				props: {
					count: 42,
					tags: [],
					config: { enabled: true, theme: "dark" },
					createdAt: new Date("2024-01-01"),
				},
			});

			await expect.element(screen.getByTestId("count")).toHaveTextContent("42");
		});

		it("should handle array props", async () => {
			const screen = await render(ComplexProps, {
				props: {
					count: 0,
					tags: ["astro", "vitest", "testing"],
					config: { enabled: true, theme: "light" },
					createdAt: new Date("2024-01-01"),
				},
			});

			await expect.element(screen.getByTestId("tags")).toBeInTheDocument();
			expect(
				screen.element().querySelectorAll('[data-testid="tags"] li'),
			).toHaveLength(3);
		});

		it("should handle nested object props", async () => {
			const screen = await render(ComplexProps, {
				props: {
					count: 0,
					tags: [],
					config: { enabled: false, theme: "dark" },
					createdAt: new Date("2024-01-01"),
				},
			});

			await expect
				.element(screen.getByTestId("config"))
				.toHaveTextContent("disabled - dark");
		});

		it("should handle Date props", async () => {
			const testDate = new Date("2024-03-15T10:30:00Z");
			const screen = await render(ComplexProps, {
				props: {
					count: 0,
					tags: [],
					config: { enabled: true, theme: "light" },
					createdAt: testDate,
				},
			});

			await expect
				.element(screen.getByTestId("created-at"))
				.toHaveTextContent(testDate.toISOString());
		});
	});

	describe("slots", () => {
		it("should render default slot content", async () => {
			const screen = await render(WithSlots, {
				props: {
					title: "Container Title",
				},
				slots: {
					default: '<p data-testid="default-slot">Default slot content</p>',
				},
			});

			await expect
				.element(screen.getByTestId("default-slot"))
				.toHaveTextContent("Default slot content");
		});

		it("should render named slots", async () => {
			const screen = await render(WithSlots, {
				props: {
					title: "Container Title",
				},
				slots: {
					footer: '<p data-testid="footer-slot">Footer content</p>',
				},
			});

			await expect
				.element(screen.getByTestId("footer-slot"))
				.toHaveTextContent("Footer content");
		});

		it("should render multiple slots", async () => {
			const screen = await render(WithSlots, {
				props: {
					title: "Container Title",
				},
				slots: {
					default: '<p data-testid="main">Main content</p>',
					footer: '<p data-testid="footer">Footer content</p>',
				},
			});

			await expect
				.element(screen.getByTestId("main"))
				.toHaveTextContent("Main content");
			await expect
				.element(screen.getByTestId("footer"))
				.toHaveTextContent("Footer content");
		});
	});

	describe("locators API", () => {
		it("should provide getByText locator", async () => {
			const screen = await render(SimpleCard, {
				props: { title: "Find Me" },
			});

			expect(screen.getByText).toBeTypeOf("function");
			await expect.element(screen.getByText("Find Me")).toBeVisible();
		});

		it("should provide getByTestId locator", async () => {
			const screen = await render(SimpleCard, {
				props: { title: "Test" },
			});

			expect(screen.getByTestId).toBeTypeOf("function");
			await expect.element(screen.getByTestId("card")).toBeVisible();
		});

		it("should provide getByRole locator", async () => {
			const screen = await render(SimpleCard, {
				props: { title: "Test" },
			});

			expect(screen.getByRole).toBeTypeOf("function");
			await expect.element(screen.getByRole("heading")).toBeVisible();
		});
	});

	describe("metadata validation", () => {
		it("should throw error if not an Astro component", async () => {
			const notAstroComponent = { some: "object" };

			await expect(
				render(notAstroComponent as any, { props: {} }),
			).rejects.toThrow("Not an Astro component");
		});

		it("should validate __astroComponent flag", async () => {
			const invalidComponent = {
				__path: "/some/path.astro",
				__name: "default",
			};

			await expect(
				render(invalidComponent as any, { props: {} }),
			).rejects.toThrow();
		});
	});

	describe("interactive components with inline scripts", () => {
		describe("Counter component", () => {
			it("should render with initial count", async () => {
				const screen = await render(Counter, {
					props: { initialCount: 5 },
				});

				await expect
					.element(screen.getByTestId("count"))
					.toHaveTextContent("5");
			});

			it("should increment count when increment button clicked", async () => {
				const screen = await render(Counter, {
					props: { initialCount: 0 },
				});

				const count = screen.getByTestId("count");
				const incrementBtn = screen.getByTestId("increment");
				const counter = screen.getByTestId("counter");

				await expect.element(count).toHaveTextContent("0");

				// Wait for script to initialize
				await expect
					.element(counter)
					.toHaveAttribute("data-initialized", "true");

				await userEvent.click(incrementBtn);
				await expect.element(count).toHaveTextContent("1");

				await userEvent.click(incrementBtn);
				await expect.element(count).toHaveTextContent("2");
			});

			it("should decrement count when decrement button clicked", async () => {
				const screen = await render(Counter, {
					props: { initialCount: 5 },
				});

				const count = screen.getByTestId("count");
				const decrementBtn = screen.getByTestId("decrement");

				await expect.element(count).toHaveTextContent("5");

				await userEvent.click(decrementBtn);
				await expect.element(count).toHaveTextContent("4");

				await userEvent.click(decrementBtn);
				await expect.element(count).toHaveTextContent("3");
			});

			it("should reset to initial count when reset button clicked", async () => {
				const screen = await render(Counter, {
					props: { initialCount: 10 },
				});

				const count = screen.getByTestId("count");
				const incrementBtn = screen.getByTestId("increment");
				const resetBtn = screen.getByTestId("reset");

				await expect.element(count).toHaveTextContent("10");

				await userEvent.click(incrementBtn);
				await userEvent.click(incrementBtn);
				await expect.element(count).toHaveTextContent("12");

				await userEvent.click(resetBtn);
				await expect.element(count).toHaveTextContent("10");
			});
		});

		describe("ToggleButton component", () => {
			it("should render with default OFF state", async () => {
				const screen = await render(ToggleButton, {
					props: {
						label: "Test Toggle",
						defaultState: false,
					},
				});

				const button = screen.getByTestId("toggle-button");
				const state = screen.getByTestId("toggle-state");

				await expect.element(button).toHaveTextContent("Test Toggle");
				await expect.element(state).toHaveTextContent("OFF");
				expect(button.element().getAttribute("aria-pressed")).toBe("false");
			});

			it("should render with default ON state", async () => {
				const screen = await render(ToggleButton, {
					props: {
						label: "Test Toggle",
						defaultState: true,
					},
				});

				const button = screen.getByTestId("toggle-button");
				const state = screen.getByTestId("toggle-state");

				await expect.element(state).toHaveTextContent("ON");
				expect(button.element().getAttribute("aria-pressed")).toBe("true");
			});

			it("should toggle state when button clicked", async () => {
				const screen = await render(ToggleButton, {
					props: {
						label: "Toggle Me",
						defaultState: false,
					},
				});

				const button = screen.getByTestId("toggle-button");
				const state = screen.getByTestId("toggle-state");

				await expect.element(state).toHaveTextContent("OFF");

				await userEvent.click(button);
				await expect.element(state).toHaveTextContent("ON");

				await userEvent.click(button);
				await expect.element(state).toHaveTextContent("OFF");

				await userEvent.click(button);
				await expect.element(state).toHaveTextContent("ON");
			});

			it("should update aria-pressed attribute when toggled", async () => {
				const screen = await render(ToggleButton, {
					props: {
						defaultState: false,
					},
				});

				const button = screen.getByTestId("toggle-button");

				expect(button.element().getAttribute("aria-pressed")).toBe("false");

				await userEvent.click(button);
				expect(button.element().getAttribute("aria-pressed")).toBe("true");

				await userEvent.click(button);
				expect(button.element().getAttribute("aria-pressed")).toBe("false");
			});
		});
	});
});

describe("React components", () => {
	it("should render Astro component with React child", async () => {
		const screen = await render(WithReact, {
			props: {
				initialCount: 5,
				label: "Test Counter",
			},
		});

		await expect.element(screen.getByTestId("with-react")).toBeInTheDocument();
		await expect
			.element(screen.getByText("Astro Component with React"))
			.toBeVisible();
		await expect
			.element(screen.getByTestId("react-counter"))
			.toBeInTheDocument();
	});

	it("should hydrate React component with client:load", async () => {
		const screen = await render(WithReact, {
			props: {
				initialCount: 10,
				label: "Interactive Counter",
			},
		});

		const reactLabel = screen.getByTestId("react-label");
		const reactCount = screen.getByTestId("react-count");

		await expect.element(reactLabel).toHaveTextContent("Interactive Counter");
		await expect.element(reactCount).toHaveTextContent("10");
	});

	it("should handle React component interactions", async () => {
		const screen = await render(WithReact, {
			props: {
				initialCount: 0,
			},
		});

		const count = screen.getByTestId("react-count");
		const incrementBtn = screen.getByTestId("react-increment");
		const decrementBtn = screen.getByTestId("react-decrement");

		await expect.element(count).toHaveTextContent("0");

		// Wait for hydration to complete before interacting
		await waitForHydration(screen);
		await userEvent.click(incrementBtn);
		await expect.element(count).toHaveTextContent("1");

		await userEvent.click(incrementBtn);
		await expect.element(count).toHaveTextContent("2");

		await userEvent.click(decrementBtn);
		await expect.element(count).toHaveTextContent("1");
	});

	it("should wait for hydration on a specific locator", async () => {
		const screen = await render(WithReact, {
			props: {
				initialCount: 5,
			},
		});

		const container = screen.getByTestId("with-react");

		// Wait for hydration on the specific container
		await waitForHydration(container);

		const count = screen.getByTestId("react-count");
		const incrementBtn = screen.getByTestId("react-increment");

		await expect.element(count).toHaveTextContent("5");

		await userEvent.click(incrementBtn);
		await expect.element(count).toHaveTextContent("6");
	});
});

describe("Vue components", () => {
	it("should render Astro component with Vue child", async () => {
		const screen = await render(WithVue, {
			props: {
				initialCount: 5,
				label: "Test Counter",
			},
		});

		await expect.element(screen.getByTestId("with-vue")).toBeInTheDocument();
		await expect
			.element(screen.getByText("Astro Component with Vue"))
			.toBeVisible();
		await expect.element(screen.getByTestId("vue-counter")).toBeInTheDocument();
	});

	it("should hydrate Vue component with client:load", async () => {
		const screen = await render(WithVue, {
			props: {
				initialCount: 10,
				label: "Interactive Counter",
			},
		});

		const vueLabel = screen.getByTestId("vue-label");
		const vueCount = screen.getByTestId("vue-count");

		await expect.element(vueLabel).toHaveTextContent("Interactive Counter");
		await expect.element(vueCount).toHaveTextContent("10");
	});

	it("should handle Vue component interactions", async () => {
		const screen = await render(WithVue, {
			props: {
				initialCount: 0,
			},
		});

		const count = screen.getByTestId("vue-count");
		const incrementBtn = screen.getByTestId("vue-increment");
		const decrementBtn = screen.getByTestId("vue-decrement");

		await expect.element(count).toHaveTextContent("0");

		// Wait for hydration to complete before interacting
		await waitForHydration(screen);

		await userEvent.click(incrementBtn);
		await expect.element(count).toHaveTextContent("1");

		await userEvent.click(incrementBtn);
		await expect.element(count).toHaveTextContent("2");

		await userEvent.click(decrementBtn);
		await expect.element(count).toHaveTextContent("1");
	});
});

describe("Svelte components", () => {
	it("should render Astro component with Svelte child", async () => {
		const screen = await render(WithSvelte, {
			props: {
				initialCount: 5,
				label: "Test Counter",
			},
		});

		await expect.element(screen.getByTestId("with-svelte")).toBeInTheDocument();
		await expect
			.element(screen.getByText("Astro Component with Svelte"))
			.toBeVisible();
		await expect
			.element(screen.getByTestId("svelte-counter"))
			.toBeInTheDocument();
	});

	it("should hydrate Svelte component with client:load", async () => {
		const screen = await render(WithSvelte, {
			props: {
				initialCount: 10,
				label: "Interactive Counter",
			},
		});

		const svelteLabel = screen.getByTestId("svelte-label");
		const svelteCount = screen.getByTestId("svelte-count");

		await expect.element(svelteLabel).toHaveTextContent("Interactive Counter");
		await expect.element(svelteCount).toHaveTextContent("10");
	});

	it("should handle Svelte component interactions", async () => {
		const screen = await render(WithSvelte, {
			props: {
				initialCount: 0,
			},
		});

		const count = screen.getByTestId("svelte-count");
		const incrementBtn = screen.getByTestId("svelte-increment");
		const decrementBtn = screen.getByTestId("svelte-decrement");

		await expect.element(count).toHaveTextContent("0");

		// Wait for hydration to complete before interacting
		await waitForHydration(screen);

		await userEvent.click(incrementBtn);
		await expect.element(count).toHaveTextContent("1");

		await userEvent.click(incrementBtn);
		await expect.element(count).toHaveTextContent("2");

		await userEvent.click(decrementBtn);
		await expect.element(count).toHaveTextContent("1");
	});
});
