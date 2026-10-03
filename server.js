const express = require('express');
const cors = require('cors');

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(cors());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'pinboard' });
});

app.listen(PORT, () => {
  console.log(`Pinboard API running on http://localhost:${PORT}`);
});
