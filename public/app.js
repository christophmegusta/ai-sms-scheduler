$(document).ready(function () {
  const baseUrl = 'http://localhost:3000';

  const getScheduledMessages = () => {
    $.get(`${baseUrl}/scheduled-messages`, (data) => {
      const messages = data.scheduled_messages;
      $('#scheduled-messages tbody').html('');

      for (const message of messages) {
        $('#scheduled-messages tbody').append(`
          <tr>
            <td>${message.id}</td>
            <td>${message.phone}</td>
            <td>${message.message}</td>
            <td>${message.send_at}</td>
          </tr>
        `);
      }
    });
  };

  $('#schedule-form').submit(function (e) {
    e.preventDefault();

    const phone = $('#phone').val();
    const message = $('#message').val();
    const sendAt = $('#sendAt').val();

    $.post(`${baseUrl}/schedule`, { phone, message, sendAt }, ()=> {
  if (data.success) {
    alert('Message scheduled successfully!');
    getScheduledMessages();
    $('#phone').val('');
    $('#message').val('');
    $('#sendAt').val('');
  } else {
    alert(`Error: ${data.error}`);
  }
});
});

getScheduledMessages();
});
