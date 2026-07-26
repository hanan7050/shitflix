const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
require('dotenv').config();

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const stringSession = new StringSession(process.env.TELEGRAM_SESSION);

(async () => {
  console.log("Connecting to Telegram to read your chats...");
  const client = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 5 });
  await client.connect();
  
  const dialogs = await client.getDialogs();
  console.log("\n--- YOUR RECENT CHATS/CHANNELS ---");
  for (let i = 0; i < Math.min(15, dialogs.length); i++) {
    const dialog = dialogs[i];
    console.log(`Name: ${dialog.title}`);
    console.log(`ID: ${dialog.id}`);
    console.log(`Is Channel/Group: ${dialog.isChannel || dialog.isGroup}`);
    console.log("-----------------------------------");
  }
  
  process.exit(0);
})();
