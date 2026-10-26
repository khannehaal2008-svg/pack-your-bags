const H = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const reply = (code, obj) => ({ statusCode: code, headers: H, body: JSON.stringify(obj) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, { ok: false, error: 'Method not allowed.' });

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) {}
  const key = String(body.key || '').trim();
  if (!key || key.length > 100) return reply(400, { ok: false, error: 'Enter a license key.' });

  const productId = process.env.GUMROAD_PRODUCT_ID;
  if (!productId) return reply(500, { ok: false, error: 'Server is not configured yet.' });
  const maxUses = parseInt(process.env.MAX_USES || '3', 10);

  const params = new URLSearchParams({
    product_id: productId,
    license_key: key,
    increment_uses_count: body.first ? 'true' : 'false',
  });

  let res, data = {};
  try {
    res = await fetch('https://api.gumroad.com/v2/licenses/verify', { method: 'POST', body: params });
    data = await res.json().catch(() => ({}));
  } catch (e) {
    return reply(502, { ok: false, error: 'Could not reach Gumroad. Try again.' });
  }

  if (res.status === 404 || data.success === false) {
    return reply(200, { ok: false, invalid: true, error: 'That key is not valid.' });
  }
  if (!res.ok) return reply(502, { ok: false, error: 'Gumroad is not responding. Try again.' });

  const p = data.purchase || {};
  if (p.refunded || p.chargebacked || p.disputed) {
    return reply(200, { ok: false, invalid: true, error: 'This purchase was refunded or disputed.' });
  }
  if (typeof data.uses === 'number' && data.uses > maxUses) {
    return reply(200, { ok: false, invalid: true, error: 'This key has been used on too many devices.' });
  }
  return reply(200, { ok: true });
};
