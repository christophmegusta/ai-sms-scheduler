require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { SIWS } = require('@web3auth/sign-in-with-solana');
const jwt = require('jsonwebtoken');

const { addScheduledMessage, getScheduledMessages, saveScheduledMessage, deleteScheduledMessage } = require("./smsScheduler");

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

const port = process.env.PORT || 3000;

const users = {};

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        console.log("jwt verification failed", err);
        return res.sendStatus(403);
      }

      req.user = user;
      console.log("allowed user", user);
      next();
    });
  } else {
    console.log("denied user");
    res.sendStatus(401);
  }
}


app.post('/verifySolana', async (req, res) => {
  try {
    const { header, payload, signature } = req.body;

    const msg = new SIWS({ header, payload });
    const resp = await msg.verify({ payload, signature });

    if (resp.success) {
      const publicKey = payload.address;

      // Check if the user exists, if not, create a new user
      if (!users[publicKey]) {
        users[publicKey] = { publicKey };
      }

      // Generate a JWT for the user
      const token = jwt.sign({ publicKey }, JWT_SECRET, { expiresIn: '1h' });

      res.json({ status: 'success', message: 'Verified', token });
    } else {
      res.status(400).json({ status: 'error', message: 'Verification failed' });
    }
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.get("/messages", verifyToken, async (req, res) => {
  const messages = await getScheduledMessages();
  res.send(messages);
});

app.post("/schedule", verifyToken, async (req, res) => {
  const { phone, message, sendAt, recurrence, sendChance, timeWindow } = req.body;
  await addScheduledMessage(phone, message, sendAt, recurrence, sendChance, timeWindow);
  res.status(201).send(`Scheduled message added for ${phone} at ${sendAt}`);
});

app.post("/saveScheduledMessage", verifyToken, async (req, res) => {
  const { id, phone, message, sendAt, recurrence, sendChance, timeWindow } = req.body;
  await saveScheduledMessage(id, phone, message, sendAt, recurrence, sendChance, timeWindow);
  res.status(201).send(`Scheduled message saved for ${id} ${phone} at ${sendAt}`);
});

app.post("/deleteScheduledMessage", verifyToken, async (req, res) => {
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
