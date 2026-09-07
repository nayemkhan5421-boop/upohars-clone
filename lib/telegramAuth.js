const crypto = require("crypto");

/**
 * Verifies Telegram WebApp initData signature.
 * Docs: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * Returns the parsed user object if valid, otherwise null.
 */
function verifyInitData(initData, botToken) {
  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckArr = [];
  for (const [key, value] of [...params.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    dataCheckArr.push(`${key}=${value}`);
  }
  const dataCheckString = dataCheckArr.join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (computedHash !== hash) return null;

  // Optional: reject stale initData (older than 24h)
  const authDate = Number(params.get("auth_date"));
  if (authDate && Date.now() / 1000 - authDate > 60 * 60 * 24) {
    return null;
  }

  const userRaw = params.get("user");
  const user = userRaw ? JSON.parse(userRaw) : null;
  return user;
}

module.exports = { verifyInitData };
