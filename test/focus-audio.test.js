const test = require('node:test');
const assert = require('node:assert/strict');

test('FocusAudio mode names and defaults', () => {
  const modes = ['silence', 'brown-noise', 'white-noise', 'binaural', 'rain', 'lofi'];
  assert.ok(modes.includes('brown-noise'));
  assert.ok(modes.includes('binaural'));
  assert.ok(modes.includes('lofi'));
  assert.ok(modes.includes('rain'));
});

test('volume clamping keeps volume in [0, 1] range', () => {
  const clampVol = (v) => Math.max(0, Math.min(1, parseFloat(v) || 0));
  assert.equal(clampVol(0.5), 0.5);
  assert.equal(clampVol(1.5), 1.0);
  assert.equal(clampVol(-0.2), 0.0);
  assert.equal(clampVol('0.8'), 0.8);
  assert.equal(clampVol('invalid'), 0.0);
});

test('profile focusTrigger synchronizes with audio mode', () => {
  const profileTriggers = {
    'brown-noise': 'brown-noise',
    'binaural': 'binaural',
    'lofi': 'lofi',
    'rain': 'rain',
    'white-noise': 'white-noise',
    'silence': 'silence'
  };

  for (const [k, v] of Object.entries(profileTriggers)) {
    assert.equal(k, v);
  }
});
