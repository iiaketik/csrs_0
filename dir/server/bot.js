const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const path = require("path");
const cron = require("node-cron");

const CATALOG_DIR = path.join(__dirname, "..", "uploads", "catalog");

const RARITY_NAMES = {
  1: "FOUND",
  2: "ARCHIVE",
  3: "VAULT",
  4: "ATELIER",
  5: "RELIC"
};

function createBot({ token, adminId, channel, publicUrl, store, notify }) {
  const bot = new Telegraf(token);
  const adminState = new Map();

  function webAppKeyboard() {
    if (!publicUrl || publicUrl.includes("YOUR-DOMAIN")) {
      return Markup.inlineKeyboard([
        [Markup.button.url("Канал CATSALERS", "https://t.me/CATSALERS")]
      ]);
    }
    return Markup.inlineKeyboard([
      [Markup.button.webApp("Открыть архив", publicUrl)],
      [Markup.button.url("Канал @CATSALERS", "https://t.me/CATSALERS")]
    ]);
  }

  async function isSubscribed(userId) {
    try {
      const member = await bot.telegram.getChatMember(channel, userId);
      return ["creator", "administrator", "member", "restricted"].includes(member.status);
    } catch (err) {
      console.error("subscribe check failed", err.message);
      return false;
    }
  }

  bot.start(async (ctx) => {
    const ok = await isSubscribed(ctx.from.id);
    if (!ok) {
      return ctx.reply(
        "Вход в архив только по подписке на @CATSALERS.\nПодпишись и нажми /start ещё раз.",
        Markup.inlineKeyboard([
          [Markup.button.url("Подписаться", "https://t.me/CATSALERS")],
          [Markup.button.callback("Проверить подписку", "check_sub")]
        ])
      );
    }
    const { get, run } = store;
    const now = Date.now();
    const existing = get("SELECT * FROM users WHERE telegram_id = ?", [ctx.from.id]);
    if (!existing) {
      run(
        "INSERT INTO users (telegram_id, username, first_name, balance, created_at) VALUES (?, ?, ?, ?, ?)",
        [ctx.from.id, ctx.from.username || "", ctx.from.first_name || "", Number(process.env.STARTER_BALANCE || 0), now]
      );
    }
    const extra =
      ctx.from.id === adminId
        ? "\n\nАдмин: пришли фото вещи, затем название, редкость 1–5 и цену."
        : "";
    return ctx.reply(
      `CATSALERS ARCHIVE\n\nКаждые 2 часа — свободный доступ к дропу.\nИли выбей вещь за 1000 ₽.\nКоллекция, рынок, аукцион, обмен, коллажи.` + extra,
      webAppKeyboard()
    );
  });

  bot.action("check_sub", async (ctx) => {
    const ok = await isSubscribed(ctx.from.id);
    await ctx.answerCbQuery(ok ? "Доступ открыт" : "Подписки нет");
    if (ok) {
      await ctx.reply("Архив открыт.", webAppKeyboard());
    } else {
      await ctx.reply("Подпишись на @CATSALERS, затем проверь снова.");
    }
  });

  bot.command("admin", async (ctx) => {
    if (ctx.from.id !== adminId) return;
    await ctx.reply(
      [
        "Админ-команды:",
        "/give <telegram_id> <сумма> — начислить ₽",
        "/stats — статистика",
        "/broadcast <текст> — всем пользователям",
        "Пришли фото вещи → название → редкость 1-5 → цена"
      ].join("\n")
    );
  });

  bot.command("stats", async (ctx) => {
    if (ctx.from.id !== adminId) return;
    const { get } = store;
    const users = get("SELECT COUNT(*) AS c FROM users").c;
    const items = get("SELECT COUNT(*) AS c FROM items WHERE active = 1").c;
    const pulls = get("SELECT COUNT(*) AS c FROM pulls").c;
    const likes = get("SELECT COUNT(*) AS c FROM collage_likes").c;
    await ctx.reply(`Пользователи: ${users}\nВещей в каталоге: ${items}\nДропов: ${pulls}\nЛайков: ${likes}`);
  });

  bot.command("give", async (ctx) => {
    if (ctx.from.id !== adminId) return;
    const parts = (ctx.message.text || "").split(/\s+/);
    const tid = Number(parts[1]);
    const amount = Number(parts[2]);
    if (!tid || !amount) return ctx.reply("Формат: /give 6562008872 5000");
    const { get, run } = store;
    const user = get("SELECT * FROM users WHERE telegram_id = ?", [tid]);
    if (!user) return ctx.reply("Пользователь ещё не заходил.");
    run("UPDATE users SET balance = balance + ? WHERE id = ?", [amount, user.id]);
    await ctx.reply(`Начислено ${amount} ₽ пользователю ${tid}`);
    try {
      await bot.telegram.sendMessage(tid, `На твой архивный счёт зачислено ${amount} ₽.`);
    } catch {
      /* ignore */
    }
  });

  bot.command("broadcast", async (ctx) => {
    if (ctx.from.id !== adminId) return;
    const text = (ctx.message.text || "").replace(/^\/broadcast(@\w+)?\s*/, "").trim();
    if (!text) return ctx.reply("Напиши текст после команды.");
    const { all } = store;
    const users = all("SELECT telegram_id FROM users");
    let sent = 0;
    for (const u of users) {
      try {
        await bot.telegram.sendMessage(u.telegram_id, text);
        sent += 1;
      } catch {
        /* blocked */
      }
    }
    await ctx.reply(`Отправлено: ${sent}`);
  });

  bot.on("photo", async (ctx) => {
    if (ctx.from.id !== adminId) return;
    const photos = ctx.message.photo;
    const fileId = photos[photos.length - 1].file_id;
    adminState.set(ctx.from.id, { step: "name", fileId });
    await ctx.reply("Название вещи?");
  });

  bot.on("document", async (ctx) => {
    if (ctx.from.id !== adminId) return;
    const doc = ctx.message.document;
    if (!doc.mime_type || !doc.mime_type.startsWith("image/")) {
      return ctx.reply("Нужно изображение.");
    }
    adminState.set(ctx.from.id, { step: "name", fileId: doc.file_id });
    await ctx.reply("Название вещи?");
  });

  bot.on("text", async (ctx) => {
    if (ctx.from.id !== adminId) return;
    const state = adminState.get(ctx.from.id);
    if (!state) return;
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) return;

    if (state.step === "name") {
      state.name = text;
      state.step = "rarity";
      adminState.set(ctx.from.id, state);
      return ctx.reply("Редкость? 1 FOUND · 2 ARCHIVE · 3 VAULT · 4 ATELIER · 5 RELIC");
    }
    if (state.step === "rarity") {
      const rarity = Number(text);
      if (rarity < 1 || rarity > 5) return ctx.reply("Число от 1 до 5.");
      state.rarity = rarity;
      state.step = "price";
      adminState.set(ctx.from.id, state);
      return ctx.reply("Ориентир цены в ₽?");
    }
    if (state.step === "price") {
      const price = Math.max(0, Number(text.replace(/\D/g, "")) || 0);
      fs.mkdirSync(CATALOG_DIR, { recursive: true });
      const file = await bot.telegram.getFile(state.fileId);
      const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
      const ext = path.extname(file.file_path || "") || ".jpg";
      const filename = `item-${Date.now()}${ext}`;
      const dest = path.join(CATALOG_DIR, filename);
      const res = await fetch(url);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buf);
      const imagePath = `/uploads/catalog/${filename}`;
      const { run } = store;
      run(
        "INSERT INTO items (name, rarity, price, image_path, active, created_at) VALUES (?, ?, ?, ?, 1, ?)",
        [state.name, state.rarity, price, imagePath, Date.now()]
      );
      adminState.delete(ctx.from.id);
      return ctx.reply(
        `Вещь в архиве.\n${state.name}\n${RARITY_NAMES[state.rarity]}\n${price} ₽`
      );
    }
  });

  cron.schedule(
    "0 22 * * *",
    async () => {
      const { all, get } = store;
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const todayLikes = get("SELECT COUNT(*) AS c FROM collage_likes WHERE created_at >= ?", [dayAgo]).c;
      const totalLikes = get("SELECT COUNT(*) AS c FROM collage_likes").c;
      const top = get(
        `SELECT c.id, c.title, u.username, u.first_name, COUNT(l.user_id) AS likes
         FROM collages c
         JOIN users u ON u.id = c.user_id
         LEFT JOIN collage_likes l ON l.collage_id = c.id AND l.created_at >= ?
         WHERE c.published = 1
         GROUP BY c.id
         ORDER BY likes DESC
         LIMIT 1`,
        [dayAgo]
      );
      const topLine = top && top.likes
        ? `\nТоп дня: «${top.title}» — ${top.likes} · @${top.username || top.first_name}`
        : "";
      const summary = `Отчёт 22:00\nЛайков за сутки: ${todayLikes}\nВсего лайков: ${totalLikes}${topLine}`;
      try {
        await bot.telegram.sendMessage(adminId, summary);
      } catch (err) {
        console.error("admin digest failed", err.message);
      }
      const authors = all(
        `SELECT u.telegram_id, c.title, COUNT(l.user_id) AS likes
         FROM collages c
         JOIN users u ON u.id = c.user_id
         LEFT JOIN collage_likes l ON l.collage_id = c.id AND l.created_at >= ?
         GROUP BY c.id
         HAVING likes > 0`,
        [dayAgo]
      );
      for (const a of authors) {
        try {
          await bot.telegram.sendMessage(
            a.telegram_id,
            `Сегодня на коллаж «${a.title}» поставили ${a.likes} лайк(ов).`
          );
        } catch {
          /* ignore */
        }
      }
    },
    { timezone: process.env.TZ || "Europe/Moscow" }
  );

  cron.schedule("* * * * *", async () => {
    const { all, get, run } = store;
    const due = all("SELECT * FROM auctions WHERE status = 'open' AND ends_at <= ?", [Date.now()]);
    for (const a of due) {
      if (a.current_bidder_id) {
        const winner = get("SELECT * FROM users WHERE id = ?", [a.current_bidder_id]);
        const seller = get("SELECT * FROM users WHERE id = ?", [a.seller_id]);
        run("UPDATE users SET balance = balance + ? WHERE id = ?", [a.current_bid, seller.id]);
        run("UPDATE inventory SET user_id = ?, locked = 0 WHERE id = ?", [winner.id, a.inventory_id]);
        run("UPDATE auctions SET status = 'sold' WHERE id = ?", [a.id]);
        notify(winner.telegram_id, `Аукцион выигран за ${a.current_bid} ₽.`);
        notify(seller.telegram_id, `Вещь с аукциона продана за ${a.current_bid} ₽.`);
      } else {
        run("UPDATE inventory SET locked = 0 WHERE id = ?", [a.inventory_id]);
        run("UPDATE auctions SET status = 'expired' WHERE id = ?", [a.id]);
      }
    }
  });

  return { bot, isSubscribed };
}

module.exports = { createBot };
