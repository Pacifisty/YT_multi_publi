import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          root: './sdk',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.integration.test.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          root: './sdk',
          include: ['src/**/*.integration.test.ts'],
          testTimeout: 120_000,
        },
      },
      {
        test: {
          name: 'phase1',
          root: '.',
          include: ['tests/phase1/**/*.test.ts', 'tests/phase1/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase2',
          root: '.',
          include: ['tests/phase2/**/*.test.ts', 'tests/phase2/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase3',
          root: '.',
          include: ['tests/phase3/**/*.test.ts', 'tests/phase3/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase4',
          root: '.',
          include: ['tests/phase4/**/*.test.ts', 'tests/phase4/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase5',
          root: '.',
          include: ['tests/phase5/**/*.test.ts', 'tests/phase5/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase6',
          root: '.',
          include: ['tests/phase6/**/*.test.ts', 'tests/phase6/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase7',
          root: '.',
          include: ['tests/phase7/**/*.test.ts', 'tests/phase7/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase8',
          root: '.',
          include: ['tests/phase8/**/*.test.ts', 'tests/phase8/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase9',
          root: '.',
          include: ['tests/phase9/**/*.test.ts', 'tests/phase9/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase10',
          root: '.',
          include: ['tests/phase10/**/*.test.ts', 'tests/phase10/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase11',
          root: '.',
          include: ['tests/phase11/**/*.test.ts', 'tests/phase11/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase12',
          root: '.',
          include: ['tests/phase12/**/*.test.ts', 'tests/phase12/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase13',
          root: '.',
          include: ['tests/phase13/**/*.test.ts', 'tests/phase13/**/*.test.tsx'],
          environment: 'node',
        },
      },
    ],
  },
});
