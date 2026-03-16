import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		VitePWA({
			registerType: 'autoUpdate',
			includeAssets: [
				'favicon.ico',
				'favicon-16x16.png',
				'favicon-32x32.png',
				'apple-touch-icon.png',
			],
			manifest: {
				name: 'Polymarket BTC-5 Dashboard',
				short_name: 'BTC-5 Dashboard',
				description: 'Polymarket BTC 5-Minute Trading Bot Dashboard',
				theme_color: '#0f172a',
				background_color: '#0f172a',
				display: 'standalone',
				scope: '/',
				start_url: '/',
				icons: [
					{
						src: 'android-chrome-192x192.png',
						sizes: '192x192',
						type: 'image/png',
					},
					{
						src: 'android-chrome-512x512.png',
						sizes: '512x512',
						type: 'image/png',
					},
					{
						src: 'maskable_icon_x192.png',
						sizes: '192x192',
						type: 'image/png',
						purpose: 'maskable',
					},
					{
						src: 'maskable_icon_x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable',
					},
				],
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
				maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4MiB
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/.*\/api\/.*/i,
						handler: 'NetworkFirst',
						options: {
							cacheName: 'api-cache',
							expiration: {
								maxEntries: 50,
								maxAgeSeconds: 300,
							},
						},
					},
				],
			},
		}),
	],
	build: {
		chunkSizeWarningLimit: 1500,
		rollupOptions: {
			output: {
				manualChunks: {
					'ag-grid': ['ag-grid-community', 'ag-grid-enterprise', 'ag-grid-react'],
					'vendors': ['lucide-react', '@tanstack/react-query', 'luxon', 'xlsx'],
					'react-vendors': ['react', 'react-dom'],
				},
			},
		},
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
			'@shared': path.resolve(__dirname, '../shared/src'),
		},
	},
});
