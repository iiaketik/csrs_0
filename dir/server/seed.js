const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "uploads", "catalog");

const SVGS = [
  {
    file: "coat.svg",
    name: "Coat 1994",
    rarity: 4,
    price: 4200,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 520"><rect fill="#111" width="400" height="520"/><path d="M80 80 L200 50 L320 80 L300 480 L100 480 Z" fill="none" stroke="#f4f0e8" stroke-width="3"/><path d="M200 50 L200 480" stroke="#f4f0e8" stroke-width="1"/><path d="M140 140 L200 200 L260 140" fill="none" stroke="#f4f0e8" stroke-width="2"/></svg>`
  },
  {
    file: "boots.svg",
    name: "Archive Boots",
    rarity: 3,
    price: 1800,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 520"><rect fill="#0c0c0c" width="400" height="520"/><path d="M110 80 H180 V300 L90 430 H250 L180 300 V80 H250 V300 L340 460 H70 Z" fill="none" stroke="#f4f0e8" stroke-width="3"/></svg>`
  },
  {
    file: "bag.svg",
    name: "Vault Bag",
    rarity: 2,
    price: 900,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 520"><rect fill="#111" width="400" height="520"/><rect x="90" y="180" width="220" height="200" fill="none" stroke="#f4f0e8" stroke-width="3"/><path d="M140 180 C140 120 260 120 260 180" fill="none" stroke="#f4f0e8" stroke-width="3"/></svg>`
  },
  {
    file: "glasses.svg",
    name: "Found Frames",
    rarity: 1,
    price: 400,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 520"><rect fill="#0a0a0a" width="400" height="520"/><circle cx="140" cy="260" r="55" fill="none" stroke="#f4f0e8" stroke-width="3"/><circle cx="260" cy="260" r="55" fill="none" stroke="#f4f0e8" stroke-width="3"/><path d="M195 260 H205 M85 250 H60 M340 250 H315" stroke="#f4f0e8" stroke-width="3"/></svg>`
  },
  {
    file: "dress.svg",
    name: "Atelier Slip",
    rarity: 4,
    price: 5600,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 520"><rect fill="#111" width="400" height="520"/><path d="M150 70 L200 110 L250 70 L280 160 L320 470 L80 470 L120 160 Z" fill="none" stroke="#f4f0e8" stroke-width="3"/></svg>`
  },
  {
    file: "relic.svg",
    name: "Relic Jacket",
    rarity: 5,
    price: 12000,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 520"><rect fill="#080808" width="400" height="520"/><path d="M70 90 L200 40 L330 90 L310 470 L90 470 Z" fill="none" stroke="#f4f0e8" stroke-width="3"/><circle cx="200" cy="200" r="28" fill="none" stroke="#f4f0e8" stroke-width="2"/><text x="200" y="206" text-anchor="middle" font-size="10" fill="#f4f0e8" font-family="serif">R</text></svg>`
  },
  {
    file: "shirt.svg",
    name: "Archive Shirt",
    rarity: 2,
    price: 1100,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 520"><rect fill="#101010" width="400" height="520"/><path d="M90 120 L200 90 L310 120 L280 460 L120 460 Z" fill="none" stroke="#f4f0e8" stroke-width="2"/><path d="M200 90 L200 460" stroke="#f4f0e8" stroke-width="1"/></svg>`
  },
  {
    file: "hat.svg",
    name: "Found Cap",
    rarity: 1,
    price: 350,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 520"><rect fill="#0d0d0d" width="400" height="520"/><ellipse cx="200" cy="250" rx="90" ry="50" fill="none" stroke="#f4f0e8" stroke-width="3"/><path d="M110 250 Q200 140 290 250" fill="none" stroke="#f4f0e8" stroke-width="3"/></svg>`
  }
];

function seedIfEmpty(store) {
  const row = store.get("SELECT COUNT(*) AS c FROM items");
  if (row && row.c > 0) return;
  fs.mkdirSync(DIR, { recursive: true });
  const now = Date.now();
  SVGS.forEach((item) => {
    fs.writeFileSync(path.join(DIR, item.file), item.svg);
    store.run(
      "INSERT INTO items (name, rarity, price, image_path, active, created_at) VALUES (?, ?, ?, ?, 1, ?)",
      [item.name, item.rarity, item.price, `/uploads/catalog/${item.file}`, now]
    );
  });
}

module.exports = { seedIfEmpty };
