import test from 'node:test';
import assert from 'node:assert/strict';
import { availableChildren, childDisplayName, hasChildCandidateOverlap, needsChildIdentityReview } from '../src/utils/childSelection.js';
const canonical = { id: 'canonical', name: '合成児童' };
const held = { id: 'held', name: '合成児童', identityReview: 'birth-conflict', candidateChildId: 'canonical' };
const unrelated = { id: 'unrelated', name: '別の児童' };
const master = [canonical, held, unrelated];
test('only unresolved identity states show the review badge', () => {
  assert.equal(needsChildIdentityReview({ identityReview: 'linked-by-unique-name' }), false);
  assert.equal(needsChildIdentityReview({ identityReview: 'birth-conflict' }), true);
  assert.equal(needsChildIdentityReview({ identityReview: 'unmatched-history' }), true);
});
test('held day member excludes both itself and its canonical candidate', () => {
  assert.deepEqual(availableChildren(master, [held], '').map(child => child.id), ['unrelated']);
});
test('canonical day member also excludes the held legacy candidate', () => {
  assert.deepEqual(availableChildren(master, [canonical], '').map(child => child.id), ['unrelated']);
});
test('old report child without migration fields resolves candidate from master without mutation', () => {
  const child = { id: 'held', name: '合成児童' };
  assert.deepEqual(availableChildren(master, [child], '').map(value => value.id), ['unrelated']);
  assert.deepEqual(child, { id: 'held', name: '合成児童' });
});
test('selection overlap prevents selecting both candidates while preserving their separate identities', () => {
  assert.equal(hasChildCandidateOverlap(held, canonical), true);
  assert.equal(hasChildCandidateOverlap(canonical, held), true);
  assert.equal(hasChildCandidateOverlap(unrelated, held), false);
  assert.equal(childDisplayName(held), '合成児童');
  assert.equal(held.candidateChildId, 'canonical');
});
