const test = require('node:test');
const assert = require('node:assert/strict');

const { NotificationManager } = require('../notifications.js');

test('NotificationManager is safe in non-browser environment', () => {
  assert.equal(typeof NotificationManager.requestPermission, 'function');
  assert.equal(typeof NotificationManager.send, 'function');
  assert.equal(typeof NotificationManager.notifySessionComplete, 'function');
  assert.equal(typeof NotificationManager.notifyBreakComplete, 'function');
  // In node.js (no window.Notification), calling send returns null safely
  const res = NotificationManager.send('Test');
  assert.equal(res, null);
});
