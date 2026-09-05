const test = require('node:test');
const assert = require('node:assert/strict');

global.document = {
  getElementById() { return null; },
  createElement() { return { id: '', className: '', innerHTML: '', classList: { add() {}, remove() {} } }; },
  body: { appendChild() {} }
};

const { BodyDoublingState, SHERLOCK_WORKING_QUOTES, toggleBodyDoublingVisibility } = require('../body-doubling.js');

test('SHERLOCK_WORKING_QUOTES contains supportive detective case quotes', () => {
  assert.ok(SHERLOCK_WORKING_QUOTES.length >= 3);
  for (const q of SHERLOCK_WORKING_QUOTES) {
    assert.ok(typeof q === 'string' && q.length > 5);
  }
});

test('toggleBodyDoublingVisibility toggles enabled state', () => {
  toggleBodyDoublingVisibility(false);
  assert.equal(BodyDoublingState.isEnabled, false);
  toggleBodyDoublingVisibility(true);
  assert.equal(BodyDoublingState.isEnabled, true);
});
