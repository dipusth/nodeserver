const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs").promises;
const app = express();

// Environment configuration
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : `http://localhost:${PORT}`;

// Database configuration (optional)
const USE_DB = process.env.USE_DATABASE === "true";
let dbClient;
let productsCollection;

if (USE_DB) {
  // Initialize database connection (example for MongoDB)
  const { MongoClient } = require("mongodb");
  const dbUrl = process.env.DB_URL || "mongodb://localhost:27017";
  const dbName = process.env.DB_NAME || "productDB";

  (async () => {
    try {
      dbClient = new MongoClient(dbUrl);
      await dbClient.connect();
      const db = dbClient.db(dbName);
      productsCollection = db.collection("products");
      console.log("Connected to database");
    } catch (err) {
      console.error("Database connection error:", err);
      // Fall back to JSON file
    }
  })();
}

// Path to products.json (fallback)
const productsPath = path.join(__dirname, "products.json");

// Middleware
app.use(cors());
app.use(express.json());

// Multer configuration
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
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Serve static files
app.use("/uploads", express.static("/tmp/uploads"));

// Helper functions
const getImageUrl = (filename) => `${BASE_URL}/uploads/${filename}`;

// Data access layer
const getProducts = async () => {
  if (USE_DB && productsCollection) {
    return await productsCollection.find({}).toArray();
  } else {
    try {
      const data = await fs.readFile(productsPath, "utf8");
      return JSON.parse(data);
    } catch (err) {
      console.error("Error reading products:", err);
      return [];
    }
  }
};

const saveProducts = async (productsData) => {
  if (USE_DB && productsCollection) {
    await productsCollection.deleteMany({});
    await productsCollection.insertMany(productsData);
    return true;
  } else {
    try {
      await fs.writeFile(productsPath, JSON.stringify(productsData, null, 2));
      return true;
    } catch (err) {
      console.error("Error saving products:", err);
      return false;
    }
  }
};

// Routes
app.get("/", (req, res) => {
  res.send(
    `Welcome to Product API! Using ${
      USE_DB && productsCollection ? "Database" : "JSON File"
    }`
  );
});

app.get("/products", async (req, res) => {
  try {
    const products = await getProducts();
    res.json(products);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/products/:id", async (req, res) => {
  try {
    const products = await getProducts();
    const product = products.find((p) => p.id === req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/products", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Image file is required" });
    }

    const products = await getProducts();
    const newProduct = {
      id: (products.length + 1).toString(),
      ...req.body,
      image: getImageUrl(req.file.filename),
    };

    products.push(newProduct);
    await saveProducts(products);
    res.status(201).json(newProduct);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

app.put("/products/:id", upload.single("image"), async (req, res) => {
  try {
    let products = await getProducts();
    const productIndex = products.findIndex((p) => p.id === req.params.id);
    if (productIndex === -1) {
      return res.status(404).json({ message: "Product not found" });
    }

    const updatedProduct = {
      ...products[productIndex],
      ...req.body,
    };

    if (req.file) {
      updatedProduct.image = getImageUrl(req.file.filename);
    }

    products[productIndex] = updatedProduct;
    await saveProducts(products);
    res.json(updatedProduct);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/products/:id", async (req, res) => {
  try {
    let products = await getProducts();
    const productIndex = products.findIndex((p) => p.id === req.params.id);
    if (productIndex === -1) {
      return res.status(404).json({ message: "Product not found" });
    }

    products.splice(productIndex, 1);
    await saveProducts(products);
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something broke!" });
});

// Cleanup database connection on shutdown
process.on("SIGINT", async () => {
  if (dbClient) {
    await dbClient.close();
  }
  process.exit();
});

// Export for Vercel
module.exports = app;

// Local development server
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server running on ${BASE_URL}`);
    console.log(
      `Using ${USE_DB && productsCollection ? "Database" : "JSON File"}`
    );
  });
}
