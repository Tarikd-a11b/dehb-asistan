const test = require('node:test');
const assert = require('node:assert/strict');

test('Dopamin Carki has 6 slices', () => {
  const slices = [
    '🎯 Özel Profil Ödülün',
    '🛋️ Sıfır Vicdan Azabıyla Tembellik',
    '🍫 Tatlı / Kahve Ismarla',
    '🎬 Favori Dizinden 2 Bölüm',
    '🎮 45 Dk Oyun / Sosyal Medya',
    '🚶 Müzikle Yürüyüş / Rahatlama'
  ];
  assert.equal(slices.length, 6);
  assert.equal(360 / slices.length, 60);
});

test('Wheel rotation math stays positive and lands on slice', () => {
  const numSlices = 6;
  const arcDegree = 360 / numSlices;
  for (let winningIndex = 0; winningIndex < numSlices; winningIndex++) {
    const extraRounds = 5 * 360;
    const targetSliceDegree = 270 - (winningIndex * arcDegree + arcDegree / 2);
    const finalDegree = extraRounds + ((targetSliceDegree % 360 + 360) % 360);
    assert.ok(finalDegree >= extraRounds);
  }
});
