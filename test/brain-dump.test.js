const test = require('node:test');
const assert = require('node:assert/strict');

// Mock localStorage
global.localStorage = {
  store: {},
  getItem(key) { return this.store[key] || null; },
  setItem(key, val) { this.store[key] = String(val); },
  clear() { this.store = {}; }
};
global.document = {
  getElementById() { return null; }
};

const { BrainDumpState, addThought, toggleThought, deleteThought, clearCompletedThoughts } = require('../brain-dump.js');

test('addThought adds clean thought to list and saves', () => {
  BrainDumpState.thoughts = [];
  const item = addThought('  Kedinin mamasını al  ');
  assert.ok(item);
  assert.equal(item.text, 'Kedinin mamasını al');
  assert.equal(item.completed, false);
  assert.equal(BrainDumpState.thoughts.length, 1);
});

test('addThought ignores empty or whitespace string', () => {
  BrainDumpState.thoughts = [];
  const item = addThought('   ');
  assert.equal(item, null);
  assert.equal(BrainDumpState.thoughts.length, 0);
});

test('toggleThought changes completed flag', () => {
  BrainDumpState.thoughts = [];
  const item = addThought('Faturayı öde');
  assert.equal(item.completed, false);
  toggleThought(item.id);
  assert.equal(item.completed, true);
  toggleThought(item.id);
  assert.equal(item.completed, false);
});

test('deleteThought removes item by id', () => {
  BrainDumpState.thoughts = [];
  const item1 = addThought('Düşünce 1');
  const item2 = addThought('Düşünce 2');
  assert.equal(BrainDumpState.thoughts.length, 2);
  deleteThought(item1.id);
  assert.equal(BrainDumpState.thoughts.length, 1);
  assert.equal(BrainDumpState.thoughts[0].id, item2.id);
});

test('clearCompletedThoughts purges completed items only', () => {
  BrainDumpState.thoughts = [];
  const item1 = addThought('Bitmemiş 1');
  const item2 = addThought('Bitecek 2');
  toggleThought(item2.id);
  clearCompletedThoughts();
  assert.equal(BrainDumpState.thoughts.length, 1);
  assert.equal(BrainDumpState.thoughts[0].text, 'Bitmemiş 1');
});
