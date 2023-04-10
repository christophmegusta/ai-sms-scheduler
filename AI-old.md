write a node js application, which writes a sms to a phone umber which has been scheduled before in a sqlite3 database.  
this should be a CLI application. i also want to have cli commands to add new messages which should be sent scheduled. 
also the cli command shows help how to use the application.
when a message is added to schedule and containts "ai:" , everything after the "ai:" will be used as chatgpt prompt via  openai api and send as message instead, in realtime.
a .env file which contains all the environment variables will be used.

currently we have following files and contents:

chatgptClient.js:
```
require("dotenv").config();
const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const generateMessage = async (prompt, callback) => {
  try {
    const response = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: prompt,
      max_tokens: 50,
      n: 1,
      stop: null,
      temperature: 0.7,
    });

    const message = response.data.choices[0].text.trim();
    callback(null, message);
  } catch (error) {
    callback(error, null);
  }
};

module.exports = {
  generateMessage,
};
```

index.js:
```
require("dotenv").config();

const yargs = require("yargs");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const { sendSms } = require("./twilioClient");
const { generateMessage } = require("./chatgptClient");

const twilioFromNumber = process.env.TWILIO_PHONE_NUMBER;
const twilioServiceSid = process.env.TWILIO_SERVICE_SID;

const setupDb = async () => {
  const db = await open({
    filename: "sms-scheduler.db",
    driver: sqlite3.Database,
  });

  await db.exec(
    `CREATE TABLE IF NOT EXISTS scheduled_sms (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT, message TEXT, send_at INTEGER)`
  );

  return db;
};

const addScheduledMessage = async (phone, message, sendAt) => {
  const db = await setupDb();
  const result = await db.run(
    "INSERT INTO scheduled_sms (phone, message, send_at) VALUES (?, ?, ?)",
    [phone, message, sendAt]
  );
  console.log(`Scheduled message added with ID ${result.lastID} and sendAt ${sendAt}`);
};

const scheduleMessages = async () => {
  console.log("Checking for scheduled messages...");
  const db = await setupDb();
  const currentTime = Math.floor(Date.now() / 1000);
  const messages = await db.all("SELECT * FROM scheduled_sms WHERE send_at <= ?", [currentTime]);

  if (messages.length === 0) {
    console.log("No messages to send at this time.");
  } else {
    console.log(`Found ${messages.length} messages to send.`);
  }

  for (const message of messages) {
    if (message.message.startsWith("ai:")) {
      const prompt = message.message.slice(3);
      generateMessage(prompt, (err, aiMessage) => {
        if (err) {
          console.error(`Error generating AI message for ${message.phone}:`, err);
          return;
        }

        sendSms(message.phone, aiMessage, twilioFromNumber, (err, result) => {
          if (err) {
            console.error(`Error sending AI message to ${message.phone}:`, err);
          } else {
            console.log(`AI message sent to ${message.phone}`);
          }
        });
      });
    } else {
      sendSms(message.phone, message.message, twilioFromNumber, (err, result) => {
        if (err) {
          console.error(`Error sending message to ${message.phone}:`, err);
        } else {
          console.log(`Message sent to ${message.phone}`);
        }
      });
    }
    await db.run("DELETE FROM scheduled_sms WHERE id = ?", [message.id]);
  }
};

yargs
  .usage("Usage: $0 <command> [options]")
  .command("add", "Add a new scheduled SMS", {
    phone: {
      describe: "Phone number to send the SMS",
      demandOption: true,
      type: "string",
    },
    message: {
      describe: "Message to send (use 'ai:' prefix for AI-generated messages)",
      demandOption: true,
      type: "string",
    },
    sendAt: {
      describe: "Unix timestamp to send the message",
      demandOption: true,
      type: "number",
    },
  })
  .command("run", "Continuously check the schedule and send messages")
  .command("run-once", "Check the schedule and send messages once")
  .command("start-verify", "Start the phone verification process", {
    phone: {
      describe: "Phone number to verify",
      demandOption: true,
      type: "string",
    },
  })
  .command("check-verify", "Check the verification token", {
    phone: {
      describe: "Phone number to verify",
      demandOption: true,
      type: "string",
    },
    token: {
      describe: "Verification token received via SMS",
      demandOption: true,
      type: "string",
    },
  })
  .example("node $0 add --phone \"+1234567890\" --message \"Hello, World!\" --sendAt 1672448399", "Schedule an SMS")
  .example("node $0 add --phone \"+1234567890\" --message \"ai: Tell me a joke.\" --sendAt 1672448399", "Schedule an AI-generated SMS")
  .example("node $0 run", "Continuously check the schedule and send messages")
  .example("node $0 run-once", "Check the schedule and send messages once")
  .example("node $0 start-verify --phone \"+1234567890\"", "Start the phone verification process")
  .example("node $0 check-verify --phone \"+1234567890\" --token \"123456\"", "Check the verification token")
  .help()
  .alias("help", "h").argv;

const argv = yargs.argv;

if (argv._.includes("add")) {
  addScheduledMessage(argv.phone, argv.message, argv.sendAt);
}

if (argv._.includes("run")) {
  setInterval(scheduleMessages, 60 * 1000); // Check every minute
}

if (argv._.includes("run-once")) {
  scheduleMessages();
}

if (argv._.includes("start-verify")) {
  const { startPhoneVerification } = require("./twilioClient");
  startPhoneVerification(argv.phone, twilioServiceSid, (err, verification) => {
    if (err) {
      console.error("Error starting phone verification:", err);
    } else {
      console.log(`Verification token sent to ${argv.phone}`);
    }
  });
}

if (argv._.includes("check-verify")) {
  const { checkPhoneVerification } = require("./twilioClient");
  checkPhoneVerification(argv.phone, twilioServiceSid, argv.token, (err, verification_check) => {
    if (err) {
      console.error("Error checking verification token:", err);
    } else if (verification_check.status === "approved") {
      console.log("Phone number verification successful");
    } else {
      console.log("Phone number verification failed");
    }
  });
}
```

package.json:
```
{
  "name": "sms4",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "start": "node index.js"
  },
  "author": "",
  "license": "ISC",
  "dependencies": {
    "date-fns": "^2.29.3",    
    "openai": "^3.2.1",
    "sqlite": "^4.1.2",
    "sqlite3": "^5.1.6",
    "twilio": "^4.10.0",
    "yargs": "^17.7.1"
  }
}
```

twitchClient.js:
```
require("dotenv").config();

const twilio = require("twilio");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const client = new twilio(accountSid, authToken);

const sendSms = (to, body, from, callback) => {
  console.log(`Attempting to send message to ${to}`);
  client.messages
    .create({
      body: body,
      to: to,
      from: from,
    })
    .then((message) => {
      console.log(`Message sent successfully to ${to} with SID ${message.sid} and content: ${message}`);
      callback(null, message);
    })
    .catch((error) => {
      console.error(`Failed to send message to ${to}`);
      callback(error, null);
    });
};

const startPhoneVerification = (phoneNumber, serviceSid, callback) => {
  client.verify
    .services(serviceSid)
    .verifications.create({ to: phoneNumber, channel: "sms" })
    .then((verification) => callback(null, verification))
    .catch((error) => callback(error, null));
};

const checkPhoneVerification = (phoneNumber, serviceSid, token, callback) => {
  client.verify
    .services(serviceSid)
    .verificationChecks.create({ to: phoneNumber, code: token })
    .then((verification_check) => callback(null, verification_check))
    .catch((error) => callback(error, null));
};

module.exports = {
  sendSms,
  startPhoneVerification,
  checkPhoneVerification,
};

```
