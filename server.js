require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const { addScheduledMessage, getScheduledMessages, saveScheduledMessage, deleteScheduledMessage } = require("./smsScheduler");


const port = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));


async function isValidSignature(signature) {
  // TODO: Implement signature validation logic using solana web3 signatures
  // https://solana-labs.github.io/solana-web3.js/classes/Signature.html
  // ...
  return true;
  
}

app.get("/messages", async (req, res) => {
  if(!isValidSignature(req.headers["signature"])) {
    res.status(401).send("Invalid signature");
    return;
  }

  const messages = await getScheduledMessages();
  res.send(messages);
});

app.post("/schedule", async (req, res) => {
  if(!isValidSignature(req.headers["signature"])) {
    res.status(401).send("Invalid signature");
    return;
  }

  const { phone, message, sendAt, recurrence, sendChance, timeWindow } = req.body;
  await addScheduledMessage(phone, message, sendAt, recurrence, sendChance, timeWindow);
  res.status(201).send(`Scheduled message added for ${phone} at ${sendAt}`);
});

app.post("/saveScheduledMessage", async (req, res) => {
  if(!isValidSignature(req.headers["signature"])) {
    res.status(401).send("Invalid signature");
    return;
  }

  const { id, phone, message, sendAt, recurrence, sendChance, timeWindow } = req.body;
  await saveScheduledMessage(id, phone, message, sendAt, recurrence, sendChance, timeWindow);
  res.status(201).send(`Scheduled message saved for ${id} ${phone} at ${sendAt}`);
});

app.post("/deleteScheduledMessage", async (req, res) => {
  if(!isValidSignature(req.headers["signature"])) {
    res.status(401).send("Invalid signature");
    return;
  }

  const { id } = req.body;
  await deleteScheduledMessage(id);
  res.status(201).send(`Scheduled message deleted for ${id}`);
});


function startServer() {
  app.listen(port, () => {
    console.log(`SMS Scheduler web app listening at http://localhost:${port}`);
  });
}


module.exports = {
  startServer,
};
