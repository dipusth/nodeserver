const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const app = express();

// Initialize products data (for demo - replace with database in production)
let products = require("./products.json");

// Environment configuration
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : `http://localhost:${PORT}`;

// Middleware
app.use(cors());
app.use(express.json());

// Configure Multer for Vercel (temporary storage)
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, "/tmp/uploads/"); // Vercel's temporary directory
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Serve static files from Vercel's tmp directory
app.use("/uploads", express.static("/tmp/uploads"));

// Helper function to generate image URL
const getImageUrl = (filename) => {
  return `${BASE_URL}/uploads/${filename}`;
};

// Routes
app.get("/", (req, res) => {
  res.send("Welcome to the Product API Server!");
});

// Get all products
app.get("/products", (req, res) => {
  res.json(products);
});

// Get single product
app.get("/products/:id", (req, res) => {
  const product = products.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json(product);
});

// Create new product
app.post("/products", upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Image file is required" });
    }

    const newProduct = {
      id: (products.length + 1).toString(),
      ...req.body,
      image: getImageUrl(req.file.filename),
    };

    products.push(newProduct);
    res.status(201).json(newProduct);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update product
app.put("/products/:id", upload.single("image"), (req, res) => {
  try {
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
    res.json(updatedProduct);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete product
app.delete("/products/:id", (req, res) => {
  try {
    const productIndex = products.findIndex((p) => p.id === req.params.id);
    if (productIndex === -1) {
      return res.status(404).json({ message: "Product not found" });
    }

    products.splice(productIndex, 1);
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something broke!" });
});

// Export for Vercel
module.exports = app;

// Local development server
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server running on ${BASE_URL}`);
  });
}
