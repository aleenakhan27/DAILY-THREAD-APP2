const { schedule } = require('@netlify/functions');
const { getStore } = require('@netlify/blobs');
const webpush = require('web-push');

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:example@example.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const handler = async () => {
  const store = getStore({
    name: 'daily-thread-subscriptions',
    siteID: process.env.BLOBS_SITE_ID,
    token: process.env.BLOBS_TOKEN
  });
  const { blobs } = await store.list();
  const now = Date.now();

  for (const blob of blobs) {
    const record = await store.get(blob.key, { type: 'json' });
    if (!record) continue;

    const { subscription, reminders } = record;
    let changed = false;
    let stillValid = true;

    for (const r of reminders) {
      let due = false;

      if (r.type === 'once' && r.fireAt && now >= r.fireAt) {
        due = true;
        r.fireAt = r.fireAt + 24 * 60 * 60 * 1000;
        changed = true;
      }

      if (r.type === 'repeat' && r.nextFireAt && now >= r.nextFireAt) {
        due = true;
        r.nextFireAt = r.nextFireAt + r.everyMs;
        changed = true;
      }

      if (due) {
        try {
          await webpush.sendNotification(
            subscription,
            JSON.stringify({
              title: 'Time for: ' + r.label,
              body: r.displayTime ? 'Scheduled for ' + r.displayTime : 'Daily Thread reminder'
            })
          );
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            stillValid = false;
          }
        }
      }
    }

    if (!stillValid) {
      await store.delete(blob.key);
    } else if (changed) {
      await store.setJSON(blob.key, { subscription, reminders, updatedAt: now });
    }
  }

  return { statusCode: 200, body: 'ok' };
};

exports.handler = schedule('* * * * *', handler);
