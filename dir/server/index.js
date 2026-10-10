require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { initDb, RARITIES } = require("./db");
const { validateInitData } = require("./auth");
const { createBot } = require("./bot");
const { seedIfEmpty } = require("./seed");

const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);
const CHANNEL = process.env.CHANNEL || "@CATSALERS";
const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/$/, "");
const PULL_COST = Number(process.env.PULL_COST || 1000);
const FREE_MS = Number(process.env.FREE_PULL_HOURS || 2) * 60 * 60 * 1000;
const ALLOW_DEV = process.env.ALLOW_DEV === "1";

const UPLOADS = path.join(__dirname, "..", "uploads");
["catalog", "backgrounds", "music", "user"].forEach((d) =>
  fs.mkdirSync(path.join(UPLOADS, d), { recursive: true })
);

function makeUploader(folder) {
  return multer({
    storage: multer.diskStorage({
      destination: path.join(UPLOADS, folder),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || "") || ".bin";
        cb(null, `${folder}-${Date.now()}${ext.toLowerCase()}`);
      }
    }),
    limits: { fileSize: 18 * 1024 * 1024 }
  });
}

const uploadBg = makeUploader("backgrounds");
const uploadMusic = makeUploader("music");

function pickRarity() {
  const total = RARITIES.reduce((s, r) => s + r.weight, 0);
  let n = Math.random() * total;
  for (const r of RARITIES) {
    n -= r.weight;
    if (n <= 0) return r.id;
  }
  return 1;
}

function publicItem(row) {
  if (!row) return null;
  const rarity = RARITIES.find((r) => r.id === row.rarity) || RARITIES[0];
  return {
    ...row,
    rarityKey: rarity.key,
    rarityLabel: rarity.label
  };
}

async function main() {
  const store = await initDb();
  const { run, all, get } = store;
  seedIfEmpty(store);

  const { bot, isSubscribed } = createBot({
    token: BOT_TOKEN,
    adminId: ADMIN_ID,
    channel: CHANNEL,
    publicUrl: PUBLIC_URL,
    store,
    notify: async (telegramId, text) => {
      try {
        await bot.telegram.sendMessage(telegramId, text);
      } catch {
        /* ignore */
      }
    }
  });

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.use("/uploads", express.static(UPLOADS));

  async function auth(req, res, next) {
    const initData = req.header("x-telegram-init-data") || "";
    let tg = validateInitData(initData, BOT_TOKEN);
    if (!tg && ALLOW_DEV) {
      tg = { id: ADMIN_ID, username: "admin", first_name: "Admin" };
    }
    if (!tg) return res.status(401).json({ error: "auth" });
    const subscribed = await isSubscribed(tg.id);
    if (!subscribed && !(ALLOW_DEV && tg.id === ADMIN_ID)) {
      return res.status(403).json({ error: "subscribe", channel: CHANNEL });
    }
    let user = get("SELECT * FROM users WHERE telegram_id = ?", [tg.id]);
    if (!user) {
      run(
        "INSERT INTO users (telegram_id, username, first_name, balance, created_at) VALUES (?, ?, ?, ?, ?)",
        [tg.id, tg.username || "", tg.first_name || "", Number(process.env.STARTER_BALANCE || 0), Date.now()]
      );
      user = get("SELECT * FROM users WHERE telegram_id = ?", [tg.id]);
    } else {
      run("UPDATE users SET username = ?, first_name = ? WHERE id = ?", [
        tg.username || user.username,
        tg.first_name || user.first_name,
        user.id
      ]);
      user = get("SELECT * FROM users WHERE id = ?", [user.id]);
    }
    req.user = user;
    req.tg = tg;
    req.isAdmin = tg.id === ADMIN_ID;
    next();
  }

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.get("/api/me", auth, (req, res) => {
    const nextFree = req.user.last_free_pull_at ? req.user.last_free_pull_at + FREE_MS : 0;
    res.json({
      id: req.user.id,
      telegramId: req.user.telegram_id,
      username: req.user.username,
      firstName: req.user.first_name,
      balance: req.user.balance,
      isAdmin: req.isAdmin,
      pullCost: PULL_COST,
      nextFreeAt: nextFree,
      channel: CHANNEL
    });
  });

  app.get("/api/catalog", auth, (_req, res) => {
    res.json(all("SELECT * FROM items WHERE active = 1 ORDER BY rarity DESC, id DESC").map(publicItem));
  });

  app.get("/api/collection/:userId?", auth, (req, res) => {
    const userId = Number(req.params.userId || req.user.id);
    const owner = get("SELECT id, username, first_name FROM users WHERE id = ?", [userId]);
    if (!owner) return res.status(404).json({ error: "not_found" });
    const items = all(
      `SELECT inv.id AS inventoryId, inv.locked, inv.obtained_at, it.*
       FROM inventory inv JOIN items it ON it.id = inv.item_id
       WHERE inv.user_id = ? ORDER BY inv.obtained_at DESC`,
      [userId]
    ).map(publicItem);
    res.json({ owner, items });
  });

  app.post("/api/pull", auth, (req, res) => {
    const paid = Boolean(req.body && req.body.paid);
    const now = Date.now();
    if (!paid) {
      if (req.user.last_free_pull_at && now - req.user.last_free_pull_at < FREE_MS) {
        return res.status(400).json({
          error: "cooldown",
          nextFreeAt: req.user.last_free_pull_at + FREE_MS
        });
      }
    } else {
      if (req.user.balance < PULL_COST) {
        return res.status(400).json({ error: "balance", need: PULL_COST });
      }
    }
    const catalog = all("SELECT * FROM items WHERE active = 1");
    if (!catalog.length) return res.status(400).json({ error: "empty_catalog" });
    let rarity = pickRarity();
    let pool = catalog.filter((i) => i.rarity === rarity);
    while (!pool.length && rarity > 1) {
      rarity -= 1;
      pool = catalog.filter((i) => i.rarity === rarity);
    }
    if (!pool.length) pool = catalog;
    const item = pool[Math.floor(Math.random() * pool.length)];
    if (paid) run("UPDATE users SET balance = balance - ? WHERE id = ?", [PULL_COST, req.user.id]);
    else run("UPDATE users SET last_free_pull_at = ? WHERE id = ?", [now, req.user.id]);
    run("INSERT INTO inventory (user_id, item_id, locked, obtained_at) VALUES (?, ?, 0, ?)", [
      req.user.id,
      item.id,
      now
    ]);
    const inv = get("SELECT id FROM inventory WHERE user_id = ? ORDER BY id DESC LIMIT 1", [req.user.id]);
    run("INSERT INTO pulls (user_id, item_id, paid, created_at) VALUES (?, ?, ?, ?)", [
      req.user.id,
      item.id,
      paid ? 1 : 0,
      now
    ]);
    const user = get("SELECT * FROM users WHERE id = ?", [req.user.id]);
    res.json({
      item: publicItem({ ...item, inventoryId: inv.id }),
      balance: user.balance,
      nextFreeAt: (user.last_free_pull_at || now) + FREE_MS
    });
  });

  app.get("/api/market", auth, (_req, res) => {
    const rows = all(
      `SELECT l.id, l.price, l.created_at, u.username, u.first_name, inv.id AS inventoryId, it.*
       FROM listings l
       JOIN inventory inv ON inv.id = l.inventory_id
       JOIN items it ON it.id = inv.item_id
       JOIN users u ON u.id = l.seller_id
       WHERE l.status = 'open' ORDER BY l.created_at DESC`
    ).map(publicItem);
    res.json(rows);
  });

  app.post("/api/market", auth, (req, res) => {
    const inventoryId = Number(req.body.inventoryId);
    const price = Math.max(1, Number(req.body.price) || 0);
    const inv = get("SELECT * FROM inventory WHERE id = ? AND user_id = ?", [inventoryId, req.user.id]);
    if (!inv || inv.locked) return res.status(400).json({ error: "locked" });
    run("UPDATE inventory SET locked = 1 WHERE id = ?", [inventoryId]);
    run(
      "INSERT INTO listings (seller_id, inventory_id, price, status, created_at) VALUES (?, ?, ?, 'open', ?)",
      [req.user.id, inventoryId, price, Date.now()]
    );
    res.json({ ok: true });
  });

  app.post("/api/market/:id/buy", auth, (req, res) => {
    const listing = get("SELECT * FROM listings WHERE id = ? AND status = 'open'", [Number(req.params.id)]);
    if (!listing) return res.status(404).json({ error: "not_found" });
    if (listing.seller_id === req.user.id) return res.status(400).json({ error: "own" });
    if (req.user.balance < listing.price) return res.status(400).json({ error: "balance" });
    run("UPDATE users SET balance = balance - ? WHERE id = ?", [listing.price, req.user.id]);
    run("UPDATE users SET balance = balance + ? WHERE id = ?", [listing.price, listing.seller_id]);
    run("UPDATE inventory SET user_id = ?, locked = 0 WHERE id = ?", [req.user.id, listing.inventory_id]);
    run("UPDATE listings SET status = 'sold' WHERE id = ?", [listing.id]);
    const seller = get("SELECT telegram_id FROM users WHERE id = ?", [listing.seller_id]);
    bot.telegram.sendMessage(seller.telegram_id, `Вещь с витрины купили за ${listing.price} ₽.`).catch(() => {});
    res.json({ ok: true, balance: req.user.balance - listing.price });
  });

  app.post("/api/market/:id/cancel", auth, (req, res) => {
    const listing = get("SELECT * FROM listings WHERE id = ? AND seller_id = ? AND status = 'open'", [
      Number(req.params.id),
      req.user.id
    ]);
    if (!listing) return res.status(404).json({ error: "not_found" });
    run("UPDATE listings SET status = 'cancelled' WHERE id = ?", [listing.id]);
    run("UPDATE inventory SET locked = 0 WHERE id = ?", [listing.inventory_id]);
    res.json({ ok: true });
  });

  app.get("/api/auctions", auth, (_req, res) => {
    const rows = all(
      `SELECT a.*, u.username, u.first_name, it.*, inv.id AS inventoryId
       FROM auctions a
       JOIN inventory inv ON inv.id = a.inventory_id
       JOIN items it ON it.id = inv.item_id
       JOIN users u ON u.id = a.seller_id
       WHERE a.status = 'open' ORDER BY a.ends_at ASC`
    ).map(publicItem);
    res.json(rows);
  });

  app.post("/api/auctions", auth, (req, res) => {
    const inventoryId = Number(req.body.inventoryId);
    const startPrice = Math.max(1, Number(req.body.startPrice) || 0);
    const hours = Math.min(72, Math.max(1, Number(req.body.hours) || 24));
    const inv = get("SELECT * FROM inventory WHERE id = ? AND user_id = ?", [inventoryId, req.user.id]);
    if (!inv || inv.locked) return res.status(400).json({ error: "locked" });
    run("UPDATE inventory SET locked = 1 WHERE id = ?", [inventoryId]);
    run(
      `INSERT INTO auctions (seller_id, inventory_id, start_price, current_bid, current_bidder_id, ends_at, status, created_at)
       VALUES (?, ?, ?, ?, NULL, ?, 'open', ?)`,
      [req.user.id, inventoryId, startPrice, startPrice, Date.now() + hours * 3600 * 1000, Date.now()]
    );
    res.json({ ok: true });
  });

  app.post("/api/auctions/:id/bid", auth, (req, res) => {
    const auction = get("SELECT * FROM auctions WHERE id = ? AND status = 'open'", [Number(req.params.id)]);
    if (!auction) return res.status(404).json({ error: "not_found" });
    if (auction.seller_id === req.user.id) return res.status(400).json({ error: "own" });
    if (auction.ends_at < Date.now()) return res.status(400).json({ error: "ended" });
    const bid = Number(req.body.amount);
    const min = auction.current_bidder_id ? auction.current_bid + 50 : auction.start_price;
    if (bid < min) return res.status(400).json({ error: "low", min });
    if (req.user.balance < bid) return res.status(400).json({ error: "balance" });
    if (auction.current_bidder_id) {
      run("UPDATE users SET balance = balance + ? WHERE id = ?", [auction.current_bid, auction.current_bidder_id]);
    }
    run("UPDATE users SET balance = balance - ? WHERE id = ?", [bid, req.user.id]);
    run("UPDATE auctions SET current_bid = ?, current_bidder_id = ? WHERE id = ?", [
      bid,
      req.user.id,
      auction.id
    ]);
    if (auction.current_bidder_id && auction.current_bidder_id !== req.user.id) {
      const prev = get("SELECT telegram_id FROM users WHERE id = ?", [auction.current_bidder_id]);
      bot.telegram.sendMessage(prev.telegram_id, `Ставку вернули. Текущая ${bid} ₽.`).catch(() => {});
    }
    res.json({ ok: true });
  });

  app.get("/api/trades", auth, (req, res) => {
    const rows = all(
      `SELECT t.*,
              fu.username AS from_username,
              tu.username AS to_username
       FROM trades t
       JOIN users fu ON fu.id = t.from_user
       JOIN users tu ON tu.id = t.to_user
       WHERE (t.from_user = ? OR t.to_user = ?) AND t.status = 'open'
       ORDER BY t.created_at DESC`,
      [req.user.id, req.user.id]
    );
    res.json(rows);
  });

  app.post("/api/trades", auth, (req, res) => {
    const fromInv = Number(req.body.fromInv);
    const toInv = Number(req.body.toInv);
    const mine = get("SELECT * FROM inventory WHERE id = ? AND user_id = ?", [fromInv, req.user.id]);
    const theirs = get("SELECT * FROM inventory WHERE id = ?", [toInv]);
    if (!mine || !theirs || mine.locked || theirs.locked) return res.status(400).json({ error: "locked" });
    if (theirs.user_id === req.user.id) return res.status(400).json({ error: "own" });
    run(
      "INSERT INTO trades (from_user, to_user, from_inv, to_inv, status, created_at) VALUES (?, ?, ?, ?, 'open', ?)",
      [req.user.id, theirs.user_id, fromInv, toInv, Date.now()]
    );
    run("UPDATE inventory SET locked = 1 WHERE id IN (?, ?)", [fromInv, toInv]);
    const other = get("SELECT telegram_id FROM users WHERE id = ?", [theirs.user_id]);
    bot.telegram.sendMessage(other.telegram_id, "Тебе предложили обмен в архиве.").catch(() => {});
    res.json({ ok: true });
  });

  app.post("/api/trades/:id/respond", auth, (req, res) => {
    const trade = get("SELECT * FROM trades WHERE id = ? AND status = 'open'", [Number(req.params.id)]);
    if (!trade || trade.to_user !== req.user.id) return res.status(404).json({ error: "not_found" });
    const accept = Boolean(req.body.accept);
    if (accept) {
      run("UPDATE inventory SET user_id = ?, locked = 0 WHERE id = ?", [trade.to_user, trade.from_inv]);
      run("UPDATE inventory SET user_id = ?, locked = 0 WHERE id = ?", [trade.from_user, trade.to_inv]);
      run("UPDATE trades SET status = 'accepted' WHERE id = ?", [trade.id]);
    } else {
      run("UPDATE inventory SET locked = 0 WHERE id IN (?, ?)", [trade.from_inv, trade.to_inv]);
      run("UPDATE trades SET status = 'declined' WHERE id = ?", [trade.id]);
    }
    const from = get("SELECT telegram_id FROM users WHERE id = ?", [trade.from_user]);
    bot.telegram
      .sendMessage(from.telegram_id, accept ? "Обмен принят." : "Обмен отклонён.")
      .catch(() => {});
    res.json({ ok: true });
  });

  app.get("/api/users", auth, (req, res) => {
    const q = String(req.query.q || "").replace("@", "").toLowerCase();
    const rows = all(
      "SELECT id, username, first_name FROM users WHERE id != ? ORDER BY id DESC LIMIT 40",
      [req.user.id]
    ).filter((u) => !q || (u.username || "").toLowerCase().includes(q) || (u.first_name || "").toLowerCase().includes(q));
    res.json(rows);
  });

  function collagePayload(c, userId) {
    const layers = all(
      `SELECT cl.*, it.name, it.image_path, it.rarity, inv.item_id
       FROM collage_layers cl
       JOIN inventory inv ON inv.id = cl.inventory_id
       JOIN items it ON it.id = inv.item_id
       WHERE cl.collage_id = ? ORDER BY cl.z ASC`,
      [c.id]
    ).map(publicItem);
    const likes = get("SELECT COUNT(*) AS c FROM collage_likes WHERE collage_id = ?", [c.id]).c;
    const liked = !!get("SELECT 1 AS x FROM collage_likes WHERE collage_id = ? AND user_id = ?", [c.id, userId]);
    const fav = !!get("SELECT 1 AS x FROM favorites WHERE collage_id = ? AND user_id = ?", [c.id, userId]);
    const author = get("SELECT id, username, first_name FROM users WHERE id = ?", [c.user_id]);
    return { ...c, layers, likes, liked, fav, author };
  }

  app.get("/api/collages", auth, (req, res) => {
    const rows = all(
      "SELECT * FROM collages WHERE published = 1 ORDER BY updated_at DESC LIMIT 80"
    ).map((c) => collagePayload(c, req.user.id));
    res.json(rows);
  });

  app.get("/api/collages/mine", auth, (req, res) => {
    const rows = all("SELECT * FROM collages WHERE user_id = ? ORDER BY updated_at DESC", [req.user.id]).map((c) =>
      collagePayload(c, req.user.id)
    );
    res.json(rows);
  });

  app.get("/api/collages/:id", auth, (req, res) => {
    const c = get("SELECT * FROM collages WHERE id = ?", [Number(req.params.id)]);
    if (!c) return res.status(404).json({ error: "not_found" });
    res.json(collagePayload(c, req.user.id));
  });

  app.post("/api/collages", auth, (req, res) => {
    const title = String(req.body.title || "без названия").slice(0, 80);
    const now = Date.now();
    run(
      "INSERT INTO collages (user_id, title, background_path, music_path, published, created_at, updated_at) VALUES (?, ?, NULL, NULL, 1, ?, ?)",
      [req.user.id, title, now, now]
    );
    const c = get("SELECT * FROM collages WHERE user_id = ? ORDER BY id DESC LIMIT 1", [req.user.id]);
    res.json(collagePayload(c, req.user.id));
  });

  app.put("/api/collages/:id", auth, (req, res) => {
    const c = get("SELECT * FROM collages WHERE id = ? AND user_id = ?", [Number(req.params.id), req.user.id]);
    if (!c) return res.status(404).json({ error: "not_found" });
    const title = String(req.body.title || c.title).slice(0, 80);
    const published = req.body.published === undefined ? c.published : req.body.published ? 1 : 0;
    run("UPDATE collages SET title = ?, published = ?, updated_at = ? WHERE id = ?", [
      title,
      published,
      Date.now(),
      c.id
    ]);
    run("DELETE FROM collage_layers WHERE collage_id = ?", [c.id]);
    const layers = Array.isArray(req.body.layers) ? req.body.layers.slice(0, 24) : [];
    layers.forEach((l, i) => {
      const inv = get("SELECT * FROM inventory WHERE id = ? AND user_id = ?", [Number(l.inventoryId), req.user.id]);
      if (!inv) return;
      run(
        "INSERT INTO collage_layers (collage_id, inventory_id, x, y, scale, rotation, z) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [c.id, inv.id, Number(l.x) || 0.5, Number(l.y) || 0.5, Number(l.scale) || 1, Number(l.rotation) || 0, i]
      );
    });
    const saved = get("SELECT * FROM collages WHERE id = ?", [c.id]);
    res.json(collagePayload(saved, req.user.id));
  });

  app.post("/api/collages/:id/background", auth, uploadBg.single("file"), (req, res) => {
    const c = get("SELECT * FROM collages WHERE id = ? AND user_id = ?", [Number(req.params.id), req.user.id]);
    if (!c || !req.file) return res.status(400).json({ error: "file" });
    const p = `/uploads/backgrounds/${req.file.filename}`;
    run("UPDATE collages SET background_path = ?, updated_at = ? WHERE id = ?", [p, Date.now(), c.id]);
    res.json({ background_path: p });
  });

  app.post("/api/collages/:id/music", auth, uploadMusic.single("file"), (req, res) => {
    const c = get("SELECT * FROM collages WHERE id = ? AND user_id = ?", [Number(req.params.id), req.user.id]);
    if (!c || !req.file) return res.status(400).json({ error: "file" });
    const p = `/uploads/music/${req.file.filename}`;
    run("UPDATE collages SET music_path = ?, updated_at = ? WHERE id = ?", [p, Date.now(), c.id]);
    res.json({ music_path: p });
  });

  app.post("/api/collages/:id/like", auth, (req, res) => {
    const c = get("SELECT * FROM collages WHERE id = ? AND published = 1", [Number(req.params.id)]);
    if (!c) return res.status(404).json({ error: "not_found" });
    const existing = get("SELECT 1 AS x FROM collage_likes WHERE collage_id = ? AND user_id = ?", [c.id, req.user.id]);
    if (existing) {
      run("DELETE FROM collage_likes WHERE collage_id = ? AND user_id = ?", [c.id, req.user.id]);
    } else {
      run("INSERT INTO collage_likes (collage_id, user_id, created_at) VALUES (?, ?, ?)", [
        c.id,
        req.user.id,
        Date.now()
      ]);
    }
    res.json(collagePayload(get("SELECT * FROM collages WHERE id = ?", [c.id]), req.user.id));
  });

  app.post("/api/collages/:id/fav", auth, (req, res) => {
    const c = get("SELECT * FROM collages WHERE id = ?", [Number(req.params.id)]);
    if (!c) return res.status(404).json({ error: "not_found" });
    const existing = get("SELECT 1 AS x FROM favorites WHERE collage_id = ? AND user_id = ?", [c.id, req.user.id]);
    if (existing) run("DELETE FROM favorites WHERE collage_id = ? AND user_id = ?", [c.id, req.user.id]);
    else
      run("INSERT INTO favorites (user_id, collage_id, created_at) VALUES (?, ?, ?)", [
        req.user.id,
        c.id,
        Date.now()
      ]);
    res.json({ ok: true });
  });

  const dist = path.join(__dirname, "..", "web", "dist");
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
  }

  app.listen(PORT, async () => {
    console.log(`archive listening on ${PORT}`);
    if (PUBLIC_URL && !PUBLIC_URL.includes("YOUR-DOMAIN")) {
      try {
        await bot.telegram.setChatMenuButton({
          menuButton: { type: "web_app", text: "Архив", web_app: { url: PUBLIC_URL } }
        });
      } catch (err) {
        console.error("menu button", err.message);
      }
    }
    await bot.launch();
    console.log("bot launched");
  });

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
