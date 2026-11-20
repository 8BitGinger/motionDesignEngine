import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: { port: 5518 },
  build: {
    rolldownOptions: {
      output: {
        // Vendor code changes rarely: separate chunks cache well across app updates.
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\/](react|react-dom|scheduler)[\/]/, priority: 2 },
            { name: 'remotion', test: /node_modules[\/](remotion|@remotion)[\/]/, priority: 1 },
          ],
        },
      },
    },
  },
});
