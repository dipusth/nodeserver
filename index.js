const express = require("express");
const fs = require("fs");
const multer = require("multer");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files (HTML, CSS, JS, images)
app.use(express.static(path.join(__dirname, "public")));

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
const getProductsPath = () =>
  isVercel ? "/tmp/products.json" : path.join(__dirname, "products.json");

// Helper function to read/write products
const getProducts = () =>
  JSON.parse(fs.readFileSync(path.join(__dirname, "products.json"), "utf8"));

console.log("getProducts:", getProducts());
const saveProducts = (products) =>
  fs.writeFileSync(
    path.join(__dirname, "products.json"),
    JSON.stringify(products, null, 2)
  );
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

// ======================
// Route Handlers
// ======================
// app.get("/", (req, res) => {
//   res.json({
//     message: "API Server Running",
//     environment: isVercel ? "Vercel" : isProduction ? "Production" : "Local",
//     paths: {
//       uploads: getUploadDir(),
//       files: getFilesDir(),
//       products: getProductsPath(),
//     },
//   });
// });

// Get all products
app.get("/products", (req, res) => {
  try {
    res.json(getProducts());
  } catch (err) {
    res.status(500).json({ error: "Failed to load products" });
  }
});

// Get single product
app.get("/products/:id", (req, res) => {
  const product = products.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json(product);
});

// Create new product
// app.post("/products", upload.single("image"), (req, res) => {
//   const newProduct = req.body;

//   if (!req.file) {
//     return res.status(400).json({ message: "Image file is required" });
//   }

//   const baseUrl = isVercel
//     ? `https://${process.env.VERCEL_URL}`
//     : `${req.protocol}://${req.get("host")}`;

//   newProduct.image = `${baseUrl}/uploads/${req.file.filename}`;

//   products.push(newProduct);
//   saveProductsToFile(res, () => res.status(201).json(newProduct));
// });
app.post("/products", upload.single("image"), (req, res) => {
  try {
    const newProduct = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Image file is required" });
    }

    // Generate a unique ID
    newProduct.id = Date.now().toString();

    const baseUrl = isVercel
      ? `https://${process.env.VERCEL_URL}`
      : `${req.protocol}://${req.get("host")}`;

    newProduct.image = `${baseUrl}/uploads/${req.file.filename}`;

    // Check for duplicate ID
    const products = getProducts();
    if (products.some((p) => String(p.id) === String(newProduct.id))) {
      return res.status(400).json({ message: "Generated ID already exists" });
    }

    products.push(newProduct);
    saveProducts(products);
    res.status(201).json(newProduct);
  } catch (err) {
    res.status(500).json({ error: "Failed to create product" });
  }
});

// Update product
// app.put("/products/:id", upload.single("image"), (req, res) => {
//   const id = req.params.id;
//   if (!id) return res.status(400).json({ message: "Product ID is required" });

//   const updatedProduct = req.body;
//   const baseUrl = isVercel
//     ? `https://${process.env.VERCEL_URL}`
//     : `${req.protocol}://${req.get("host")}`;

//   if (req.file) {
//     updatedProduct.image = `${baseUrl}/uploads/${req.file.filename}`;
//   } else if (updatedProduct.existingImage) {
//     updatedProduct.image = updatedProduct.existingImage;
//   }

//   const index = products.findIndex((p) => p.id === id);
//   if (index === -1)
//     return res.status(404).json({ message: "Product not found" });

//   products[index] = { ...products[index], ...updatedProduct };
//   saveProductsToFile(res, () => res.json(products[index]));
// });

app.put("/products/:id", upload.single("image"), async (req, res) => {
  try {
    const id = req.params.id;
    console.log("Updating product ID:", id); // Debug log

    if (!id) return res.status(400).json({ message: "Product ID required" });

    const products = getProducts();
    const productIndex = products.findIndex((p) => String(p.id) === String(id));

    if (productIndex === -1) {
      return res.status(404).json({ message: "Product not found" });
    }

    const updatedData = req.body;
    console.log("Update payload:", updatedData); // Debug log

    // Handle image upload
    let imageUrl = products[productIndex].image; // Keep existing image if no new upload
    if (req.file) {
      const baseUrl = process.env.VERCEL
        ? `https://${process.env.VERCEL_URL}`
        : `${req.protocol}://${req.get("host")}`;
      imageUrl = `${baseUrl}/uploads/${req.file.filename}`;
      console.log("New image URL:", imageUrl); // Debug log
    }

    // Merge changes
    const updatedProduct = {
      ...products[productIndex],
      ...updatedData,
      image: imageUrl,
      id: products[productIndex].id, // Preserve original ID
    };

    products[productIndex] = updatedProduct;
    await fs.promises.writeFile(
      getProductsPath(),
      JSON.stringify(products, null, 2)
    );

    res.json(updatedProduct);
  } catch (err) {
    console.error("PUT Error:", err); // Critical for debugging
    res.status(500).json({
      error: "Update failed",
      details: process.env.NODE_ENV === "development" ? err.message : null,
    });
  }
});

// Delete product
app.delete("/products/:id", (req, res) => {
  const index = products.findIndex((p) => p.id === req.params.id);
  if (index === -1)
    return res.status(404).json({ message: "Product not found" });

  products.splice(index, 1);
  saveProductsToFile(res, () =>
    res.json({ success: true, message: "Product deleted" })
  );
});

// List files
app.get("/files", (req, res) => {
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
