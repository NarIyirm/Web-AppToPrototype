const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/**', '.expo/**', 'verification/**', 'contracts/generated/**', 'contracts/artifacts/**'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/ui/safe-area.tsx'],
    rules: {
      'no-restricted-imports': ['error', { paths: [
        { name: 'react-native', importNames: ['Modal', 'SafeAreaView'],
          message: 'Use Screen, SafeAreaSurface or SafeAreaModal from the shared UI so each native window measures its safe area.' },
        { name: 'react-native-safe-area-context',
          message: 'Keep safe-area measurement in src/ui/safe-area.tsx; use Screen, SafeAreaSurface or SafeAreaModal.' },
      ] }],
    },
  },
]);
