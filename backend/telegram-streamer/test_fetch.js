const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
require('dotenv').config();

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const stringSession = new StringSession(process.env.TELEGRAM_SESSION);

(async () => {
  console.log("Connecting...");
  const client = new TelegramClient(stringSession, apiId, apiHash, { connectionRetries: 1 });
  await client.connect();
  console.log("Connected.");
  
  try {
    const channel = "-1001749123776";
    const messageId = "19579";
    console.log("Fetching message...");
    const messages = await client.getMessages(BigInt(channel), { ids: [Number(messageId)] });
    console.log("Message fetched:", messages.length > 0 ? (messages[0] ? "Found message object" : "Message is undefined") : 'not found');
    
    console.log("Testing iterDownload on message.media...");
    const iterator = client.iterDownload({
      file: messages[0].media,
      limit: 1024
    });
    for await (const chunk of iterator) {
      console.log("Chunk received, length:", chunk.length);
      break;
    }
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
})();
