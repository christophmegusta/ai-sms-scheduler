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


app.get("/messages", async (req, res) => {
  const messages = await getScheduledMessages();
  res.send(messages);
});

app.post("/schedule", async (req, res) => {
  const { phone, message, sendAt, recurrence } = req.body;
  await addScheduledMessage(phone, message, sendAt, recurrence);
  res.status(201).send(`Scheduled message added for ${phone} at ${sendAt}`);
});

app.post("/saveScheduledMessage", async (req, res) => {
  const { id, phone, message, sendAt, recurrence } = req.body;
  await saveScheduledMessage(id, phone, message, sendAt, recurrence);
  res.status(201).send(`Scheduled message saved for ${id} ${phone} at ${sendAt}`);
});

app.post("/deleteScheduledMessage", async (req, res) => {
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
