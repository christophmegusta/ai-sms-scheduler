const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { addScheduledMessage, getScheduledMessages } = require("./smsScheduler");

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

const port = process.env.PORT || 3000;

app.get("/messages", async (req, res) => {
  const messages = await getScheduledMessages();
  res.send(messages);
});

app.post("/schedule", async (req, res) => {
  const { phone, message, sendAt } = req.body;
  await addScheduledMessage(phone, message, sendAt);
  res.status(201).send(`Scheduled message added for ${phone} at ${sendAt}`);
});

const startServer = () => {
  app.listen(port, () => {
    console.log(`SMS Scheduler web app listening at http://localhost:${port}`);
  });
};

module.exports = {
  startServer,
};
