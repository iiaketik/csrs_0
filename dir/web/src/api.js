const tg = window.Telegram?.WebApp;

export function initTelegram() {
  if (!tg) return;
  tg.ready();
  tg.expand();
  try {
    tg.setHeaderColor("#070707");
    tg.setBackgroundColor("#070707");
  } catch {
    /* old clients */
  }
}

export async function api(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (tg?.initData) headers["x-telegram-init-data"] = tg.initData;
  if (opts.body && !(opts.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "error");
    err.payload = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

export function money(n) {
  return `${Number(n || 0).toLocaleString("ru-RU")} ₽`;
}

export function remain(ts) {
  const ms = Math.max(0, ts - Date.now());
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}ч ${String(m).padStart(2, "0")}м`;
}
