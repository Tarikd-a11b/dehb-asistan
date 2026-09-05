const test = require('node:test');
const assert = require('node:assert/strict');

global.document = {
  getElementById() { return null; },
  createElement() { return { id: '', className: '', innerHTML: '', classList: { add() {}, remove() {} } }; },
  body: { appendChild() {} }
};

const { BodyDoublingState, COMPANION_QUOTES, toggleBodyDoublingVisibility } = require('../body-doubling.js');

test('COMPANION_QUOTES contains supportive, non-guilt messages', () => {
  assert.ok(COMPANION_QUOTES.length >= 3);
  for (const q of COMPANION_QUOTES) {
    assert.ok(typeof q === 'string' && q.length > 5);
  }
});

test('toggleBodyDoublingVisibility toggles enabled state', () => {
  toggleBodyDoublingVisibility(false);
  assert.equal(BodyDoublingState.isEnabled, false);
  toggleBodyDoublingVisibility(true);
  assert.equal(BodyDoublingState.isEnabled, true);
});
