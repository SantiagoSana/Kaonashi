import test from 'node:test';
import assert from 'node:assert/strict';
import es from '../messages/es.json';
import en from '../messages/en.json';
import ja from '../messages/ja.json';

function getKeysAndPlaceholders(obj: Record<string, any>, prefix = ''): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const val = obj[key];

    if (typeof val === 'object' && val !== null) {
      const nested = getKeysAndPlaceholders(val, fullKey);
      nested.forEach((v, k) => map.set(k, v));
    } else if (typeof val === 'string') {
      const placeholders = (val.match(/\{[a-zA-Z0-9_]+\}/g) || []).sort();
      map.set(fullKey, placeholders);
    }
  }

  return map;
}

test('i18n parity: ES, EN and JA have exact same key sets and placeholders', () => {
  const esMap = getKeysAndPlaceholders(es);
  const enMap = getKeysAndPlaceholders(en);
  const jaMap = getKeysAndPlaceholders(ja);

  // Check all ES keys exist in EN and JA
  esMap.forEach((placeholders, key) => {
    assert.ok(enMap.has(key), `Missing key in EN: ${key}`);
    assert.ok(jaMap.has(key), `Missing key in JA: ${key}`);

    const enPlaceholders = enMap.get(key) || [];
    const jaPlaceholders = jaMap.get(key) || [];

    assert.deepEqual(
      enPlaceholders,
      placeholders,
      `Placeholder mismatch in EN for ${key}: expected ${placeholders.join(',')} got ${enPlaceholders.join(',')}`
    );
    assert.deepEqual(
      jaPlaceholders,
      placeholders,
      `Placeholder mismatch in JA for ${key}: expected ${placeholders.join(',')} got ${jaPlaceholders.join(',')}`
    );
  });

  // Check no extra keys in EN or JA
  enMap.forEach((_, key) => {
    assert.ok(esMap.has(key), `Extra key in EN: ${key}`);
  });
  jaMap.forEach((_, key) => {
    assert.ok(esMap.has(key), `Extra key in JA: ${key}`);
  });
});
