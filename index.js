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
const isProduction = process.env.NODE_ENV === "production";
const isVercel =
  process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_VERCEL;
const isLocal = !process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_VERCEL;

// Dynamic paths
const getUploadDir = () => {
  if (isVercel) return "/tmp/uploads";
  // Create a local temp directory if needed
  const localPath = path.join(__dirname, "temp/uploads");
  if (isLocal && !fs.existsSync(localPath)) {
    fs.mkdirSync(localPath, { recursive: true });
  }
  return localPath;
};
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
app.use("/static-files", express.static(getFilesDir()));

// Initialize directories (local only)
if (isLocal) {
  const initDirs = [getUploadDir(), getFilesDir()];

  initDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }

    // Add sample files if directory is empty
    const dirFiles = fs.readdirSync(dir);
    if (dirFiles.length === 0) {
      const sampleFiles = {
        [getFilesDir()]: ["sample_document.txt", "example_image.jpg"],
        [getUploadDir()]: ["product_photo.jpg"],
      };

      sampleFiles[dir]?.forEach((file) => {
        const filePath = path.join(dir, file);
        if (!fs.existsSync(filePath)) {
          fs.writeFileSync(
            filePath,
            `This is a sample ${path.extname(file).replace(".", "")} file`
          );
          console.log(`Created sample file: ${filePath}`);
        }
      });
    }
  });

  // Initialize products.json if empty
  if (fs.existsSync(getProductsPath())) {
    const productsData = fs.readFileSync(getProductsPath(), "utf8");
    if (!productsData.trim()) {
      fs.writeFileSync(
        getProductsPath(),
        JSON.stringify(
          [
            {
              id: "1",
              title: "Sample Product",
              price: 9.99,
              category: "examples",
              image: "/uploads/product_photo.jpg",
            },
          ],
          null,
          2
        )
      );
    }
  }
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

// Load products with error handling
// if (!isVercel) {
//   try {
//     products = require(getProductsPath());
//   } catch (err) {
//     if (err.code === "MODULE_NOT_FOUND") {
//       console.log("No existing products file found, starting with empty array");
//       products = [];
//     } else {
//       console.error("Error loading products:", err);
//     }
//   }
// }
// For uploads and files directories (needed even on Vercel)

// Initialize directories
if (isLocal) {
  [getUploadDir(), getFilesDir()].forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      // Sample files initialization...
    }
  });
}
if (isVercel) {
  [getUploadDir(), getFilesDir()].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

// ======================
// PRODUCTS DATABASE SOLUTION (REPLACEMENT)
// ======================

let products = [];

// Initialize products
async function loadProducts() {
  try {
    products = JSON.parse(await kv.get("products")) || [];
  } catch (err) {
    console.error("KV load error:", err);
    products = [];
  }
}

// async function saveProducts() {
//   try {
//     if (isVercel) {
//       await kv.set("products", JSON.stringify(products));
//     } else {
//       fs.writeFileSync(
//         path.join(__dirname, "products.json"),
//         JSON.stringify(products, null, 2)
//       );
//     }
//   } catch (err) {
//     console.error("Error saving products:", err);
//     throw err;
//   }
// }
async function saveProducts() {
  await kv.set("products", JSON.stringify(products));
}

// Initialize on startup
await loadProducts();
// ======================
// Route Handlers
// ======================
// Add this route to verify your API is reachable
app.get("/api/test", (req, res) => {
  const testData = {
    status: "API is working",
    environment: isVercel ? "Vercel" : "Local",
    paths: {
      uploadDir: getUploadDir(),
      filesDir: getFilesDir(),
      productsPath: getProductsPath(),
    },
    directoriesExist: {
      uploadDir: fs.existsSync(getUploadDir()),
      filesDir: fs.existsSync(getFilesDir()),
    },
  };

  try {
    testData.tmpFiles = isVercel
      ? fs.readdirSync("/tmp")
      : "Not checked in local development";
  } catch (error) {
    testData.tmpError = isLocal ? error.message : "Hidden in production";
  }

  res.json(testData);
});

app.get("/api/files", async (req, res) => {
  try {
    // Ensure directory exists
    if (!fs.existsSync(getFilesDir())) {
      fs.mkdirSync(getFilesDir(), { recursive: true });
    }

    const files = fs.readdirSync(getFilesDir());
    const baseUrl = `https://${req.get("host")}`;

    res.json({
      files: files.map((file) => ({
        name: file,
        url: `${baseUrl}/uploads/${file}`,
      })),
    });
  } catch (error) {
    res.status(500).json({
      error: "File system error",
      details: process.env.NODE_ENV === "development" ? error.message : null,
    });
  }
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

// Get single product
app.get("/api/products/:id", (req, res) => {
  const product = products.find((p) => p.id === req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json(product);
});

// Get all products
// app.get("/api/products", async (req, res) => {
//   try {
//     await loadProducts(); // Refresh from KV store
//     res.json(products);
//   } catch (err) {
//     res.status(500).json({ error: "Failed to load products" });
//   }
// });

app.get("/api/products", async (req, res) => {
  await loadProducts(); // Always fetch fresh data
  res.json(products);
});

// Create / Add new product
app.post("/api/products", upload.single("image"), async (req, res) => {
  try {
    const newProduct = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Image file is required" });
    }

    const baseUrl = isVercel
      ? `https://${process.env.VERCEL_URL}`
      : `${req.protocol}://${req.get("host")}`;

    newProduct.image = `${baseUrl}/uploads/${req.file.filename}`;
    newProduct.id = Date.now().toString();

    products.push(newProduct);
    await saveProducts();
    res.status(201).json(newProduct);
  } catch (err) {
    res.status(500).json({ error: "Failed to create product" });
  }
});
// Create new product
// app.post("/api/products", upload.single("image"), (req, res) => {
//   const newProduct = req.body;
//   console.log("New product data:", newProduct);

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

// Update product
// app.put("/api/products/:id", upload.single("image"), (req, res) => {
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
app.put("/api/products/:id", upload.single("image"), async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ message: "Product ID is required" });

    const updatedProduct = req.body;
    const baseUrl = isVercel
      ? `https://${process.env.VERCEL_URL}`
      : `${req.protocol}://${req.get("host")}`;

    // Handle image update
    if (req.file) {
      updatedProduct.image = `${baseUrl}/uploads/${req.file.filename}`;
    } else if (updatedProduct.existingImage) {
      updatedProduct.image = updatedProduct.existingImage;
    }

    const index = products.findIndex((p) => p.id === id);
    if (index === -1) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Preserve the ID and merge changes
    updatedProduct.id = id;
    products[index] = { ...products[index], ...updatedProduct };

    // Save to KV (Vercel) or filesystem (local)
    await saveProducts();

    res.json(products[index]);
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({
      message: "Failed to update product",
      error: isLocal ? err.message : undefined,
    });
  }
});

// Delete product
// app.delete("/api/products/:id", (req, res) => {
//   const index = products.findIndex((p) => p.id === req.params.id);
//   if (index === -1)
//     return res.status(404).json({ message: "Product not found" });

//   products.splice(index, 1);
//   saveProductsToFile(res, () =>
//     res.json({ success: true, message: "Product deleted" })
//   );
// });
app.delete("/api/products/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const index = products.findIndex((p) => p.id === id);

    if (index === -1) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Remove the product
    const [deletedProduct] = products.splice(index, 1);

    // Persist changes
    await saveProducts();

    res.json({
      success: true,
      message: "Product deleted",
      deleted: deletedProduct,
      remainingCount: products.length,
    });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({
      message: "Failed to delete product",
      error: isLocal ? err.message : undefined,
    });
  }
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
