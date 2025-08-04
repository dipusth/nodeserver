const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const app = express();

// ======================
// Configuration
// ======================
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : `http://localhost:${PORT}`;

// ======================
// Optional MongoDB Setup (only if environment variables exist)
// ======================
let dbClient, productsCollection;
if (process.env.DB_URL && process.env.DB_NAME) {
  const { MongoClient } = require("mongodb");
  (async () => {
    try {
      dbClient = new MongoClient(process.env.DB_URL);
      await dbClient.connect();
      productsCollection = dbClient
        .db(process.env.DB_NAME)
        .collection("products");
      console.log("Connected to MongoDB");
    } catch (err) {
      console.error("MongoDB connection failed, using JSON fallback:", err);
    }
  })();
}

// ======================
// CORS Setup
// ======================
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:5500",
  "https://yourdomain.com", // Replace with your actual domain
];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ======================
// File Upload Setup
// ======================
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "/tmp/uploads/");
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

app.use("/uploads", express.static("/tmp/uploads"));

// ======================
// Data Access Layer (Auto-selects MongoDB or JSON)
// ======================
const productsPath = path.join(__dirname, "products.json");

async function getProducts() {
  if (productsCollection) {
    try {
      return await productsCollection.find({}).toArray();
    } catch (err) {
      console.error("MongoDB fetch failed, falling back to JSON:", err);
    }
  }

  try {
    const data = await fs.readFile(productsPath, "utf8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading products.json:", err);
    return [];
  }
}

async function saveProducts(products) {
  if (productsCollection) {
    try {
      await productsCollection.deleteMany({});
      await productsCollection.insertMany(products);
      return;
    } catch (err) {
      console.error("MongoDB save failed, falling back to JSON:", err);
    }
  }

  await fs.writeFile(productsPath, JSON.stringify(products, null, 2));
}

// ======================
// API Routes (remain unchanged)
// ======================
app.get("/", (req, res) => {
  res.json({
    message: "Product API Server",
    storage: productsCollection ? "MongoDB" : "JSON file",
  });
});

app.get("/products", async (req, res) => {
  try {
    const products = await getProducts();
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// [Include all your other routes here...]

// ======================
// Error Handling
// ======================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

// ======================
// Server Export
// ======================
module.exports = app;

// Start server if not in Vercel environment
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running on ${BASE_URL}`);
    console.log(
      `Using storage: ${productsCollection ? "MongoDB" : "JSON file"}`
    );
  });
}

// Cleanup MongoDB connection on exit
process.on("SIGINT", async () => {
  if (dbClient) await dbClient.close();
  process.exit();
});
