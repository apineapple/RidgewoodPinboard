const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const { v2: cloudinary } = require("cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
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
