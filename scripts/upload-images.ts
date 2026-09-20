import { v2 as cloudinary } from "cloudinary";
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const folder = path.join(process.cwd(), "assets/product-photos");

async function main() {
  const files = fs.readdirSync(folder);
  const results: Record<string, string> = {};

  for (const file of files) {
    const filePath = path.join(folder, file);
    const publicId = path.parse(file).name; // e.g. "crochet-sunflower-bouquet-main"
    const result = await cloudinary.uploader.upload(filePath, {
      folder: "girah",
      public_id: publicId,
      overwrite: true,
    });
    results[file] = result.secure_url;
    console.log(`${file} -> ${result.secure_url}`);
  }
}

main().catch(console.error);
