const scheduleForm = document.getElementById("scheduleForm");
const messagesTable = document.getElementById("messagesTable");

async function fetchJSON(url) {
    const response = await fetch(url);
    return response.json();
}

async function fetchPostJSON(url, data) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    });
    return response;//.json();
}

scheduleForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const phone = document.querySelector("input[name='phone']").value;
    const message = document.querySelector("textarea[name='message']").value;
    const sendAt = document.querySelector("input[name='sendAt']").value;
    const recurrence = document.querySelector("select[name='recurrence']").value;
    const messageId = scheduleForm.dataset.messageId;
    const timeWindow = document.querySelector("input[name='timeWindow']").value;

    const sendAtDate = new Date(sendAt);
    const sendAtTimestamp = Math.floor(sendAtDate.getTime() / 1000);

    if (messageId) {
        await fetchPostJSON("/saveScheduledMessage", { id: messageId, phone, message, sendAt: sendAtTimestamp, recurrence, timeWindow });
    } else {
        await fetchPostJSON("/schedule", { phone, message, sendAt: sendAtTimestamp, recurrence, timeWindow });
    }

    delete scheduleForm.dataset.messageId;

    scheduleForm.reset();
    fetchScheduledMessages();
});

async function fetchScheduledMessages() {
    const messages = await fetchJSON("/messages");
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
        const sendAtDate = new Date(message.send_at * 1000);
        sendAtCell.textContent = sendAtDate.toLocaleDateString() + ', ' + sendAtDate.toLocaleTimeString();
        row.appendChild(sendAtCell);

        const timeWindowCell = document.createElement("td");
        timeWindowCell.textContent = message.time_window;
        row.appendChild(timeWindowCell);

        let labelColor = "grey";
        switch(message.recurrence) {
            case "once":
                labelColor = "grey";
                break;
            case "daily":
                labelColor = "olive";
                break;
            case "weekly":
                labelColor = "teal";
                break;
            case "monthly":
                labelColor = "blue";
                break;
            case "yearly":
                labelColor = "purple";
                break;
        }
        const recurrenceCell = document.createElement("td");
        recurrenceCell.innerHTML = `<label class="ui label ${labelColor}">${message.recurrence} (${message.occurrences})</label>`;
        row.appendChild(recurrenceCell);

        const actionsCell = document.createElement("td");
        const editButton = document.createElement("button");
        editButton.textContent = "Edit";
        editButton.classList.add("ui", "button", "mini");
        editButton.onclick = () => editScheduledMessage(message);
        actionsCell.appendChild(editButton);

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.classList.add("ui", "button", "mini", "negative");
        deleteButton.onclick = () => deleteScheduledMessage(message.id);
        actionsCell.appendChild(deleteButton);

        row.appendChild(actionsCell);

        tbody.appendChild(row);
    }

    newScheduledMessage();
}

function editScheduledMessage(message) {
    scheduleForm.querySelector("input[name='phone']").value = message.phone;
    scheduleForm.querySelector("textarea[name='message']").value = message.message;

    const sendAtDate = new Date(message.send_at * 1000);
    const timezoneOffset = sendAtDate.getTimezoneOffset() * 60 * 1000;
    const adjustedTimestamp = sendAtDate.getTime() - timezoneOffset;

    scheduleForm.querySelector("input[name='sendAt']").valueAsNumber = adjustedTimestamp;
    scheduleForm.querySelector("select[name='recurrence']").value = message.recurrence;
    
    scheduleForm.querySelector("input[name='timeWindow']").valueAsNumber = message.time_window;

    // Save the ID of the message being edited
    scheduleForm.dataset.messageId = message.id;
}

function newScheduledMessage() {
    scheduleForm.querySelector("input[name='phone']").value = "";
    scheduleForm.querySelector("textarea[name='message']").value = "";
    scheduleForm.querySelector("input[name='timeWindow']").valueAsNumber = 0;

    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset() * 60 * 1000; // Offset in milliseconds
    const localNow = new Date(now.getTime() - timezoneOffset);
    const formattedDate = localNow.toISOString().slice(0, 16);
    scheduleForm.querySelector("input[name='sendAt']").value = formattedDate;
}


async function deleteScheduledMessage(id) {
    await fetch("/deleteScheduledMessage", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
    });

    fetchScheduledMessages();
}

fetchScheduledMessages();
