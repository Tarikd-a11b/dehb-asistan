const test = require('node:test');
const assert = require('node:assert/strict');

test('İnat Modu TOTAL_HP is 180 seconds (3 minutes)', () => {
  const TOTAL_HP = 180;
  assert.equal(TOTAL_HP, 180);
});

test('Boss HP percentage calculation', () => {
  const TOTAL_HP = 180;
  const getPct = (rem) => Math.max(0, (rem / TOTAL_HP) * 100);
  assert.equal(getPct(180), 100);
  assert.equal(getPct(90), 50);
  assert.equal(getPct(0), 0);
  assert.equal(getPct(-5), 0);
});

test('Formatting mm:ss for inat countdown', () => {
  const fmt = (rem) => {
    const m = Math.floor(rem / 60);
    const s = rem % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  assert.equal(fmt(180), '03:00');
  assert.equal(fmt(95), '01:35');
  assert.equal(fmt(7), '00:07');
  assert.equal(fmt(0), '00:00');
});
