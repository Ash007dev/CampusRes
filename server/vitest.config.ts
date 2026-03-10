import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts', 'src/**/*.unit.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
        },
        setupFiles: ['./src/__tests__/setup.ts', 'src/__tests__/setup/globalSetup.ts'],
        testTimeout: 30000, // 30s — Supabase calls can be slow
        hookTimeout: 30000,
        sequence: {
            concurrent: false, // Run tests sequentially to avoid DB conflicts
        },
    },
});
