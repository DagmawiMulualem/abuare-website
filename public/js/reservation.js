document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('reservationForm');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;
    const tables = parseInt(document.getElementById('tables').value);

    try {
      const response = await fetch('https://abuare-backend.onrender.com/reservation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email, date, time, tables })
      });

      if (response.ok) {
        window.location.href = 'reservation-success.html';
      } else {
        window.location.href = 'reservation-failed.html';
      }
    } catch (err) {
      console.error('Fetch error:', err);
      window.location.href = 'reservation-failed.html';
    }
  });
});
