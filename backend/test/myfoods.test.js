import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateMyFood, matchMyFoods } from '../lib/myfoods.js';
import { myFoodsHandler } from '../api/my-foods.js';
import { HttpError } from '../lib/http.js';

const blitz = { name: 'Blitz bar vanilla', serving: '1 bar', kcal: 210, protein: 20, carbs: 6, fat: 7, fiber: 2, sugar: 1, sat_fat: 2, sodium: 150, cholesterol: 5, potassium: 150 };

// ---- validateMyFood ----
test('valid food passes and is trimmed', () => {
  const r = validateMyFood({ ...blitz, name: '  Blitz bar vanilla ', serving: ' 1 bar ' });
  assert.equal(r.ok, true);
  assert.equal(r.food.name, 'Blitz bar vanilla');
  assert.equal(r.food.serving, '1 bar');
});
test('serving defaults to "1 serving"', () => {
  const { serving, ...rest } = blitz;
  assert.equal(validateMyFood(rest).food.serving, '1 serving');
});
test('missing nutrients become null', () => {
  const r = validateMyFood({ name: 'Rice', kcal: 200, protein: 4, carbs: 44, fat: 0.4 });
  assert.equal(r.ok, true);
  assert.equal(r.food.sodium, null);
});
test('bad name or numbers fail', () => {
  assert.equal(validateMyFood({ ...blitz, name: ' ' }).ok, false);
  assert.equal(validateMyFood({ ...blitz, name: 'x'.repeat(61) }).ok, false);
  assert.equal(validateMyFood({ ...blitz, kcal: -1 }).ok, false);
  assert.equal(validateMyFood({ ...blitz, protein: '20' }).ok, false);
  assert.equal(validateMyFood(null).ok, false);
});

// ---- matchMyFoods ----
const foods = [
  { id: 1, name: 'Blitz bar vanilla' }, { id: 2, name: 'Blitz bar choco' },
  { id: 3, name: 'Promatrix7 protein' }, { id: 4, name: 'Rice crackers' }, { id: 5, name: 'My usual breakfast' },
];
test('"2 blitz bars" matches both blitz bars', () =>
  assert.deepEqual(matchMyFoods('2 blitz bars', foods).map((f) => f.id).sort(), [1, 2]));
test('"vanilla blitz" ranks vanilla first', () => assert.equal(matchMyFoods('vanilla blitz', foods)[0].id, 1));
test('"rice" matches Rice crackers (the AI decides)', () => assert.deepEqual(matchMyFoods('rice and chicken', foods).map((f) => f.id), [4]));
test('words under 3 letters are ignored', () => assert.deepEqual(matchMyFoods('an egg', foods), []));
test('"log my usual breakfast" matches the saved meal', () => assert.equal(matchMyFoods('log my usual breakfast', foods)[0].id, 5));
test('case-insensitive', () => assert.equal(matchMyFoods('PROMATRIX7 scoop', foods)[0].id, 3));
test('never more than max', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, name: `Protein bar ${i}` }));
  assert.equal(matchMyFoods('protein bar', many).length, 10);
  assert.equal(matchMyFoods('protein bar', many, 3).length, 3);
});

// ---- handler ----
function fakeStore() {
  let next = 1;
  return {
    foods: [],
    async listMyFoods() { return this.foods; },
    async addMyFood(f) {
      if (this.foods.some((x) => x.name.toLowerCase() === f.name.toLowerCase())) throw new HttpError(409, `You already have a food called ${f.name}`);
      const row = { id: next++, ...f }; this.foods.push(row); return row;
    },
    async updateMyFood(id, f) { const i = this.foods.findIndex((x) => x.id === id); this.foods[i] = { id, ...f }; return this.foods[i]; },
    async removeMyFoods(ids) { const n = this.foods.length; this.foods = this.foods.filter((x) => !ids.includes(x.id)); return n - this.foods.length; },
  };
}
const is = (status) => (e) => e instanceof HttpError && e.status === status;

test('POST saves a food; GET lists it', async () => {
  const store = fakeStore();
  const { body } = await myFoodsHandler({ method: 'POST', body: { food: blitz } }, store);
  assert.equal(body.food.name, 'Blitz bar vanilla');
  assert.equal((await myFoodsHandler({ method: 'GET', body: {} }, store)).body.foods.length, 1);
});
test('POST duplicate name → 409', async () => {
  const store = fakeStore();
  await myFoodsHandler({ method: 'POST', body: { food: blitz } }, store);
  await assert.rejects(myFoodsHandler({ method: 'POST', body: { food: { ...blitz, name: 'blitz BAR vanilla' } } }, store), is(409));
});
test('POST invalid food → 400', () =>
  assert.rejects(myFoodsHandler({ method: 'POST', body: { food: { ...blitz, kcal: 'lots' } } }, fakeStore()), is(400)));
test('PUT updates', async () => {
  const store = fakeStore();
  const { body: { food } } = await myFoodsHandler({ method: 'POST', body: { food: blitz } }, store);
  const { body } = await myFoodsHandler({ method: 'PUT', body: { id: food.id, food: { ...blitz, kcal: 200 } } }, store);
  assert.equal(body.food.kcal, 200);
});
test('PUT bad id → 400', () =>
  assert.rejects(myFoodsHandler({ method: 'PUT', body: { id: 'x', food: blitz } }, fakeStore()), is(400)));
test('DELETE removes; bad ids → 400', async () => {
  const store = fakeStore();
  const { body: { food } } = await myFoodsHandler({ method: 'POST', body: { food: blitz } }, store);
  assert.deepEqual((await myFoodsHandler({ method: 'DELETE', body: { ids: [food.id] } }, store)).body, { removed: 1 });
  await assert.rejects(myFoodsHandler({ method: 'DELETE', body: { ids: [] } }, store), is(400));
});
