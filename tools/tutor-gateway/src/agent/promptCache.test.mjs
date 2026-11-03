import test from 'node:test';
import assert from 'node:assert/strict';
import { tutorPromptCache } from './promptCache.mjs';

test('24h caching is requested only for documented supported models without changing model or reasoning', () => {
  assert.deepEqual(tutorPromptCache('gpt-5.4'), { prompt_cache_retention: '24h' });
  assert.deepEqual(tutorPromptCache('gpt-5.4-2026-03-05'), { prompt_cache_retention: '24h' });
  for (const model of ['gpt-5.4-mini', 'gpt-6.1-sol', 'gpt-5.6', 'gpt-4o', 'unknown']) assert.deepEqual(tutorPromptCache(model), {});
  assert.deepEqual(tutorPromptCache('gpt-5.4', 'in_memory'), { prompt_cache_retention: 'in_memory' });
  assert.deepEqual(tutorPromptCache('gpt-5.4', 'default'), {});
  assert.throws(() => tutorPromptCache('gpt-5.4', 'forever'), /retention/);
});
