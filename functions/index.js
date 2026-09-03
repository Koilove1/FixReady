const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

const STATUS_LABEL = {
  clean: 'Operational',
  dirty: 'Needs Repair',
  out_of_order: 'Out of Service',
};

exports.notifyOnRoomStatusChange = onDocumentUpdated('rooms/{roomId}', async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (before.status === after.status) return;

  const db = getFirestore();
  const tokensSnap = await db.collection('deviceTokens').get();
  const tokens = tokensSnap.docs.map((d) => d.id);
  if (tokens.length === 0) return;

  const who = after.updatedBy ? ` by ${after.updatedBy}` : '';
  const message = {
    notification: {
      title: `Room ${after.name} — ${STATUS_LABEL[after.status] ?? after.status}`,
      body: `Changed from ${STATUS_LABEL[before.status] ?? before.status}${who}.`,
    },
    tokens,
  };

  const response = await getMessaging().sendEachForMulticast(message);

  // Prune tokens that are no longer valid so the list doesn't grow stale.
  const stale = [];
  response.responses.forEach((r, i) => {
    const code = r.error?.code;
    if (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token'
    ) {
      stale.push(tokens[i]);
    }
  });
  await Promise.all(stale.map((t) => db.collection('deviceTokens').doc(t).delete()));
});
