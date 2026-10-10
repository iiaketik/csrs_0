const crypto = require("crypto");

function parseInitData(initData) {
  const params = new URLSearchParams(initData || "");
  const hash = params.get("hash");
  params.delete("hash");
  const dataCheck = [...params.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  let user = null;
  try {
    user = JSON.parse(params.get("user") || "null");
  } catch {
    user = null;
  }
  return { hash, dataCheck, user, startParam: params.get("start_param") };
}

function validateInitData(initData, botToken) {
  const { hash, dataCheck, user } = parseInitData(initData);
  if (!hash || !user) return null;
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hmac = crypto.createHmac("sha256", secret).update(dataCheck).digest("hex");
  if (hmac !== hash) return null;
  return user;
}

module.exports = { parseInitData, validateInitData };
