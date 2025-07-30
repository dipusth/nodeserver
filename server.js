const express = require("express");
const fs = require("fs");
const cors = require('cors');
const { error } = require("console");
const path = require('path');
const filePath = path.join(__dirname, 'products.json');
const app = express();
const PORT = process.env.PORT || 3000;

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
  // const products = [
  //   {
  //     "id": "1",
  //     "title": "women's ring",
  //     "price": "100",
  //     "description": "New fashion shirt",
  //     "category": "Men's Clothing",
  //     "image": "https://fakestoreapi.com/img/71pWzhdJNwL._AC_UL640_QL65_ML3_.jpg"
  //   },
  //   {
  //     "id": "2",
  //     "title": "men's bracelet",
  //     "price": "500",
  //     "description": "New ring",
  //     "category": "Jewelery",
  //     "image": "https://fakestoreapi.com/img/71pWzhdJNwL._AC_UL640_QL65_ML3_.jpg"
  //   },
  //   {
  //     "id": "3",
  //     "title": "new one",
  //     "price": "50",
  //     "description": "hjhjhj",
  //     "category": "Men's Clothing",
  //     "image": "https://fakestoreapi.com/img/71pWzhdJNwL._AC_UL640_QL65_ML3_.jpg"
  //   },
  //   {
  //     "id": "8",
  //     "title": "last added product",
  //     "price": "600",
  //     "description": "dfdfdf",
  //     "category": "Men's Clothing",
  //     "image": "https://fakestoreapi.com/img/71pWzhdJNwL._AC_UL640_QL65_ML3_.jpg"
  //   },
  //   {
  //     "id": "10",
  //     "title": "ghh",
  //     "price": "600",
  //     "description": "ghgh",
  //     "category": "Men's Clothing",
  //     "image": "https://fakestoreapi.com/img/71pWzhdJNwL._AC_UL640_QL65_ML3_.jpg"
  //   },
  //   {
  //     "id": "11",
  //     "title": "ghgh",
  //     "price": "600",
  //     "description": "fghgfh",
  //     "category": "Men's Clothing",
  //     "image": "https://fakestoreapi.com/img/71pWzhdJNwL._AC_UL640_QL65_ML3_.jpg"
  //   },
  //   {
  //     "id": "12",
  //     "title": "ghgh",
  //     "price": "50",
  //     "description": "ghgh",
  //     "category": "Men's Clothing",
  //     "image": "https://fakestoreapi.com/img/71pWzhdJNwL._AC_UL640_QL65_ML3_.jpg"
  //   },
  //   {
  //     "id": "13",
  //     "title": "ghjgfhg",
  //     "price": "60",
  //     "description": "ghgfhfg",
  //     "category": "Men's Clothing",
  //     "image": "https://fakestoreapi.com/img/71pWzhdJNwL._AC_UL640_QL65_ML3_.jpg"
  //   },
  //   {
  //     "id": "14",
  //     "title": "kerrosine",
  //     "price": "56",
  //     "description": "gfgfgfgf",
  //     "category": "Jewelery",
  //     "image": "https://fakestoreapi.com/img/71pWzhdJNwL._AC_UL640_QL65_ML3_.jpg"
  //   },
  //   {
  //     "id": "15",
  //     "title": "newproduct",
  //     "price": "600",
  //     "description": "fggfdg",
  //     "category": "Men's Clothing",
  //     "image": "https://fakestoreapi.com/img/71pWzhdJNwL._AC_UL640_QL65_ML3_.jpg"
  //   }
  // ]
  res.json(products)
})

// GET single product
app.get("/products/:id", (req, res) => {
  const id = req.params.id; // keep as string to match product JSON
  const product = products.find(p => p.id === id);
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json(product);
});

// POST route to add a product
app.post('/products', (req, res) => {
  const newproduct = req.body
  console.log('newproduct', newproduct);
  if (!newproduct || !newproduct.title || !newproduct.price) {
    return res.status(400).json({ message: "Product title and price are required" });
  }
  // Generate a new ID (simple increment logic)
  const newId = (products.length + 1).toString(); // keep as string to match product JSON
  const productToAdd = {
    id: newId,
    ...newproduct
  };
  products.push(productToAdd);
 saveProductsToFile(res, () => res.status(201).json(productToAdd));
})

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