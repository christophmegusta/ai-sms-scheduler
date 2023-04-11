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
