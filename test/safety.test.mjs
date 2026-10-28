import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SALT, decode, hashPhrase, mask, scanText } from '../lib/safety.mjs';

// Test values are assembled at run time, so this file itself never holds a finding.
const j = (...parts) => parts.join('');
const rules = (text, opts) => scanText(text, opts).map((h) => h.rule);

test('phone numbers: real shapes caught, fictional 555-01xx and dates left alone', () => {
  assert.deepEqual(rules(j('call +1 ', '415 ', '867 ', '5309')), ['phone:e164']);
  assert.deepEqual(rules(j('call 415', '-867', '-5309')), ['phone:nanp']);
  assert.deepEqual(rules(j('call (415) ', '867-5309')), ['phone:nanp']);
  assert.deepEqual(rules('call 212-555-0123 or +1 212 555 0199 on 2026-10-28'), []);
  assert.deepEqual(rules('sizes 256 512 1024 and v1.2.3'), []);
});

test('addresses: tailnet names, Tailscale and public IPs caught; ranges and well-known ones allowed', () => {
  assert.deepEqual(rules(j('ssh box.tail', 'abcd', '.ts', '.net')), ['tailnet']);
  assert.deepEqual(rules('MagicDNS names look like host.example.ts.net or example.ts.net'), []);
  assert.deepEqual(rules(j('ssh 100.', '101.2.3')), ['ip:tailscale']);
  assert.deepEqual(rules(j('origin 52.', '14.1.9')), ['ip:public']);
  assert.deepEqual(rules('Tailscale uses 100.64.0.0/10; DNS 1.1.1.1, 100.100.100.100; LAN 192.168.1.10; docs 203.0.113.7'), []);
});

test('emails: private ones caught; examples, noreply and file names allowed', () => {
  assert.deepEqual(rules(j('mail jane', '@', 'gmail.com')), ['email']);
  assert.deepEqual(rules('you@example.com, 1+a@users.noreply.github.com, git@github.com, logo@2x.png'), []);
});

test('secret shapes', () => {
  const cases = {
    'secret:aws': j('AKIA', 'Q'.repeat(16)),
    'secret:github': j('ghp_', 'a1'.repeat(18)),
    'secret:anthropic': j('sk-ant-', 'x'.repeat(30)),
    'secret:private-key': j('-----BEGIN OPENSSH ', 'PRIVATE KEY-----'),
    'secret:tailscale': j('tskey-auth-', 'k'.repeat(20)),
    'secret:assignment': j('API_KEY=', 'a8F3k2L9q0W7e5R1t6Y4u3I2o'),
    'path:home': j('/home/', 'alice/code'),
    'wallet:btc': j('bc1q', 'w508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4'),
  };
  for (const [rule, text] of Object.entries(cases)) assert.ok(rules(text).includes(rule), `${rule} in ${mask(text)}`);
  assert.deepEqual(rules('export API_KEY=your-key-here and /home/you/code and /Users/you and $HOME/code'), []);
});

test('the deny-list catches a phrase however it is spelled or encoded, and never prints it', () => {
  const phrase = j('zor', 'kmid ', 'vane');
  const table = new Map([[hashPhrase(phrase, SALT), 'host']]);
  for (const text of [j('on Zor', 'kmid-Vane today'), j('ZORKMID_VANE'), j('zor', 'kmid\nvane'), j('&#122;orkmid vane'), j('zork', '\u00admid vane')]) {
    const hits = scanText(text, { table });
    assert.equal(hits.length, 1, JSON.stringify(text));
    assert.equal(hits[0].rule, 'denylist:host');
    assert.doesNotMatch(hits[0].shown, /zork/i);
  }
  assert.deepEqual(scanText('zorkmid and vane apart', { table }), []);
});

test('decode undoes entities, escapes and invisible characters', () => {
  assert.equal(decode('&#72;&#x65;llo \\u0057orld %41 a\u200bb'), 'Hello World A ab');
  assert.equal(decode('a\u200bb', true), 'a b');
});
