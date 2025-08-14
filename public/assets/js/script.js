// click on like button
const iconLike = document.querySelector(".icon-like");
document.addEventListener("click", function (e) {
  const icon = e.target.closest(".icon-like");
  if (icon) {
    icon.classList.add("active");
  }
});
document.addEventListener("DOMContentLoaded", function () {
  // Removing active class from dropdown options except clicked one
  document.addEventListener("click", function (e) {
    let dropdownOptions = document.querySelectorAll(".dropdown-option");
    dropdownOptions.forEach((dropdown) => {
      const targetClass = e.target.closest(".dropdown-option");
      const targetContains = dropdown.contains(e.target);
      if (!targetClass || !targetContains) {
        dropdown.classList.remove("active");
      }
    });
  });
});
// Fetch products api
const productApi = "/products";
// const productApi = "https://nodeserver-puce-tau.vercel.app/products"; //vercel
// const productApi = "https://nodeserver-qidn.onrender.com/products"; // render

// Fetch api function
async function fetchApi(api, method = "GET", data = null, headers = {}) {
  try {
    // Handle FormData vs JSON
    const isFormData = data instanceof FormData;
    const body = isFormData ? data : data ? JSON.stringify(data) : undefined;
    const options = {
      method,
      headers: {
        ...(!isFormData && { "Content-Type": "application/json" }),
        ...headers,
      },
      ...(body && { body }),
    };
    const response = await fetch(api, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response;
  } catch (error) {
    console.error("Fetch Error:", error);
    throw error;
  }
}

// form submit
const submitResponse = document.querySelector(".submit-response");
let tableList = document.querySelector(".table-list");
let formSubmit = document.getElementById("productformSubmit");
let formTitle = document.getElementById("title");
let formSubmitText = formSubmit.querySelector("span");
let formHeaderTitle = document.getElementById("head-title");
let localDataRes = [];

const btnAddNew = document.querySelector("#btnAddNew");
const addNewFormModal = document.querySelector("#addNewFormModal");
const btnCloseNew = document.querySelector("#btnCloseNew");
const formArea = document.querySelector(".form-area");
const imageInput = document.querySelector("#image");

//Add New Product button click event
btnAddNew.addEventListener("click", function () {
  addNewFormModal.classList.remove("hidden");
  formArea.reset();
  formSubmitText.innerText = "Add New Product";
  formHeaderTitle.innerText = "Add New Product";
  setTimeout(() => {
    addNewFormModal.classList.add("delay");
  });
});
// Close Add New Product modal
btnCloseNew.addEventListener("click", function () {
  addNewFormModal.classList.remove("delay");
  setTimeout(() => {
    addNewFormModal.classList.add("hidden");
  }, 60);
});

// Click Action Function for dropdown menu
function actionMenu(clickedAction) {
  const dropdownOption = document.querySelectorAll(".dropdown-option");
  dropdownOption.forEach((item) => {
    if (item !== clickedAction) {
      item.classList.remove("active");
    }
  });
  clickedAction.classList.toggle("active");
}

let currentEditId = null; // tracking if editing an existing product
// Setup listener
function setupFormListener() {
  console.log("Setting up form listener...");
  if (!formArea) return;

  // First remove any existing listener
  formArea.removeEventListener("submit", handleSubmit);

  // Then add the listener
  formArea.addEventListener("submit", handleSubmit);
}

// initailize form listener
setupFormListener();
async function handleSubmit(event) {
  console.log("Submit handler triggered");
  event.preventDefault();
  event.stopPropagation(); // Stop any parent handlers
  const form = event.target;
  const formData = new FormData(form);
  const isEdit = !!currentEditId;

  // Basic validation
  const title = formData.get("title");
  const price = formData.get("price");
  const messages = formData.get("messages");
  const category = formData.get("category");
  const images = formData.get("image");

  // Fetching products first
  const productsResponse = await fetchApi(productApi);
  const allProducts = await productsResponse.json();
  let result = [];

  if (!title || !price || !messages || !category) {
    toastify("Error", "Please enter complete credentials");
    activeToast();
    return;
  }
  if (isNaN(price)) {
    toastify("Error", "Please enter valid price");
    activeToast();
    return;
  }
  if (images.size <= 0 && !form.dataset.currentImage) {
    toastify("Error", "Please upload an image");
    activeToast();
    return;
  }

  formSubmit && formSubmit.classList.add("show");

  try {
    let response;
    const apiUrl = isEdit ? `${productApi}/${currentEditId}` : productApi;
    console.log("currentEditId before:", currentEditId);
    // Handle image for edits
    if (isEdit && !formData.get("image").size && form.dataset.currentImage) {
      formData.append("existingImage", form.dataset.currentImage);
    }
    if (!isEdit) {
      console.log("if !isEdit", !isEdit);
      // Generate new ID for new products
      const productListData = await fetchApi(productApi);
      const productListDataRes = await productListData.json();
      const checkLatestId = productListDataRes.reduce(
        (acc, cur) => (Number(cur.id) > acc ? Number(cur.id) : acc),
        0
      );
      const newId = String(Number(checkLatestId) + 1);
      formData.append("id", newId);
    }
    response = await fetchApi(apiUrl, isEdit ? "PUT" : "POST", formData);
    if (!response.ok) throw new Error(response.statusText);

    result = await response.json();
    // Updating UI with the response data directly
    const updatedData = isEdit
      ? allProducts.map((item) => (item.id === result.id ? result : item))
      : [...allProducts, result];

    // Show success message
    const para = document.createElement("p");
    para.innerText = `Product ${isEdit ? "updated" : "created"} successfully`;
    para.style.color = "green";
    submitResponse.appendChild(para);

    // Refresh the product list
    tableListFunc(productApi, updatedData);
    toastify(
      isEdit ? "Product Updated" : "Product Created",
      `<span class="font-semibold">${toTitleCase(result.title)}</span> ${
        isEdit ? "updated" : "created"
      } successfully`
    );
    activeToast();
    // Reset form and close modal
    setTimeout(() => {
      form.reset();
      currentEditId = null;
      para.remove();
      addNewFormModal.classList.add("hidden");
    }, 600);
  } catch (error) {
    console.error("Error:", error);
    const para = document.createElement("p");
    para.innerText = `Error: ${error.message}`;
    para.style.color = "red";
    submitResponse.appendChild(para);
    setTimeout(() => para.remove(), 3000);
  } finally {
    formSubmit && formSubmit.classList.remove("show");
  }
}

// Create table list function
async function tableListFunc(api, newData) {
  if (!newData) {
    let fetchProduct = await fetchApi(api);
    let fetchRroductRes = await fetchProduct.json();
    localDataRes = [...fetchRroductRes];
    renderTable(localDataRes, false);
  } else {
    renderTable(newData, false);
  }
}
tableListFunc(productApi);

function renderTable(productList, sortStatus) {
  const sortedProductList = productList.sort((a, b) => b.id - a.id);
  const acendingProductList = productList.sort((a, b) => a.id - b.id);
  console.log("productList:", productList);
  console.log("acendingProductList:", acendingProductList);
  // const newProductList = sortStatus ? acendingProductList : sortedProductList;
  const tableListItem = sortedProductList
    .map((item, i) => {
      let imageUrl = "";
      if (typeof item.image === "string") {
        // Case 1: Direct URL string
        imageUrl = item.image;
      } else if (item.image?.url) {
        // Case 2: Object with url property
        imageUrl = item.image.url;
      } else if (item.image?.filename) {
        // Case 3: Construct URL from filename
        imageUrl = `/uploads/${item.image.filename}`;
      }

      // Verify we got a URL
      if (!imageUrl) {
        console.warn(`No valid image URL found for product ${item.id}`, item);
      }
      return `
      <tr>
        <td>${item.id} </td>

        <td className="truncate max-w-[200px]">${toTitleCase(item.title)}</td>
         <td><img src="${imageUrl}" alt="${item.category}" /></td>
        <td>${item.category}</td>
        <td class='truncate max-w-[350px]'>${item.messages}</td>
        <td><b>$${item.price}</b></td>
        <td>
          <div class="relative">
            <button class="dropdown-option" onClick='actionMenu(this)'>
              <i class="fa-solid fa-ellipsis-vertical"></i>
            </button>
              <ul class="dropdown-menu">
                <li><a href="#" class="list" onClick='openModal(null, ${JSON.stringify(
                  item
                ).replace(/'/g, "&apos;")})'>View</a></li>
                <li><a href="#" class="list" onClick='updateProduct(null, ${JSON.stringify(
                  item
                ).replace(/'/g, "&apos;")})'>Edit</a></li>
                <li><a href="#" class="list delete" onClick="openModal(${
                  item.id
                })">Remove</a></li>
              </ul>
          </div>

       </td>
        
        </tr>
    `;
    })
    .join("");

  tableList.innerHTML = tableListItem;
}

// Change to Ttile Case function
function toTitleCase(str) {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Dialogue box modal function
function openModal(id, item) {
  console.group("openModal called with id:", id, "item:", item);
  const wrapper = document.createElement("div");
  let dialogueWrapper = `
  <div id="dialogModal"class="modal fixed inset-0 flex items-center justify-center bg-black bg-opacity-50" >
  `;
  if (id) {
    let confirmModal = `
      <div class="bg-white p-10 rounded-lg shadow-lg w-[400px] relative border">
        <div class="text-center pb-3">
          <h4 class="text-5 font-bold text-center" id="head-title">Are you sure want to Delete?</h4>
          <div class="flex justify-between gap-4 mt-6">
            <button class="btn p-3 border-slate-400 border-2 border-solid text-slate-400" id="modal-cancel" onclick='removeItem()'><i class="fa-solid fa-ban mr-2"></i>Cancel</button>
            <button class="btn p-3 bg-red-500 text-white" id="modal-remove" onclick='removeItem(${id})'><i class="fa-regular fa-trash-can mr-2"></i>Delete</button>
          </div>
        </div>
        <button
          type="button"
          id="btnCloseModal"
          class="btn-close px-4 py-2 rounded"
          id="btn-productClose"
        >
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
    `;
    dialogueWrapper += confirmModal;
  }
  if (item) {
    let cardModal = `
        <div class="card max-w-[400px] min-w-[300px] flex flex-col p-5 rounded-lg justify-between">
          <div class="card-inner border-2 w-full item-center p-5 border-gray-300 rounded-[20px] overflow mb-4">
            <img src=${item.image} alt=${item.category} />
            <span class="absolute icon icon-circle circle-sm bg-slate-200 ml-auto icon-like">
                <svg
                  font-size="medium"
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <path
                    d="M11.2232 19.2905L11.2217 19.2892C8.62708 16.9364 6.55406 15.0515 5.11801 13.2946C3.69296 11.5512 3 10.0562 3 8.5C3 5.96348 4.97109 4 7.5 4C8.9377 4 10.3341 4.67446 11.2412 5.73128L12 6.61543L12.7588 5.73128C13.6659 4.67446 15.0623 4 16.5 4C19.0289 4 21 5.96348 21 8.5C21 10.0562 20.307 11.5512 18.882 13.2946C17.4459 15.0515 15.3729 16.9364 12.7783 19.2892L12.7768 19.2905L12 19.9977L11.2232 19.2905Z"
                    stroke="#2C2F3A"
                    stroke-width="2"
                  ></path>
                </svg>
              </span>
          </div>
          <div class="card-info">
            <h4 class="font-medium text-7">
              ${toTitleCase(item.title)}
            </h4>
            <div class='flex justify-between items-center my-2'>
            <span class="price-tag font-bold text-slate-800 text-lg">$${
              item.price
            }</span>
            <small class="block text-gray-500">${item.category}</small>
            </div>
            <button onclick='removeItem(${
              item.id
            })' class="bg-red-500 py-2 px-3 rounded-lg w-full"><i class="fa-solid fa-trash-can mr-3"></i>Delete</button>
          </div>
          <button
            type="button"
            id="btnCloseModal"
            class="btn-close px-4 py-2 rounded text-slate-500"
            id="btn-productClose"
          >
            <i class="fa-solid fa-xmark"></i>
          </button>
      </div>`;
    dialogueWrapper += cardModal;
  }
  dialogueWrapper += `</div>`;
  wrapper.innerHTML = dialogueWrapper;
  document.body.appendChild(wrapper.firstElementChild);

  let dialogModalBtn = document.getElementById("btnCloseModal");
  let dialogModal = document.getElementById("dialogModal");
  if (dialogModalBtn) {
    dialogModalBtn.addEventListener("click", function () {
      dialogModal.remove();
    });
  }
}
// Delete list after clicking remove on dialog
async function removeItem(id) {
  console.log("removeItem called with id:", id);
  const dialogModal = document.getElementById("dialogModal");
  if (!id) {
    console.log("canceled");
    dialogModal.remove();
    return;
  }
  const productApWithId = productApi + "/" + id;
  try {
    const fetchProductRes = await fetch(productApWithId, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    if (!fetchProductRes.ok) {
      throw new Error(`Failed to delete product with ID: ${id}`);
    }
    const responseData = await fetchApi(productApi);
    const responseDataRes = await responseData.json();
    // Remove item from the local list
    let localProductList = responseDataRes.filter(
      (product) => product.id !== id
    );
    // Re-render table with updated data
    tableListFunc(null, localProductList);
    dialogModal.remove();
    toastify(
      "Deleted",
      `Product with ID <span class="font-bold">${id}</span> deleted successfully`
    );
    activeToast();
  } catch (err) {
    console.error(err.message);
    alert(err.message);
  }
}

async function updateProduct(id, data) {
  console.log("updateProduct called with id:", id, "data:", data);
  currentEditId = id || (data && data.id) || null;
  let result = data;
  if (!result && id) {
    const productRes = await fetchApi(`${productApi}/${id}`);
    result = await productRes.json();
  }
  if (!result) return;
  updatingForm(result);
  // Method to Update form elemet
  function updatingForm(result) {
    let addNewFormModal = document.querySelector("#addNewFormModal");
    console.log("updatingForm called with result:", result);
    if (!result) return;
    formSubmitText.innerText = "Update";
    formHeaderTitle.innerText = "Update Form";
    addNewFormModal.classList.remove("hidden");

    // Set form values
    document.getElementsByName("title")[0].value = result.title;
    document.getElementsByName("price")[0].value = result.price;
    document.getElementById("messages").value = result.messages;

    // Set category select
    const categorySelect = document.getElementsByName("category")[0];
    if (categorySelect) {
      Array.from(categorySelect.options).forEach((option) => {
        option.selected =
          option.value.toLowerCase() === result.category.toLowerCase();
      });
    }

    // Store current image URL in a data attribute
    if (result.image) {
      formArea.dataset.currentImage = result.image;
    }
  }
}

function toastify(status, text) {
  const toastWrapper = document.querySelector(".toast-wrapper");
  let icon = `fa-check`;
  let bgColor = `bg-green-500`;
  if (status == "Deleted") {
    icon = `fa-trash-can`;
    bgColor = `bg-red-500`;
    console.log("Deleted in toastify");
  } else if (status == "Error") {
    icon = `fa-xmark`;
    bgColor = `bg-red-500`;
  }
  const toast = `
       <div class="toast">
        <div class="toast-content">
          <i class="fas fa-solid ${icon} check ${bgColor}"></i>
          <div class="message text-slate-500">
            <h4 class="${
              status == "Error" || status == "Delete" ? "text-red-500" : ""
            } text-7 font-bold">${status}</h4>
            <p>${text}</p>
          </div>
        </div>
        <i class="fa-solid fa-xmark close" onClick="closeToast()"></i>
        <div class="progress active"></div>
      </div>
    `;
  if (toastWrapper) {
    toastWrapper.innerHTML = ""; // Clear previous toasts
    toastWrapper.innerHTML += toast;
  }
}
function closeToast() {
  const toast = document.querySelector(".toast");
  const progress = document.querySelector(".progress");
  toast.classList.remove("active");
  progress.classList.remove("active");
}

function activeToast() {
  const toast = document.querySelector(".toast");
  const progress = document.querySelector(".progress");
  if (toast) {
    setTimeout(() => {
      toast.classList.add("active");
      progress.classList.add("active");
    }, 600);
    setTimeout(() => {
      toast.classList.remove("active");
    }, 5300);
    setTimeout(() => {
      progress.classList.remove("active");
    }, 5900);
  }
}

// Search function
const searchInput = document.getElementById("searchInput");
if (searchInput) {
  searchInput.addEventListener("input", debounce(searchFilter, 500));
}
function searchFilter() {
  console.log("searching...", searchInput.value);
  const filteredProducts = localDataRes.filter((item) => {
    console.log("Filtering item:", item);
    return item.title.toLowerCase().includes(searchInput.value.toLowerCase());
  });
  console.log("Filtered Products:", filteredProducts);
  tableListFunc(productApi, filteredProducts);
}
function debounce(func, delay) {
  let timeOut;
  return function (...args) {
    clearTimeout(timeOut);
    timeOut = setTimeout(() => {
      func(...args);
    }, delay);
  };
}
let sortStatus = false;
async function sortTable() {
  const responseData = await fetchApi(productApi);
  const responseDataRes = await responseData.json();
  sortStatus = !sortStatus;
  console.log("sortStatus:", sortStatus);
  console.log("responseDataRes:", responseDataRes);
  renderTable(responseDataRes, sortStatus);
}
