import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

const siteUrl = process.env.PUBLIC_SITE_URL || 'https://example.com';

export default defineConfig({
  site: siteUrl,
  output: 'static',
  image: {
    // Use no-op service to avoid sharp dependency issues on Cloudflare
    service: { entrypoint: 'astro/assets/services/noop' },
  },
  integrations: [
    mdx({
      // Register Callout component as global MDX component
      // Requirements: 10.6
    }),
    react(),
    sitemap(),
  ],
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
  vite: {
    resolve: {
      alias: {
        '@': '/src',
        '@atoms': '/src/atoms',
        '@molecules': '/src/molecules',
        '@coordinators': '/src/coordinators',
        '@shared': '../../packages/shared/src',
      },
    },
  },
});
