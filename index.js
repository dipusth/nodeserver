const express = require("express");
const fs = require("fs");
const multer = require("multer");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files (HTML, CSS, JS, images)
app.use(express.static(path.join(__dirname, "public")));
app.use("/public", express.static(path.join(__dirname, "public")));

// ======================
// Environment Configuration
// ======================
const isVercel = process.env.VERCEL === "1";
const isProduction = process.env.NODE_ENV === "production";
const isLocal = !isVercel && !isProduction;

// Dynamic paths
const getUploadDir = () =>
  isVercel ? "/tmp/uploads" : path.join(__dirname, "uploads");
const getFilesDir = () =>
  isVercel ? "/tmp/files" : path.join(__dirname, "files");
// In your index.js, modify the data persistence approach:
const getProductsPath = () => {
  if (isVercel) {
    // Use a proper database instead of filesystem
    return null;
  }
  return path.join(__dirname, "products.json");
};

// Initialize directories (local only)
if (isLocal) {
  [getUploadDir(), getFilesDir()].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

// ======================
// Middleware Setup
// ======================
app.use(cors());
app.use(express.json());

// Serve static files with proper caching
app.use(
  "/uploads",
  express.static(getUploadDir(), {
    maxAge: "1d",
    fallthrough: false,
  })
);

app.use("/files", express.static(getFilesDir()));

// ======================
// File Upload Configuration
// ======================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, getUploadDir());
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  },
});

const upload = multer({ storage });

// ======================
// Data Management
// ======================
let products = [];

// Load products with error handling
if (!isVercel) {
  try {
    products = require(getProductsPath());
  } catch (err) {
    if (err.code === "MODULE_NOT_FOUND") {
      console.log("No existing products file found, starting with empty array");
      products = [];
    } else {
      console.error("Error loading products:", err);
    }
  }
}

// ======================
// Route Handlers
// ======================
// Add this route to verify your API is reachable
app.get("/api/test", (req, res) => {
  res.json({
    status: "API is working",
    vercel: isVercel,
    files: fs.readdirSync("/tmp"), // Check what's in /tmp
  });
});

app.get("/", (req, res) => {
  res.json({
    message: "API Server Running",
    environment: isVercel ? "Vercel" : isProduction ? "Production" : "Local",
    paths: {
      uploads: getUploadDir(),
      files: getFilesDir(),
      products: getProductsPath(),
    },
  });
});

// Get all products
app.get("/api/products", (req, res) => {
  res.json(products);
});

// Get single product
app.get("/api/products/:id", (req, res) => {
  const product = products.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json(product);
});

// Create new product
app.post("/api/products", upload.single("image"), (req, res) => {
  const newProduct = req.body;
  console.log("New product data:", newProduct);

  if (!req.file) {
    return res.status(400).json({ message: "Image file is required" });
  }

  const baseUrl = isVercel
    ? `https://${process.env.VERCEL_URL}`
    : `${req.protocol}://${req.get("host")}`;

  newProduct.image = `${baseUrl}/uploads/${req.file.filename}`;

  products.push(newProduct);
  saveProductsToFile(res, () => res.status(201).json(newProduct));
});

// Update product
app.put("/api/products/:id", upload.single("image"), (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ message: "Product ID is required" });

  const updatedProduct = req.body;
  const baseUrl = isVercel
    ? `https://${process.env.VERCEL_URL}`
    : `${req.protocol}://${req.get("host")}`;

  if (req.file) {
    updatedProduct.image = `${baseUrl}/uploads/${req.file.filename}`;
  } else if (updatedProduct.existingImage) {
    updatedProduct.image = updatedProduct.existingImage;
  }

  const index = products.findIndex((p) => p.id === id);
  if (index === -1)
    return res.status(404).json({ message: "Product not found" });

  products[index] = { ...products[index], ...updatedProduct };
  saveProductsToFile(res, () => res.json(products[index]));
});

// Delete product
app.delete("/api/products/:id", (req, res) => {
  const index = products.findIndex((p) => p.id === req.params.id);
  if (index === -1)
    return res.status(404).json({ message: "Product not found" });

  products.splice(index, 1);
  saveProductsToFile(res, () =>
    res.json({ success: true, message: "Product deleted" })
  );
});

// List files
app.get("/api/files", (req, res) => {
  fs.readdir(getFilesDir(), (err, files) => {
    if (err) {
      return res.status(500).json({
        error: "Failed to read directory",
        details: isLocal ? err.message : undefined,
      });
    }

    const baseUrl = isVercel
      ? `https://${process.env.VERCEL_URL}`
      : `${req.protocol}://${req.get("host")}`;

    res.json(
      files.map((file) => ({
        name: file,
        url: `${baseUrl}/files/${file}`,
      }))
    );
  });
});

// ======================
// Helper Functions
// ======================
const saveProductsToFile = (res, successCallback) => {
  fs.writeFile(getProductsPath(), JSON.stringify(products, null, 2), (err) => {
    if (err) {
      console.error("Save error:", err);
      return res.status(500).json({
        message: "Error saving data",
        error: isLocal ? err.message : undefined,
      });
    }
    successCallback();
  });
};

// ======================
// Error Handling
// ======================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Internal server error",
    error: isLocal ? err.message : undefined,
  });
});

// ======================
// Server Initialization
// ======================
if (isLocal) {
  app.listen(PORT, () => {
    console.log(`Server running in LOCAL mode on http://localhost:${PORT}`);
    console.log(`Upload directory: ${getUploadDir()}`);
    console.log(`Files directory: ${getFilesDir()}`);
    console.log(`Products database: ${getProductsPath()}`);
  });
}

module.exports = app;
