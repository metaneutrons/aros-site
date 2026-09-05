import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://aros.metaneutrons.cc',
  output: 'static',
  integrations: [sitemap()],
  build: {
    format: 'directory',
  },
});
