const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
require("dotenv").config();

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const stringSession = new StringSession("");

(async () => {
  if (!apiId || !apiHash) {
    console.error("❌ ERROR: TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in your .env file!");
    process.exit(1);
  }

  console.log("Loading interactive Telegram login...");
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text("Please enter your phone number (with country code, e.g. +1234567890): "),
    password: async () => await input.text("Please enter your 2FA password (if you have one): "),
    phoneCode: async () => await input.text("Please enter the code you received on Telegram: "),
    onError: (err) => console.log(err),
  });

  console.log("✅ You should now be connected.");
  const sessionString = client.session.save();
  console.log("\n\n👇 SAVE THIS SESSION STRING 👇\n");
  console.log(sessionString);
  console.log("\n👆 ADD IT TO YOUR .env AS TELEGRAM_SESSION 👆\n\n");
  
  await client.disconnect();
})();
