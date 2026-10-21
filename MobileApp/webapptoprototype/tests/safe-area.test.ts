import assert from 'node:assert/strict';
import test from 'node:test';
import { ESLint } from 'eslint';

test('new screens cannot bypass the shared safe-area boundary, including aliased imports', async () => {
  const eslint = new ESLint();
  for (const source of [
    "import { Modal as Dialog } from 'react-native'; export const Example = Dialog;",
    "import { SafeAreaView } from 'react-native'; export const Example = SafeAreaView;",
    "import { SafeAreaView } from 'react-native-safe-area-context'; export const Example = SafeAreaView;",
    "import { SafeAreaProvider } from 'react-native-safe-area-context'; export const Example = SafeAreaProvider;",
  ]) {
    const [result] = await eslint.lintText(source, { filePath: 'src/features/layout-regression.tsx' });
    assert.ok(result.messages.some(message => message.ruleId === 'no-restricted-imports'), source);
  }
  const [valid] = await eslint.lintText("import { SafeAreaModal } from '@/ui/safe-area'; export const Example = SafeAreaModal;",
    { filePath: 'src/features/layout-regression.tsx' });
  assert.equal(valid.errorCount, 0);
});
