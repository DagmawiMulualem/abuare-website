require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

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

// ---------- Health check (optional)
app.get('/health', (_req, res) => res.send('OK'));

// ---------- POST /reservation
app.post('/reservation', async (req, res) => {
  const { name, email, date, time, tables } = req.body;
  const guestCount = tables; // expected field from frontend

  if (!name || !email || !date || !time || !guestCount) {
    console.error('❌ Missing reservation fields:', req.body);
    return res.status(400).json({ success: false, error: 'Missing fields' });
  }

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
      to: process.env.ADMIN_EMAIL || process.env.SMTP_USER,
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

    // 👇 Redirect to static success page
    return res.redirect('/reservation-success.html');

  } catch (e) {
    console.error('❌ Reservation failed:', e);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ---------- POST /contact
app.post('/contact', async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    console.error('❌ Missing contact fields:', req.body);
    return res.status(400).json({ success: false, error: 'Missing fields' });
  }

  const mailOptions = {
    from: process.env.SMTP_USER,
    to: process.env.ADMIN_EMAIL || process.env.SMTP_USER,
    subject: `New Contact Message from ${name}`,
    text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('📧 Contact message sent:', { name, email, message });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('❌ Contact email error:', err);
    return res.status(500).json({ success: false, error: 'Email failed' });
  }
});

// ---------- 404 fallback
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// ---------- Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
