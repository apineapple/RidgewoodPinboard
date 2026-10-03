const express = require('express');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });

const app = express();
const PORT = Number(process.env.PORT || 3001);
const DEFAULT_TO = 'obiwonton123@gmail.com';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: String(process.env.SMTP_SECURE || 'false') === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

app.post('/api/send-email', async (req, res) => {
  const { recipient = DEFAULT_TO, fileName = 'uploaded file', action = 'upload-confirmed' } = req.body || {};

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return res.status(500).json({
      ok: false,
      error: 'SMTP credentials are not configured. Add SMTP_USER and SMTP_PASS to server/.env',
    });
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: recipient,
      subject: `Pinboard upload: ${fileName}`,
      text: [
        'A new image upload was confirmed in the pinboard app.',
        '',
        `File: ${fileName}`,
        `Action: ${action}`,
        '',
        'This email was sent from the backend SMTP transport.',
      ].join('\n'),
    });

    console.log('Upload email sent:', info.messageId);
    return res.json({
      ok: true,
      recipient,
      fileName,
      action,
      messageId: info.messageId,
    });
  } catch (error) {
    console.error('Email send failed:', error);
    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'pinboard-email' });
});

app.listen(PORT, () => {
  console.log(`Email API running on http://localhost:${PORT}`);
});
