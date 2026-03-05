import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'flight-engine-js': resolve(__dirname, '../src'),
    },
  },
});
