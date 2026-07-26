const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
require('dotenv').config();

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const stringSession = new StringSession(process.env.TELEGRAM_SESSION);
const TARGET_CHANNEL = "-1001749123776";

(async () => {
  const client = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });
  await client.connect();
  
  let totalDocs = 0;
  
  for await (const msg of client.iterMessages(TARGET_CHANNEL)) {
    if (msg.media && msg.media.document) {
      totalDocs++;
    }
  }
  
  console.log('Total document messages:', totalDocs);
  process.exit(0);
})();
