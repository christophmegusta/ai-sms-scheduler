ls chatgptClient.js db.js index.js package.json server.js smsScheduler.js twilioClient.js public/app.js public/index.html public/style.css | xargs awk 'FNR==1{if(NR!=1){printf "```\n\n"}; printf "%s:\n```\n", FILENAME} {print}' | pbcopy
-----

write a node js application, which writes a sms to a phone umber which has been scheduled before in a sqlite3 database.  
this should be a CLI application. i also want to have cli commands to add new messages which should be sent scheduled. 
also the cli command shows help how to use the application.
when a message is added to schedule and containts "ai:" , everything after the "ai:" will be used as chatgpt prompt via  openai api and send as message instead, in realtime.
also has a feature for adding a message to schedule where sendAt can be in human readable format, "now" for this exact moment, or a unix timestamp.
also there is a web app which is started with "server" command to allow adding and showing of messages.

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

async function generateMessage(prompt) {
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
    return message;
  } catch (error) {
    throw error;
  }
}


module.exports = {
  generateMessage,
};
```

db.js:
```
const sqlite = require("sqlite");
const sqlite3 = require("sqlite3");

// get db instance
const getDb = async () => {
  const db = await sqlite.open({
    filename: "sms-scheduler.db",
    driver: sqlite3.Database,
  });

  return db;
};

const setupDb = async () => {
  const db = await getDb();

  db.exec(
    `CREATE TABLE IF NOT EXISTS scheduled_sms (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT, message TEXT, send_at 
INTEGER)`
  );

  return db;
};


module.exports = {
  setupDb,
  getDb
};
```

index.js:
```
require("dotenv").config();
const yargs = require("yargs");

const { startServer } = require("./server");
const { addScheduledMessage, scheduleMessages } = require("./smsScheduler");
const { setupDb } = require("./db");

const twilioServiceSid = process.env.TWILIO_SERVICE_SID;


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
      describe: "Unix timestamp to send the message or 'now' or in date format like 2023-12-24 12:00:00",
      demandOption: true,
      type: "string",
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
  .command("server", "Run the SMS Scheduler web app")
  .example("node $0 add --phone \"+1234567890\" --message \"Hello, World!\" --sendAt 1672448399", "Schedule an SMS")
  .example("node $0 add --phone \"+1234567890\" --message \"ai: write a friendly merry christmas message in 160 characters.\" --sendAt \"2023-12-24 12:00:00\"", "Schedule an AI-generated SMS")
  .example("node $0 add --phone \"+1234567890\" --message \"Now its starting!\" --sendAt \"now\"", "Schedule an SMS to send ASAP")
  .example("node $0 run", "Continuously check the schedule and send messages")
  .example("node $0 run-once", "Check the schedule and send messages once")
  .example("node $0 start-verify --phone \"+1234567890\"", "Start the phone verification process")
  .example("node $0 check-verify --phone \"+1234567890\" --token \"123456\"", "Check the verification token")
  .help()
  .alias("help", "h").argv;


const argv = yargs.argv;

setupDb();

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

if (argv._.includes("server")) {
  startServer();
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
    "body-parser": "^1.20.2",
    "cors": "^2.8.5",
    "date-fns": "^2.29.3",
    "express": "^4.18.2",
    "openai": "^3.2.1",
    "semantic-ui-css": "^2.5.0",
    "sqlite": "^4.1.2",
    "sqlite3": "^5.1.6",
    "twilio": "^4.10.0",
    "yargs": "^17.7.1"
  }
}
```

public/app.js:
```
const scheduleForm = document.getElementById("scheduleForm");
const messagesTable = document.getElementById("messagesTable");

scheduleForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const phone = document.querySelector("input[name='phone']").value;
    const message = document.querySelector("textarea[name='message']").value;
    const sendAt = document.querySelector("input[name='sendAt']").value;

    const sendAtDate = new Date(sendAt);
    const sendAtTimestamp = Math.floor(sendAtDate.getTime() / 1000);

    await fetch("/schedule", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone, message, sendAt: sendAtTimestamp }),
    });

    scheduleForm.reset();
    fetchScheduledMessages();
});

async function fetchScheduledMessages() {
    const messages = await fetch("/messages").then((response) => response.json());
    const tbody = messagesTable.querySelector("tbody");
    tbody.innerHTML = "";

    for (const message of messages) {
        const row = document.createElement("tr");
        const phoneCell = document.createElement("td");
        phoneCell.textContent = message.phone;
        row.appendChild(phoneCell);

        const messageCell = document.createElement("td");
        messageCell.textContent = message.message;
        row.appendChild(messageCell);

        const sendAtCell = document.createElement("td");

        // Convert the send_at value into a human-readable format
        const sendAtDate = new Date(message.send_at * 1000);
        sendAtCell.textContent = sendAtDate.toLocaleDateString() + ', ' + sendAtDate.toLocaleTimeString();
        
        row.appendChild(sendAtCell);

        tbody.appendChild(row);
    }
}

fetchScheduledMessages();
```

public/index.html:
```
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SMS Scheduler</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/2.4.1/semantic.min.css">
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="ui container">
        <h1 class="ui header">SMS Scheduler</h1>
        
        <form id="scheduleForm" class="ui form">
            <div class="field">
                <label>Phone Number</label>
                <input type="text" name="phone" placeholder="Phone Number" required>
            </div>
            <div class="field">
                <label>Message</label>
                <textarea name="message" placeholder="Message" required></textarea>
            </div>
            <div class="field">
                <label>Send At</label>
                <input type="datetime-local" name="sendAt" required>
            </div>
            <button class="ui primary button" type="submit">Schedule Message</button>
        </form>

        <h2 class="ui header">Scheduled Messages</h2>
        <table id="messagesTable" class="ui celled table">
            <thead>
                <tr>
                    <th>Phone Number</th>
                    <th>Message</th>
                    <th>Send At</th>
                </tr>
            </thead>
            <tbody>
            </tbody>
        </table>
    </div>

    <script src="app.js"></script>
</body>
</html>
```

public/style.css:
```
body {
  margin: 30px;
}
```

server.js:
```
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const { addScheduledMessage, getScheduledMessages } = require("./smsScheduler");


const port = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));


app.get("/messages", async (req, res) => {
  const messages = await getScheduledMessages();
  res.send(messages);
});

app.post("/schedule", async (req, res) => {
  const { phone, message, sendAt } = req.body;
  await addScheduledMessage(phone, message, sendAt);
  res.status(201).send(`Scheduled message added for ${phone} at ${sendAt}`);
});

function startServer() {
  app.listen(port, () => {
    console.log(`SMS Scheduler web app listening at http://localhost:${port}`);
  });
}


module.exports = {
  startServer,
};
```

smsScheduler.js:
```
require("dotenv").config();
const { parse } = require("date-fns");

const { setupDb, getDb } = require("./db");
const { sendSms } = require("./twilioClient");
const { generateMessage } = require("./chatgptClient");

const twilioFromNumber = process.env.TWILIO_PHONE_NUMBER;


function parseSendAt(sendAt) {
  if (sendAt === "now") {
    return Math.floor(Date.now() / 1000);
  }

  if (/\d{14}/.test(sendAt)) {
    return Math.floor(parseInt(sendAt, 14) / 1000);
  }

  if (/\d{10}/.test(sendAt)) {
    return parseInt(sendAt, 10);
  }

  try {
    const parsedDate = parse(sendAt, "yyyy-MM-dd HH:mm:ss", new Date());
    return Math.floor(parsedDate.getTime() / 1000);
  } catch (error) {
    console.error("Invalid sendAt input format. Please use a Unix timestamp, 'now', or 'yyyy-MM-dd HH:mm:ss' format.");
    throw error;
  }
}

async function addScheduledMessage(phone, message, sendAt) {
  const parsedSendAt = parseSendAt(sendAt);

  const db = await setupDb();

  const result = await db.run(
    "INSERT INTO scheduled_sms (phone, message, send_at) VALUES (?, ?, ?)",
    [phone, message, parsedSendAt]
  );
  console.log(`Scheduled message added with ID ${result.lastID} and sendAt ${parsedSendAt}`);
}

async function scheduleMessages() {
  const db = await setupDb();

  const messages = await getScheduledMessagesBeforeTime();
  if( messages?.length !== 0 ) console.log(`\nFound ${messages.length} messages to send.`);

  for (const message of messages) {
    try {
      let parsedMessage = message.message;
      if (message.message.startsWith("ai:")) {
        const prompt = message.message.slice(3);
        parsedMessage = await generateMessage(prompt);
      }

      await sendSms(message.phone, parsedMessage, twilioFromNumber);
      await db.run("DELETE FROM scheduled_sms WHERE id = ?", [message.id]);

    } catch (error) {
      console.error(`Error sending message ${message.id} from ${message.phone}: ${error.message}`);
    }
  }
}

async function getScheduledMessages() {
  const db = await getDb();
  const messages = await db.all("SELECT * FROM scheduled_sms");
  // convert messages sendAt to js date
  messages.forEach(message => {
    message.sendAt = new Date(message.send_at * 1000);
  });

  return messages;
}

async function getScheduledMessagesAsJSDate() {
  const messages = await getScheduledMessages();
  return messages.map( message => message.sendAt = new Date(message.send_at * 1000) );
}

async function getScheduledMessagesBeforeTime(beforeTime) {
  const currentTime = Math.floor(Date.now() / 1000);
  const time = beforeTime || currentTime;

  const db = await getDb();
  const messages = await db.all("SELECT * FROM scheduled_sms WHERE send_at <= ?", [time]);
  return messages;
}


module.exports = {
  addScheduledMessage,
  scheduleMessages,
  getScheduledMessages,
  getScheduledMessagesAsJSDate,
  getScheduledMessagesBeforeTime
};
```

twilioClient.js:
```
require("dotenv").config();
const twilio = require("twilio");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;


const client = new twilio(accountSid, authToken);

const sendSms = (to, body, from, callback) => {
  return client.messages
    .create({
      body: body,
      to: to,
      from: from,
    })
    .then((message) => {
      console.log(`Message sent successfully to ${to} with SID ${message.sid} and content: ${body}`);
      if(callback) callback(null, message);
    })
    .catch((error) => {
      console.error(`Failed to send message to ${to}`);
      if(callback) callback(error, null);
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