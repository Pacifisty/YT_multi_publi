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
      {
        test: {
          name: 'phase14',
          root: '.',
          include: ['tests/phase14/**/*.test.ts', 'tests/phase14/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase15',
          root: '.',
          include: ['tests/phase15/**/*.test.ts', 'tests/phase15/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase16',
          root: '.',
          include: ['tests/phase16/**/*.test.ts', 'tests/phase16/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase17',
          root: '.',
          include: ['tests/phase17/**/*.test.ts', 'tests/phase17/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase18',
          root: '.',
          include: ['tests/phase18/**/*.test.ts', 'tests/phase18/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase19',
          root: '.',
          include: ['tests/phase19/**/*.test.ts', 'tests/phase19/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase20',
          root: '.',
          include: ['tests/phase20/**/*.test.ts', 'tests/phase20/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase21',
          root: '.',
          include: ['tests/phase21/**/*.test.ts', 'tests/phase21/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase22',
          root: '.',
          include: ['tests/phase22/**/*.test.ts', 'tests/phase22/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase23',
          root: '.',
          include: ['tests/phase23/**/*.test.ts', 'tests/phase23/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase24',
          root: '.',
          include: ['tests/phase24/**/*.test.ts', 'tests/phase24/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase25',
          root: '.',
          include: ['tests/phase25/**/*.test.ts', 'tests/phase25/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase26',
          root: '.',
          include: ['tests/phase26/**/*.test.ts', 'tests/phase26/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase27',
          root: '.',
          include: ['tests/phase27/**/*.test.ts', 'tests/phase27/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase28',
          root: '.',
          include: ['tests/phase28/**/*.test.ts', 'tests/phase28/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase29',
          root: '.',
          include: ['tests/phase29/**/*.test.ts', 'tests/phase29/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase30',
          root: '.',
          include: ['tests/phase30/**/*.test.ts', 'tests/phase30/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase32',
          root: '.',
          include: ['tests/phase32/**/*.test.ts', 'tests/phase32/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase33',
          root: '.',
          include: ['tests/phase33/**/*.test.ts', 'tests/phase33/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase34',
          root: '.',
          include: ['tests/phase34/**/*.test.ts', 'tests/phase34/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase35',
          root: '.',
          include: ['tests/phase35/**/*.test.ts', 'tests/phase35/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase36',
          root: '.',
          include: ['tests/phase36/**/*.test.ts', 'tests/phase36/**/*.test.tsx'],
          environment: 'node',
        },
      },
    ],
  },
});
