import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTranslator, describeLocale, directionOf, formatNumber, htmlAttributes, negotiateLocale, parseAcceptLanguage } from './index';

test('direction: Arabic is RTL, French and English are LTR', () => {
  assert.equal(directionOf('ar-TN'), 'rtl');
  assert.equal(directionOf('ar'), 'rtl');
  assert.equal(directionOf('fr-TN'), 'ltr');
  assert.equal(directionOf('en'), 'ltr');
  assert.deepEqual(htmlAttributes('ar-TN'), { lang: 'ar-TN', dir: 'rtl' });
});

test('Accept-Language parsing honours quality values and ignores junk', () => {
  assert.deepEqual(parseAcceptLanguage('fr-TN;q=0.8, ar-TN, en;q=0.1, ;;bad'), [
    { tag: 'ar-TN', q: 1 },
    { tag: 'fr-TN', q: 0.8 },
    { tag: 'en', q: 0.1 },
  ]);
  assert.deepEqual(parseAcceptLanguage(undefined), []);
  assert.deepEqual(parseAcceptLanguage('en;q=0'), []);
});

test('negotiation: exact, then language, then fallback', () => {
  const supported = ['ar-TN', 'fr-TN', 'en'] as const;
  assert.equal(negotiateLocale('fr-TN,en;q=0.5', supported, 'ar-TN'), 'fr-TN');
  assert.equal(negotiateLocale('fr-FR', supported, 'ar-TN'), 'fr-TN');
  assert.equal(negotiateLocale('ar', supported, 'fr-TN'), 'ar-TN');
  assert.equal(negotiateLocale('de-DE', supported, 'ar-TN'), 'ar-TN');
  assert.equal(negotiateLocale(undefined, supported, 'ar-TN'), 'ar-TN');
});

test('Western Arabic digits by default, even in Arabic', () => {
  assert.equal(formatNumber(1234.5, 'ar-TN', { minimumFractionDigits: 3 }), formatNumber(1234.5, 'ar-TN', { minimumFractionDigits: 3 }, 'latn'));
  assert.match(formatNumber(12, 'ar-TN'), /^[0-9]+$/);
});

test('locale description', () => {
  const d = describeLocale('ar-TN');
  assert.equal(d.dir, 'rtl');
  assert.equal(d.region, 'TN');
  assert.equal(d.nameEn, 'Arabic');
});

test('translator: interpolation, plural and fallback', () => {
  const tr = createTranslator(
    {
      'fr-TN': { 'cases.open': { one: '{count} dossier ouvert', other: '{count} dossiers ouverts' }, hello: 'Bonjour {name}' },
      'ar-TN': { hello: 'مرحبا {name}' },
    },
    'ar-TN',
    'fr-TN',
  );
  assert.equal(tr.dir, 'rtl');
  assert.equal(tr.t('hello', { name: 'Sana' }), 'مرحبا Sana');
  assert.equal(tr.t('missing.key'), 'missing.key');
  const fr = createTranslator({ 'fr-TN': { 'cases.open': { one: '{count} dossier ouvert', other: '{count} dossiers ouverts' } } }, 'fr-TN', 'fr-TN');
  assert.equal(fr.t('cases.open', { count: 1 }), '1 dossier ouvert');
  assert.equal(fr.t('cases.open', { count: 3 }), '3 dossiers ouverts');
});
