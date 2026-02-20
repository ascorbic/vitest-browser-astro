import { describe, it, expect, beforeEach } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-astro";
import SimpleCard from "../src/components/SimpleCard.astro";
import WithSlots from "../src/components/WithSlots.astro";
import Counter from "../src/components/Counter.astro";
import ToggleButton from "../src/components/ToggleButton.astro";

describe("Pure Astro components (no framework renderers)", () => {
	beforeEach(async () => {
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
	});

	describe("interactive components with inline scripts", () => {
		it("should render Counter with initial count", async () => {
			const screen = await render(Counter, {
				props: { initialCount: 5 },
			});

			await expect.element(screen.getByTestId("count")).toHaveTextContent("5");
		});

		it("should toggle state on click", async () => {
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
		});
	});
});
