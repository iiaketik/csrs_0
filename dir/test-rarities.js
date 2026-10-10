const assert = require("assert");
const { RARITIES } = require("./server/db");

function pickRarity(random) {
  const total = RARITIES.reduce((s, r) => s + r.weight, 0);
  let n = random * total;
  for (const r of RARITIES) {
    n -= r.weight;
    if (n <= 0) return r.id;
  }
  return 1;
}

assert.strictEqual(RARITIES.length, 5);
assert.strictEqual(pickRarity(0), 1);
assert.strictEqual(pickRarity(0.99), 5);
assert.ok(RARITIES.reduce((s, r) => s + r.weight, 0) === 100);
console.log("ok: rarities and weights");
