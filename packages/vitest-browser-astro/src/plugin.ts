import { isAbsolute, resolve } from "node:path";
import type { Plugin } from "vite";
import type { BrowserCommand } from "vitest/node";
import type { ViteDevServer } from "vite";
import {
	experimental_AstroContainer as AstroContainer,
	type AddClientRenderer,
} from "astro/container";
import { parse } from "devalue";

type RenderAstroCommand = BrowserCommand<
	[
		componentPath: string,
		componentName: string,
		serializedProps?: string,
		slots?: Record<string, string>,
	]
>;

/**
 * Server renderer configuration - path to renderer module
 */
interface ServerRendererConfig {
	/** Path to server renderer module (e.g., '@astrojs/react/server.js') */
	module: string;
}

/**
 * Creates the browser command with a pre-configured container
 */
async function createRenderAstroCommand(
	serverRenderers: ServerRendererConfig[],
	clientRenderers: AddClientRenderer[],
	viteServer: ViteDevServer,
	container: AstroContainer,
): Promise<RenderAstroCommand> {
	// Load and add server renderers using Vite's SSR loader (must be added before client renderers)
	for (const { module: modulePath } of serverRenderers) {
		const rendererModule = await viteServer.ssrLoadModule(modulePath);
		const renderer = rendererModule.default || rendererModule;
		container.addServerRenderer({ renderer });
	}

	// Add client renderers for hydration
	for (const clientRenderer of clientRenderers) {
		container.addClientRenderer(clientRenderer);
	}

	return async (
		ctx,
		componentPath: string,
		componentName: string,
		serializedProps?: string,
		slots?: Record<string, string>,
	) => {
		const projectRoot = process.cwd();
		const absolutePath = resolve(projectRoot, componentPath);

		// Use Vitest's Vite server which already has Astro configured
		const viteServer = ctx.project.vite;

		// Load the component directly (astro-head-inject will be auto-injected during SSR)
		const componentModule = await viteServer.ssrLoadModule(absolutePath);

		// Get the component
		const Component = componentModule.default || componentModule[componentName];

		if (!Component) {
			throw new Error(
				`Component not found for ${absolutePath}. Available exports: ${Object.keys(componentModule).join(", ")}`,
			);
		}

		// Deserialize props using devalue to restore Dates, RegExps, etc.
		const props = serializedProps ? parse(serializedProps) : undefined;

		// Render the component (which will include scripts due to astro-head-inject)
		const html = await container.renderToString(Component, {
			props,
			slots,
			request: new Request("http://localhost:4321/"),
		});

		return { html };
	};
}

/**
 * Options for configuring the Astro renderer plugin
 */
export interface AstroRendererOptions {
	/**
	 * Server renderers for SSR (React, Vue, Svelte, etc.)
	 * Specify module paths - they will be loaded using Vite's SSR loader
	 * @example
	 * serverRenderers: [{ module: '@astrojs/react/server.js' }]
	 */
	serverRenderers?: ServerRendererConfig[];

	/**
	 * Client renderers for hydration
	 * Specify the integration name and client entrypoint
	 * @example
	 * clientRenderers: [{ name: '@astrojs/react', entrypoint: '@astrojs/react/client.js' }]
	 */
	clientRenderers?: AddClientRenderer[];
}
const VALID_ID_PREFIX = `/@id/`;

/**
 * Vite plugin that intercepts .astro imports and provides browser command
 * Returns array of two plugins: one for pre-processing, one for post-processing
 */
export function astroRenderer(options: AstroRendererOptions = {}): Plugin {
	const { serverRenderers = [], clientRenderers = [] } = options;
	let renderAstroCommand: RenderAstroCommand | null = null;
	let container: AstroContainer | null = null;

	return {
		name: "vitest:astro-renderer",
		enforce: "post",

		async configureServer(server) {
			// Create Astro container once during initialization
			container = await AstroContainer.create({
				resolve: async (id) => {
					const resolved = await server.pluginContainer.resolveId(
						id,
						undefined,
					);
					if (resolved && isAbsolute(resolved?.id)) {
						return `/@fs${resolved.id}`;
					}
					return `/@id/${resolved?.id ?? id}`;
				},
			});
			// Create container with renderers during server startup
			renderAstroCommand = await createRenderAstroCommand(
				serverRenderers,
				clientRenderers,
				server,
				container,
			);
		},

		config() {
			return {
				optimizeDeps: {
					include: ["react", "react-dom", "react-dom/client"],
				},
				test: {
					browser: {
						commands: {
							renderAstro: ((...args) => {
								if (!renderAstroCommand) {
									throw new Error("renderAstroCommand not initialized");
								}
								return renderAstroCommand(...args);
							}) as RenderAstroCommand,
						},
					},
				},
			};
		},

		async transform(_code, id, options) {
			// Only intercept browser imports of .astro files (after Astro has processed them)
			if (id.endsWith(".astro") && !options?.ssr) {
				// Replace entire transformed code with metadata object
				return `
export default {
	__astroComponent: true,
	__path: ${JSON.stringify(id)},
	__name: "default",
};
					`.trim();
			}
			return null;
		},
	};
}
