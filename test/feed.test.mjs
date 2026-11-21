// The feed of emendations: well formed, the latest first, and nothing in a title can break the document.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { atomFeed } from '../lib/feed.mjs';

const about = { site: 'https://example.com/', title: 'Feed', subtitle: 'Sub', author: 'A. Writer' };
const folio = (slug, day, extra = {}) => ({ slug, title: slug, summary: `About ${slug}`, updated: new Date(`2026-11-${day}T00:00:00Z`), table: 'The Shell', folio: 'f. 1r', ...extra });

test('the latest emendation comes first, and the feed carries its date', () => {
  const xml = atomFeed([folio('a', '02'), folio('c', '09'), folio('b', '05')], about);
  const order = [...xml.matchAll(/<id>https:\/\/example\.com\/(\w+)\/<\/id>/g)].map((m) => m[1]);
  assert.deepEqual(order, ['c', 'b', 'a']);
  assert.match(xml, /<feed xmlns="http:\/\/www\.w3\.org\/2005\/Atom">\s+<title>Feed<\/title>/);
  assert.ok(xml.includes('<updated>2026-11-09T00:00:00.000Z</updated>\n  <author>'));
  assert.ok(xml.includes('<link rel="self" href="https://example.com/emendations.xml"/>'));
});

test('folios emended on one day keep a steady order', () => {
  const a = atomFeed([folio('b', '05'), folio('a', '05')], about);
  const b = atomFeed([folio('a', '05'), folio('b', '05')], about);
  assert.equal(a, b);
});

test('only so many are listed', () => {
  const many = Array.from({ length: 50 }, (_, i) => folio(`f${i}`, String((i % 28) + 1).padStart(2, '0')));
  assert.equal((atomFeed(many, about).match(/<entry>/g) ?? []).length, 30);
  assert.equal((atomFeed(many, { ...about, limit: 5 }).match(/<entry>/g) ?? []).length, 5);
});

test('markup in a title or a summary is escaped, not passed through', () => {
  const xml = atomFeed([folio('x', '01', { title: 'A <b> & "c"', summary: 'x < y && y > z' })], about);
  assert.ok(xml.includes('<title>A &lt;b&gt; &amp; &quot;c&quot;</title>'));
  assert.ok(xml.includes('<summary>x &lt; y &amp;&amp; y &gt; z</summary>'));
  // Every tag that opens closes: the document is balanced.
  const opens = (xml.match(/<(entry|title|summary|id|updated|feed|author|name|subtitle)[ >]/g) ?? []).length;
  const closes = (xml.match(/<\/(entry|title|summary|id|updated|feed|author|name|subtitle)>/g) ?? []).length;
  assert.equal(opens, closes);
});

test('an empty library still makes a feed', () => {
  const xml = atomFeed([], about);
  assert.ok(xml.includes('<updated>1970-01-01T00:00:00.000Z</updated>'));
  assert.ok(!xml.includes('<entry>'));
});
