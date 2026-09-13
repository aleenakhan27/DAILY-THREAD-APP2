const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const body = JSON.parse(event.body);
    const { subscription, reminders } = body;

    if (!subscription || !subscription.endpoint) {
      return { statusCode: 400, body: 'Missing subscription' };
    }

    const key = crypto.createHash('sha256').update(subscription.endpoint).digest('hex');
    const store = getStore({
      name: 'daily-thread-subscriptions',
      siteID: process.env.BLOBS_SITE_ID,
      token: process.env.BLOBS_TOKEN
    });

    const now = Date.now();
    const preparedReminders = (reminders || []).map((r) => {
      if (r.type === 'once') {
        let fireAt = r.fireAt;
        if (!fireAt || fireAt < now - 60000) {
          fireAt = now + 60000;
        }
        return { ...r, fireAt };
      }
      if (r.type === 'repeat') {
        return { ...r, nextFireAt: r.nextFireAt || now + r.everyMs };
      }
      return r;
    });

    await store.setJSON(key, {
      subscription,
      reminders: preparedReminders,
      updatedAt: now
    });

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
