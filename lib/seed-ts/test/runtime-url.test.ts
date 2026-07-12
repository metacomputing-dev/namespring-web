import assert from 'node:assert/strict';

import { resolvePublicAssetUrl } from '../src/database/runtime-url.js';

assert.equal(
  resolvePublicAssetUrl('data/hanja.db', {
    applicationBaseUrl: '/namespring-web/',
    origin: 'https://example.github.io',
    documentBaseUri: 'https://example.github.io/namespring-web/payment/success',
  }),
  'https://example.github.io/namespring-web/data/hanja.db',
  'Vite BASE_URL must win over a BrowserRouter direct-route document URL',
);

assert.equal(
  resolvePublicAssetUrl('/generated-packed/career/key.json', {
    applicationBaseUrl: '/namespring-web/',
    origin: 'https://example.github.io',
  }),
  'https://example.github.io/namespring-web/generated-packed/career/key.json',
);

assert.equal(
  resolvePublicAssetUrl('data/fourframe.db', {
    applicationBaseUrl: '/',
    origin: 'https://namespring.example',
  }),
  'https://namespring.example/data/fourframe.db',
);

assert.equal(
  resolvePublicAssetUrl('data/name-stat-shards', {
    documentBaseUri: 'https://namespring.example/subpath/',
  }),
  'https://namespring.example/subpath/data/name-stat-shards',
  'non-Vite consumers retain the historical document.baseURI fallback',
);

assert.equal(
  resolvePublicAssetUrl('https://cdn.example/data/hanja.db', {
    applicationBaseUrl: '/ignored/',
    origin: 'https://namespring.example',
  }),
  'https://cdn.example/data/hanja.db',
);

console.log('Public asset URL contract: PASS');
