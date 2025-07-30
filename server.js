require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 8081;


// ---------- Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple logger
app.use((req, _res, next) => {
  console.log(`📥 ${req.method} ${req.originalUrl}`);
  next();
});

// ---------- Mail transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Health check (optional)
app.get('/health', (_req, res) => res.send('OK'));

// ---------- POST /reservation
app.post('/reservation', async (req, res) => {
  const { name, email, date, time, tables, guests } = req.body;
  const guestCount = guests ?? tables; // support either field name

  if (!name || !email || !date || !time || !guestCount) {
    console.error('❌ Missing reservation fields:', req.body);
    return res.redirect('/reservation-failed.html');
  }

  // Save reservation
  try {
    const filePath = path.join(__dirname, 'reservations.json');
    const existing = fs.existsSync(filePath)
      ? JSON.parse(await fsp.readFile(filePath, 'utf-8'))
      : [];

    const newReservation = {
      name,
      email,
      date,
      time,
      guests: guestCount,
      timestamp: new Date().toISOString()
    };

    existing.push(newReservation);
    await fsp.writeFile(filePath, JSON.stringify(existing, null, 2));
    console.log('✅ Reservation saved:', newReservation);

    // Send emails
    const adminMail = {
      from: process.env.SMTP_USER,
      to: process.env.ADMIN_EMAIL,
      subject: `New Reservation from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\nDate: ${date}\nTime: ${time}\nGuests: ${guestCount}`
    };

    const userMail = {
      from: process.env.SMTP_USER,
      to: email,
      subject: 'Your Reservation Confirmation – Abuare Restaurant',
      text: `Hi ${name},\n\nThank you for reserving a table with Abuare Restaurant!\n\nDetails:\nDate: ${date}\nTime: ${time}\nGuests: ${guestCount}\n\nWe look forward to seeing you!`
    };

    await transporter.sendMail(adminMail);
    await transporter.sendMail(userMail);
    console.log('📧 Reservation emails sent!');

    // ---------- Show confirmation page (instead of redirecting)
    return res.send(`
      <!doctype html>
      <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Reservation Confirmed</title>
      </head>
      <body style="background: #f7efe9; margin: 0; padding: 0;">
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 30px; background-color: #fff8f0; border: 2px solid #b4442f; border-radius: 12px; text-align: center;">
          <h1 style="color: #b4442f;">🍷 Thank you, ${escapeHtml(name)}!</h1>
          <p style="font-size: 1.1em; color: #333;">
            Your reservation for <strong>${escapeHtml(guestCount)}</strong> guest(s) on <strong>${escapeHtml(date)}</strong> at <strong>${escapeHtml(time)}</strong> has been received.
          </p>
          <p style="margin-top: 15px; color: #555;">
            We’ve sent a confirmation email to: <strong>${escapeHtml(email)}</strong>
          </p>
          <a href="/" style="display: inline-block; margin-top: 25px; padding: 10px 20px; background-color: #b4442f; color: #fff; text-decoration: none; border-radius: 5px; font-weight: bold;">
            ⬅️ Back to Home
          </a>
        </div>
      </body>
      </html>
    `);
  } catch (e) {
    console.error('❌ Reservation flow failed:', e);
    return res.redirect('/reservation-failed.html');
  }
});

// ---------- POST /contact
app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    console.error('❌ Missing contact fields:', req.body);
    return res.redirect('/contact-failed.html');
  }

  const mailOptions = {
    from: process.env.SMTP_USER,
    to: process.env.ADMIN_EMAIL,
    subject: `New Contact Message from ${name}`,
    text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('📧 Contact message sent:', { name, email, message });
    return res.redirect('/contact-success.html');
  } catch (err) {
    console.error('❌ Contact email error:', err);
    return res.redirect('/contact-failed.html');
  }
});

// ---------- 404
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// ---------- Start
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

// ---------- tiny helper to avoid simple HTML injection in the confirmation page
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
