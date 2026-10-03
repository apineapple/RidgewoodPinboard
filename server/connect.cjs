const fs = require("fs");
const path = require("path");
const express = require("express");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const { v2: cloudinary } = require("cloudinary");

const app = express();
app.use(express.json());

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.post('/api/send-email', (req, res) => {
  const { to, subject, message, fileName } = req.body || {};
  // For now this is an in-app email stub that records the request instead of opening the user's mail app.
  console.log('Email send request:', { to, subject, fileName, message });
  res.json({ ok: true, to, subject, fileName, message });
});

async function main() {
  const result = await cloudinary.api.resources({
    max_results: 500,
  });

  const imageurls = (result.resources || []).map(
    (r) => r.secure_url || cloudinary.url(r.public_id, { secure: true })
  );

  fs.writeFileSync(
    path.join(__dirname, "..", "src", "imageurls.json"),
    JSON.stringify(imageurls.map((i) => i.replace("upload/","upload/w_800/")), null, 2)
  );

  console.log(`Saved ${imageurls.length} image URLs.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
