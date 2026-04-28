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
      {
        test: {
          name: 'phase37',
          root: '.',
          include: ['tests/phase37/**/*.test.ts', 'tests/phase37/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase38',
          root: '.',
          include: ['tests/phase38/**/*.test.ts', 'tests/phase38/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase39',
          root: '.',
          include: ['tests/phase39/**/*.test.ts', 'tests/phase39/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase40',
          root: '.',
          include: ['tests/phase40/**/*.test.ts', 'tests/phase40/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase41',
          root: '.',
          include: ['tests/phase41/**/*.test.ts', 'tests/phase41/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase42',
          root: '.',
          include: ['tests/phase42/**/*.test.ts', 'tests/phase42/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase43',
          root: '.',
          include: ['tests/phase43/**/*.test.ts', 'tests/phase43/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase44',
          root: '.',
          include: ['tests/phase44/**/*.test.ts', 'tests/phase44/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase45',
          root: '.',
          include: ['tests/phase45/**/*.test.ts', 'tests/phase45/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase46',
          root: '.',
          include: ['tests/phase46/**/*.test.ts', 'tests/phase46/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase47',
          root: '.',
          include: ['tests/phase47/**/*.test.ts', 'tests/phase47/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase48',
          root: '.',
          include: ['tests/phase48/**/*.test.ts', 'tests/phase48/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase49',
          root: '.',
          include: ['tests/phase49/**/*.test.ts', 'tests/phase49/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase50',
          root: '.',
          include: ['tests/phase50/**/*.test.ts', 'tests/phase50/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase51',
          root: '.',
          include: ['tests/phase51/**/*.test.ts', 'tests/phase51/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase52',
          root: '.',
          include: ['tests/phase52/**/*.test.ts', 'tests/phase52/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase53',
          root: '.',
          include: ['tests/phase53/**/*.test.ts', 'tests/phase53/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase54',
          root: '.',
          include: ['tests/phase54/**/*.test.ts', 'tests/phase54/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase55',
          root: '.',
          include: ['tests/phase55/**/*.test.ts', 'tests/phase55/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase56',
          root: '.',
          include: ['tests/phase56/**/*.test.ts', 'tests/phase56/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase57',
          root: '.',
          include: ['tests/phase57/**/*.test.ts', 'tests/phase57/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase58',
          root: '.',
          include: ['tests/phase58/**/*.test.ts', 'tests/phase58/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase59',
          root: '.',
          include: ['tests/phase59/**/*.test.ts', 'tests/phase59/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase60',
          root: '.',
          include: ['tests/phase60/**/*.test.ts', 'tests/phase60/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase61',
          root: '.',
          include: ['tests/phase61/**/*.test.ts', 'tests/phase61/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase62',
          root: '.',
          include: ['tests/phase62/**/*.test.ts', 'tests/phase62/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase63',
          root: '.',
          include: ['tests/phase63/**/*.test.ts', 'tests/phase63/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase64',
          root: '.',
          include: ['tests/phase64/**/*.test.ts', 'tests/phase64/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase65',
          root: '.',
          include: ['tests/phase65/**/*.test.ts', 'tests/phase65/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase66',
          root: '.',
          include: ['tests/phase66/**/*.test.ts', 'tests/phase66/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase67',
          root: '.',
          include: ['tests/phase67/**/*.test.ts', 'tests/phase67/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase68',
          root: '.',
          include: ['tests/phase68/**/*.test.ts', 'tests/phase68/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase69',
          root: '.',
          include: ['tests/phase69/**/*.test.ts', 'tests/phase69/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase70',
          root: '.',
          include: ['tests/phase70/**/*.test.ts', 'tests/phase70/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase71',
          root: '.',
          include: ['tests/phase71/**/*.test.ts', 'tests/phase71/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase72',
          root: '.',
          include: ['tests/phase72/**/*.test.ts', 'tests/phase72/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase73',
          root: '.',
          include: ['tests/phase73/**/*.test.ts', 'tests/phase73/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase74',
          root: '.',
          include: ['tests/phase74/**/*.test.ts', 'tests/phase74/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase75',
          root: '.',
          include: ['tests/phase75/**/*.test.ts', 'tests/phase75/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase76',
          root: '.',
          include: ['tests/phase76/**/*.test.ts', 'tests/phase76/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase77',
          root: '.',
          include: ['tests/phase77/**/*.test.ts', 'tests/phase77/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase78',
          root: '.',
          include: ['tests/phase78/**/*.test.ts', 'tests/phase78/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase79',
          root: '.',
          include: ['tests/phase79/**/*.test.ts', 'tests/phase79/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase80',
          root: '.',
          include: ['tests/phase80/**/*.test.ts', 'tests/phase80/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase81',
          root: '.',
          include: ['tests/phase81/**/*.test.ts', 'tests/phase81/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase82',
          root: '.',
          include: ['tests/phase82/**/*.test.ts', 'tests/phase82/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase83',
          root: '.',
          include: ['tests/phase83/**/*.test.ts', 'tests/phase83/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase84',
          root: '.',
          include: ['tests/phase84/**/*.test.ts', 'tests/phase84/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase85',
          root: '.',
          include: ['tests/phase85/**/*.test.ts', 'tests/phase85/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase86',
          root: '.',
          include: ['tests/phase86/**/*.test.ts', 'tests/phase86/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase87',
          root: '.',
          include: ['tests/phase87/**/*.test.ts', 'tests/phase87/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase88',
          root: '.',
          include: ['tests/phase88/**/*.test.ts', 'tests/phase88/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase89',
          root: '.',
          include: ['tests/phase89/**/*.test.ts', 'tests/phase89/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase90',
          root: '.',
          include: ['tests/phase90/**/*.test.ts', 'tests/phase90/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase91',
          root: '.',
          include: ['tests/phase91/**/*.test.ts', 'tests/phase91/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase92',
          root: '.',
          include: ['tests/phase92/**/*.test.ts', 'tests/phase92/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase93',
          root: '.',
          include: ['tests/phase93/**/*.test.ts', 'tests/phase93/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase94',
          root: '.',
          include: ['tests/phase94/**/*.test.ts', 'tests/phase94/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase95',
          root: '.',
          include: ['tests/phase95/**/*.test.ts', 'tests/phase95/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase96',
          root: '.',
          include: ['tests/phase96/**/*.test.ts', 'tests/phase96/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase97',
          root: '.',
          include: ['tests/phase97/**/*.test.ts', 'tests/phase97/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase98',
          root: '.',
          include: ['tests/phase98/**/*.test.ts', 'tests/phase98/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase99',
          root: '.',
          include: ['tests/phase99/**/*.test.ts', 'tests/phase99/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase100',
          root: '.',
          include: ['tests/phase100/**/*.test.ts', 'tests/phase100/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase101',
          root: '.',
          include: ['tests/phase101/**/*.test.ts', 'tests/phase101/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase102',
          root: '.',
          include: ['tests/phase102/**/*.test.ts', 'tests/phase102/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase103',
          root: '.',
          include: ['tests/phase103/**/*.test.ts', 'tests/phase103/**/*.test.tsx'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'phase107',
          root: '.',
          include: ['tests/phase107/**/*.test.ts', 'tests/phase107/**/*.test.tsx'],
          environment: 'node',
        },
      },
    ],
  },
});
