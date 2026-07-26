const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
require('dotenv').config();
const { runSync } = require('./sync.js');

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const stringSession = new StringSession(process.env.TELEGRAM_SESSION);

(async () => {
  const client = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });
  await client.start({
    phoneNumber: async () => process.env.TELEGRAM_PHONE,
    password: async () => '',
    phoneCode: async () => '',
    onError: (err) => console.log(err),
  });
  console.log("Connected to Telegram");
  await runSync(client);
  console.log("Done");
  process.exit(0);
})();
