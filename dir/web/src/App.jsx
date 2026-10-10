import { useEffect, useMemo, useRef, useState } from "react";
import { api, money, remain } from "./api.js";

const TABS = [
  ["drop", "Drop"],
  ["looks", "Looks"],
  ["feed", "Feed"],
  ["vault", "Vault"],
  ["trade", "Trade"],
  ["me", "Me"]
];

function Tag({ item }) {
  return <span className={`tag r${item.rarity}`}>{item.rarityLabel}</span>;
}

function Tile({ item, extra, onClick }) {
  return (
    <button className="tile" onClick={onClick} style={{ width: "100%", textAlign: "left", border: "1px solid var(--line)", padding: 0 }}>
      <img src={item.image_path} alt={item.name} />
      <div className="meta">
        <div>
          <div>{item.name}</div>
          {extra}
        </div>
        <Tag item={item} />
      </div>
    </button>
  );
}

function StageView({ collage, interactive, layers, setLayers, selected, setSelected }) {
  const ref = useRef(null);
  const drag = useRef(null);

  function pos(e) {
    const box = ref.current.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: (p.clientX - box.left) / box.width, y: (p.clientY - box.top) / box.height };
  }

  function onPointerDown(e, i, mode) {
    if (!interactive) return;
    e.preventDefault();
    setSelected(i);
    drag.current = { i, mode, start: pos(e), layer: { ...layers[i] } };
  }

  function onMove(e) {
    if (!drag.current) return;
    const { i, mode, start, layer } = drag.current;
    const now = pos(e);
    const next = [...layers];
    if (mode === "move") {
      next[i] = { ...layer, x: Math.min(1, Math.max(0, layer.x + (now.x - start.x))), y: Math.min(1, Math.max(0, layer.y + (now.y - start.y))) };
    } else if (mode === "scale") {
      next[i] = { ...layer, scale: Math.min(3, Math.max(0.3, layer.scale + (now.x - start.x) * 2)) };
    } else if (mode === "rot") {
      next[i] = { ...layer, rotation: layer.rotation + (now.x - start.x) * 180 };
    }
    setLayers(next);
  }

  function end() {
    drag.current = null;
  }

  const bg = collage?.background_path
    ? { backgroundImage: `url(${collage.background_path})` }
    : { background: "#111" };

  return (
    <div
      className={interactive ? "canvas" : "stage"}
      ref={ref}
      style={bg}
      onMouseMove={onMove}
      onMouseUp={end}
      onMouseLeave={end}
      onTouchMove={onMove}
      onTouchEnd={end}
    >
      {(layers || []).map((l, i) => (
        <div
          key={l.inventoryId + "-" + i}
          className={`layer ${selected === i ? "selected" : ""}`}
          style={{
            left: `${l.x * 100}%`,
            top: `${l.y * 100}%`,
            transform: `translate(-50%, -50%) rotate(${l.rotation}deg) scale(${l.scale})`
          }}
          onMouseDown={(e) => onPointerDown(e, i, "move")}
          onTouchStart={(e) => onPointerDown(e, i, "move")}
        >
          <img src={l.image_path} alt={l.name} />
          {interactive && selected === i && (
            <>
              <div className="handle" onMouseDown={(e) => onPointerDown(e, i, "scale")} onTouchStart={(e) => onPointerDown(e, i, "scale")} />
              <div className="handle rot" onMouseDown={(e) => onPointerDown(e, i, "rot")} onTouchStart={(e) => onPointerDown(e, i, "rot")} />
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("drop");
  const [me, setMe] = useState(null);
  const [gate, setGate] = useState(null);
  const [err, setErr] = useState("");
  const [pulled, setPulled] = useState(null);
  const [busy, setBusy] = useState(false);
  const [collection, setCollection] = useState([]);
  const [market, setMarket] = useState([]);
  const [auctions, setAuctions] = useState([]);
  const [trades, setTrades] = useState([]);
  const [collages, setCollages] = useState([]);
  const [mineCollages, setMineCollages] = useState([]);
  const [users, setUsers] = useState([]);
  const [otherInv, setOtherInv] = useState([]);
  const [otherId, setOtherId] = useState(null);
  const [editor, setEditor] = useState(null);
  const [layers, setLayers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [now, setNow] = useState(Date.now());
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(null);

  async function loadMe() {
    try {
      const data = await api("/api/me");
      setMe(data);
      setGate(null);
    } catch (e) {
      if (e.status === 403) setGate(e.payload);
      else setErr("Открой приложение из Telegram-бота.");
    }
  }

  async function refreshAll() {
    const [col, m, a, t, c, mc, u] = await Promise.all([
      api("/api/collection"),
      api("/api/market"),
      api("/api/auctions"),
      api("/api/trades"),
      api("/api/collages"),
      api("/api/collages/mine"),
      api("/api/users")
    ]);
    setCollection(col.items || []);
    setMarket(m);
    setAuctions(a);
    setTrades(t);
    setCollages(c);
    setMineCollages(mc);
    setUsers(u);
  }

  useEffect(() => {
    loadMe();
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (me) refreshAll().catch(() => {});
  }, [me, tab]);

  async function pull(paid) {
    setBusy(true);
    setErr("");
    try {
      const data = await api("/api/pull", { method: "POST", body: JSON.stringify({ paid }) });
      setPulled(data.item);
      setMe((m) => ({ ...m, balance: data.balance, nextFreeAt: data.nextFreeAt }));
    } catch (e) {
      setErr(
        e.payload?.error === "cooldown"
          ? "Ещё рано. Следующий свободный доступ позже."
          : e.payload?.error === "balance"
            ? "Не хватает 1000 ₽. Попроси админа /give"
            : e.payload?.error === "empty_catalog"
              ? "Каталог пуст — админ ещё не залил вещи."
              : "Не вышло."
      );
    } finally {
      setBusy(false);
    }
  }

  const freeReady = me && (!me.nextFreeAt || me.nextFreeAt <= now);

  async function sell(item) {
    const price = Number(prompt("Цена в ₽", String(item.price || 1000)));
    if (!price) return;
    await api("/api/market", { method: "POST", body: JSON.stringify({ inventoryId: item.inventoryId, price }) });
    refreshAll();
  }
  async function auction(item) {
    const startPrice = Number(prompt("Стартовая цена", String(item.price || 1000)));
    if (!startPrice) return;
    await api("/api/auctions", { method: "POST", body: JSON.stringify({ inventoryId: item.inventoryId, startPrice, hours: 24 }) });
    refreshAll();
  }
  async function buy(id) {
    await api(`/api/market/${id}/buy`, { method: "POST", body: "{}" });
    loadMe();
    refreshAll();
  }
  async function bid(a) {
    const amount = Number(prompt("Ставка ₽", String((a.current_bid || a.start_price) + 50)));
    if (!amount) return;
    await api(`/api/auctions/${a.id}/bid`, { method: "POST", body: JSON.stringify({ amount }) });
    refreshAll();
  }

  async function openOther(id) {
    setOtherId(id);
    const data = await api(`/api/collection/${id}`);
    setOtherInv(data.items || []);
  }

  async function offerTrade(their) {
    const mine = collection.find((x) => !x.locked);
    if (!mine) return alert("Нет свободной вещи для обмена");
    await api("/api/trades", { method: "POST", body: JSON.stringify({ fromInv: mine.inventoryId, toInv: their.inventoryId }) });
    alert("Обмен отправлен");
    refreshAll();
  }

  async function newCollage() {
    const title = prompt("Название коллажа", "look 01") || "look";
    const c = await api("/api/collages", { method: "POST", body: JSON.stringify({ title }) });
    setEditor(c);
    setLayers([]);
    setTab("looks");
  }

  async function saveCollage() {
    const saved = await api(`/api/collages/${editor.id}`, {
      method: "PUT",
      body: JSON.stringify({
        title: editor.title,
        published: true,
        layers: layers.map((l) => ({
          inventoryId: l.inventoryId,
          x: l.x,
          y: l.y,
          scale: l.scale,
          rotation: l.rotation
        }))
      })
    });
    setEditor(saved);
    refreshAll();
    alert("Коллаж сохранён");
  }

  async function upload(kind, file) {
    const fd = new FormData();
    fd.append("file", file);
    const data = await api(`/api/collages/${editor.id}/${kind}`, { method: "POST", body: fd });
    setEditor({ ...editor, ...data });
  }

  function addLayer(item) {
    setLayers((ls) => [
      ...ls,
      { inventoryId: item.inventoryId, image_path: item.image_path, name: item.name, x: 0.5, y: 0.5, scale: 1, rotation: 0 }
    ]);
  }

  function playMusic(src, id) {
    if (!audioRef.current) return;
    if (playing === id) {
      audioRef.current.pause();
      setPlaying(null);
      return;
    }
    audioRef.current.src = src;
    audioRef.current.play().catch(() => {});
    setPlaying(id);
  }

  const feed = useMemo(() => collages, [collages]);

  if (gate) {
    return (
      <div className="gate grain">
        <div className="logo">
          CATSALERS
          <small>ARCHIVE ACCESS</small>
        </div>
        <h1 className="h">Сначала подписка</h1>
        <p>Архив открывается только после подписки на {gate.channel}. Подпишись, вернись в бота и открой приложение снова.</p>
        <a className="btn" href={`https://t.me/${String(gate.channel).replace("@", "")}`}>
          Подписаться
        </a>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="gate grain">
        <div className="logo">
          CATSALERS
          <small>LOADING ARCHIVE</small>
        </div>
        <p>{err || "Сверяем доступ…"}</p>
      </div>
    );
  }

  return (
    <div className="app grain">
      <audio ref={audioRef} loop />
      <header className="top">
        <div className="logo">
          CATSALERS
          <small>BLACK ARCHIVE</small>
        </div>
        <div className="balance">
          счёт
          <div>
            <b>{money(me.balance)}</b>
          </div>
        </div>
      </header>

      {tab === "drop" && (
        <div className="page">
          <div className="h">Drop</div>
          <div className="sub">Свободный доступ раз в 2 часа. Либо 1000 ₽ — сразу.</div>
          <div className="drop-stage">
            {pulled ? (
              <>
                <img className="reveal" src={pulled.image_path} alt={pulled.name} />
                <div className="stamp">{pulled.rarityLabel}</div>
              </>
            ) : (
              <div className="scan" />
            )}
          </div>
          {pulled && (
            <div className="sub">
              {pulled.name} · {pulled.rarityLabel}
            </div>
          )}
          <div className="row">
            <button className="btn" disabled={busy || !freeReady} onClick={() => pull(false)}>
              {freeReady ? "Выбить бесплатно" : `Через ${remain(me.nextFreeAt)}`}
            </button>
            <button className="btn ghost" disabled={busy} onClick={() => pull(true)}>
              1000 ₽
            </button>
          </div>
          {err && <p className="warn">{err}</p>}
        </div>
      )}

      {tab === "vault" && (
        <div className="page">
          <div className="h">Vault</div>
          <div className="sub">Коллекция, витрина и аукцион</div>
          <div className="masonry">
            {collection.map((item) => (
              <div key={item.inventoryId}>
                <Tile item={item} extra={item.locked ? <span>занято</span> : null} />
                {!item.locked && (
                  <div className="row" style={{ padding: "0 0 12px" }}>
                    <button className="btn ghost" onClick={() => sell(item)}>
                      Продать
                    </button>
                    <button className="btn ghost" onClick={() => auction(item)}>
                      Аукцион
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="h" style={{ fontSize: 26 }}>
            Витрина
          </div>
          <div className="list">
            {market.map((x) => (
              <div className="card" key={x.id}>
                <img src={x.image_path} alt="" />
                <div>
                  {x.name}
                  <div className="sub" style={{ margin: 0 }}>
                    {money(x.price)} · @{x.username || x.first_name}
                  </div>
                </div>
                <button className="btn ghost" onClick={() => buy(x.id)}>
                  Купить
                </button>
              </div>
            ))}
          </div>
          <div className="h" style={{ fontSize: 26 }}>
            Аукцион
          </div>
          <div className="list">
            {auctions.map((x) => (
              <div className="card" key={x.id}>
                <img src={x.image_path} alt="" />
                <div>
                  {x.name}
                  <div className="sub" style={{ margin: 0 }}>
                    {money(x.current_bid)} · до {new Date(x.ends_at).toLocaleString("ru-RU")}
                  </div>
                </div>
                <button className="btn ghost" onClick={() => bid(x)}>
                  Ставка
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "trade" && (
        <div className="page">
          <div className="h">Trade</div>
          <div className="sub">Обмен вещами с другими игроками. Твоя первая свободная вещь уйдёт в предложение.</div>
          {trades.map((t) => (
            <div className="card" key={t.id}>
              <div />
              <div>
                @{t.from_username} → @{t.to_username}
              </div>
              {t.to_user === me.id && (
                <div className="row">
                  <button className="btn" onClick={() => api(`/api/trades/${t.id}/respond`, { method: "POST", body: JSON.stringify({ accept: true }) }).then(refreshAll)}>
                    Да
                  </button>
                  <button className="btn ghost" onClick={() => api(`/api/trades/${t.id}/respond`, { method: "POST", body: JSON.stringify({ accept: false }) }).then(refreshAll)}>
                    Нет
                  </button>
                </div>
              )}
            </div>
          ))}
          <div className="list">
            {users.map((u) => (
              <button key={u.id} className="card" onClick={() => openOther(u.id)}>
                <div />
                <div>
                  @{u.username || u.first_name}
                  <div className="sub" style={{ margin: 0 }}>
                    открыть коллекцию
                  </div>
                </div>
                <div />
              </button>
            ))}
          </div>
          {otherId && (
            <div className="masonry" style={{ marginTop: 12 }}>
              {otherInv.map((item) => (
                <div key={item.inventoryId}>
                  <Tile item={item} />
                  {!item.locked && (
                    <button className="btn ghost" onClick={() => offerTrade(item)}>
                      Обмен
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "looks" && (
        <div className="page editor-wrap">
          <div className="h">Looks</div>
          <div className="sub">Pinterest-сетка чужих образов и свой коллаж: перетаскивай, крути, масштабируй, фон и музыка.</div>
          <div className="row">
            <button className="btn" onClick={newCollage}>
              Новый коллаж
            </button>
            {mineCollages.map((c) => (
              <button
                key={c.id}
                className="btn ghost"
                onClick={() => {
                  setEditor(c);
                  setLayers(
                    (c.layers || []).map((l) => ({
                      inventoryId: l.inventoryId,
                      image_path: l.image_path,
                      name: l.name,
                      x: l.x,
                      y: l.y,
                      scale: l.scale,
                      rotation: l.rotation
                    }))
                  );
                }}
              >
                {c.title}
              </button>
            ))}
          </div>
          {editor && (
            <>
              <input className="field" value={editor.title} onChange={(e) => setEditor({ ...editor, title: e.target.value })} />
              <StageView collage={editor} interactive layers={layers} setLayers={setLayers} selected={selected} setSelected={setSelected} />
              <div className="row">
                <label className="btn ghost">
                  Фон
                  <input className="hidden" type="file" accept="image/*" onChange={(e) => e.target.files[0] && upload("background", e.target.files[0])} />
                </label>
                <label className="btn ghost">
                  Музыка
                  <input className="hidden" type="file" accept="audio/*" onChange={(e) => e.target.files[0] && upload("music", e.target.files[0])} />
                </label>
                <button className="btn" onClick={saveCollage}>
                  Сохранить
                </button>
              </div>
              <div className="masonry">
                {collection.map((item) => (
                  <Tile key={item.inventoryId} item={item} onClick={() => addLayer(item)} />
                ))}
              </div>
            </>
          )}
          <div className="masonry">
            {collages.map((c) => (
              <div className="tile" key={c.id}>
                <div style={{ height: 220, overflow: "hidden", position: "relative" }}>
                  <StageView collage={c} layers={c.layers} />
                </div>
                <div className="meta">
                  <div>
                    {c.title}
                    <div className="sub" style={{ margin: 0 }}>
                      @{c.author?.username || c.author?.first_name} · {c.likes} ♥
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "feed" && (
        <div className="feed">
          {feed.map((c) => (
            <section className="slide" key={c.id}>
              <StageView collage={c} layers={c.layers} />
              <div className="slide-meta">
                <h2>{c.title}</h2>
                <div>
                  @{c.author?.username || c.author?.first_name}
                </div>
              </div>
              <div className="slide-ui">
                <button
                  className="icon-btn"
                  onClick={() =>
                    api(`/api/collages/${c.id}/like`, { method: "POST", body: "{}" }).then(refreshAll)
                  }
                >
                  {c.liked ? "♥" : "♡"}
                </button>
                <button className="icon-btn" onClick={() => api(`/api/collages/${c.id}/fav`, { method: "POST", body: "{}" })}>
                  ✦
                </button>
                {c.music_path && (
                  <button className="icon-btn" onClick={() => playMusic(c.music_path, c.id)}>
                    {playing === c.id ? "❚❚" : "♪"}
                  </button>
                )}
              </div>
            </section>
          ))}
          {!feed.length && (
            <div className="page">
              <p className="warn">Пока нет опубликованных коллажей.</p>
            </div>
          )}
        </div>
      )}

      {tab === "me" && (
        <div className="page">
          <div className="h">{me.firstName || "архив"}</div>
          <div className="sub">@{me.username || me.telegramId}</div>
          <p className="warn">
            Админ заливает вещи прямо в Telegram: фото → название → редкость 1–5 → цена. Баланс: команда /give. Каждый день в 22:00 бот присылает отчёт по лайкам.
          </p>
          {me.isAdmin && <div className="tag">ADMIN</div>}
        </div>
      )}

      <nav className="nav">
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
