const express = require("express");
const fs = require("fs");
const multer = require('multer');
const cors = require('cors');
const { error } = require("console");
const path = require('path');
const filePath = path.join(__dirname, 'products.json');
const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ dest: 'uploads/' });
app.use('/uploads', express.static('uploads')); // This allows Express to serve uploaded files via URL, like:
app.use(cors()); // This allows requests from any origin

// allowed origins if needed
// const allowedOrigins = ["https://yourfrontenddomain.com"];

// app.use(cors({
//   origin: function (origin, callback) {
//     // allow requests with no origin (like mobile apps or curl)
//     if (!origin) return callback(null, true);
//     if (allowedOrigins.includes(origin)) {
//       return callback(null, true);
//     } else {
//       return callback(new Error("Not allowed by CORS"));
//     }
//   }
// }));

app.use(express.json());

let products = require("./products.json");
 

app.get("/", (req, res) => {
  res.send("Welcome to the server!");
})

app.get('/products', (req,res) => {
  res.json(products)
})

// GET single product
app.get("/products/:id", (req, res) => {
  const id = req.params.id; // keep as string to match product JSON
  const product = products.find(p => p.id === id);
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json(product);
});


// Configure Multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Folder to save uploaded files
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});



// Create 'uploads' directory if not exists
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// POST route to add a product
// POST route to add a product
app.post('/products', upload.single("image"), (req, res) => {
  const newproduct = req.body;
  console.log('req on post', req);

  if (!req.file) {
    return res.status(400).json({ message: "Image file is required" });
  }

  // Create full URL to access the image
  // const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`; //localhost:3000/uploads/filename.ext
  const imageUrl = `https://nodeserver-qidn.onrender.com/uploads/${req.file.filename}`; // Use your actual server URL if hosted

  newproduct.image = imageUrl; // Assign image URL instead of just file path

  // Optional: Validate product
  if (!newproduct.title || !newproduct.price) {
    return res.status(400).json({ message: "Product title and price are required" });
  }

  const newId = (products.length + 1).toString();
  const productToAdd = {
    id: newId,
    ...newproduct
  };

  products.push(productToAdd);
  saveProductsToFile(res, () => res.status(201).json(productToAdd));
});


// PUT update product by id
app.put('/products/:id', (req, res) => {
  const id = req.params.id; // keep as string to match product JSON
  if (!id) return res.status(400).send('Product ID is required');
  const updatedProduct = req.body;

  const index = products.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).send('Product not found');

  products[index] = { ...products[index], ...updatedProduct };
  saveProductsToFile(res, () => res.json(products[index]));
});

// DELETE product by id
app.delete('/products/:id', (req, res) => {
  const id = req.params.id; // keep as string to match product JSON
  if (!id) return res.status(400).send('Product ID is required');
  const index = products.findIndex(p => p.id === id);
  if (index === -1) return res.status(404).send('Product not found');
  products.splice(index, 1);
  saveProductsToFile(res, () => res.status(204).send());
});

  // Save to products.json file
const saveProductsToFile = (res, successCallback) => {
  fs.writeFile(filePath, JSON.stringify(products, null, 2), (err) => {
    if (err) {
      console.error("Error saving product:", err);
      return res.status(500).json({ message: "Error saving product" });
    }
    console.log("Product saved successfully");
    if (successCallback) successCallback();
  });
};



app.get("/files", (req, res) => {
  fs.readdir("files", (err, files) => {
    if (err) {
      return res.status(500).json({ error: "Failed to read directory" });
    }
    const filesList = files.map(file => ({
      name: file,
      url: `http://localhost:${PORT}/files/${file}`
    }));
    res.json(filesList);
  });
});

app.use("/files", express.static("files"));
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})