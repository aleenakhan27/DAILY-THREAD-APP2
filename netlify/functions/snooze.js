const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  try {
    const { endpoint, reminderId } = JSON.parse(event.body);
    if (!endpoint || !reminderId) {
      return { statusCode: 400, body: 'Missing endpoint or reminderId' };
    }

    const key = crypto.createHash('sha256').update(endpoint).digest('hex');
    const store = getStore({
      name: 'daily-thread-subscriptions',
      siteID: process.env.BLOBS_SITE_ID,
      token: process.env.BLOBS_TOKEN
    });

    const record = await store.get(key, { type: 'json' });
    if (!record) {
      return { statusCode: 404, body: 'Not found' };
    }

    const SNOOZE_MS = 10 * 60 * 1000;
    record.reminders = record.reminders.map((r) => {
      if (r.id !== reminderId) return r;
      if (r.type === 'once') return { ...r, fireAt: Date.now() + SNOOZE_MS };
      if (r.type === 'repeat') return { ...r, nextFireAt: Date.now() + SNOOZE_MS };
      return r;
    });

    await store.setJSON(key, record);

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
