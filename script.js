"use strict";

// URL Web App Apps Script dan nomor WhatsApp admin.
const GOOGLE_SHEETS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbxxUZN8DblNJvlb2PJyNM5m43JO8um9D21sDKRSneW92ATdSI9NPjSsJ04Lz8hosEWAyg/exec";
const WHATSAPP_NUMBER = "6289658184085";

const products = [
  {
    id: "stup", name: "Stup Roti Lumer", category: "Stup Roti",
    description: "Roti lembut dengan rasa manis dan creamy yang lumer di mulut.",
    image: "img/stup.jpeg", fallback: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=1000",
    variants: [
      { sku: "stup-original", name: "Original", image: "img/stup-ori.jpeg", price: 10000 },
      { sku: "stup-oreo", name: "Oreo", image: "img/stup-oreo.jpeg", price: 12000 },
      { sku: "stup-matcha", name: "Matcha", image: "img/stup-matcha.jpeg", price: 12000 },
      { sku: "stup-keju", name: "Keju Parut", image: "img/stup-keju.jpeg", price: 12000 },
      { sku: "stup-marie", name: "Marie Regal", image: "img/stup-marie.jpeg", price: 12000 }
    ]
  },
  {
    id: "roasted", name: "Roasted Milk Tea", category: "Milk Tea",
    description: "Milk tea creamy dengan pilihan topping favorit yang bikin nagih.",
    image: "img/rmt.jpeg", fallback: "https://images.unsplash.com/photo-1541658016709-82535e94bc69?w=1000",
    variants: [
      { sku: "rmt-original", name: "Original", image: "img/rmt-ori.jpeg", price: 8000 },
      { sku: "rmt-cincau", name: "Cincau", image: "img/rmt-cincau.jpeg", price: 10000 },
      { sku: "rmt-ndc", name: "Nata de Coco", image: "img/rmt-ndc.jpeg", price: 10000 }
    ]
  }
];

const $ = (selector) => document.querySelector(selector);
const money = (amount) => "Rp " + Number(amount || 0).toLocaleString("id-ID");
const cart = [];
let preorder = null;
let preorderReady = false;
let preorderLoading = false;
let preorderErrorMessage = "";
let selectedProduct = null;
let notificationTimer = null;
let scrollRevealObserver = null;

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

function showNotification(message) {
  const box = $("#notification");
  box.textContent = message;
  box.classList.add("show");
  window.clearTimeout(notificationTimer);
  notificationTimer = window.setTimeout(() => box.classList.remove("show"), 2800);
}

function productIsOpen(product) {
  return Boolean(preorderReady && preorder && preorder[product.id] === true);
}

function updatePreorderBanner() {
  const banner = $("#preorder-banner");
  const title = $("#preorder-title");
  const description = $("#preorder-description");
  banner.classList.remove("open", "closed", "checking", "error");
  if (!preorderReady) {
    banner.classList.add(preorderLoading ? "checking" : "error");
    title.textContent = preorderLoading ? "Memeriksa jadwal preorder" : "Status preorder belum tersedia";
    description.textContent = preorderLoading ? "Mohon tunggu sebentar." :
      (preorderErrorMessage || "Periksa URL dan deployment Web App Apps Script, lalu tekan tombol perbarui.");
    return;
  }
  const anyOpen = products.some(productIsOpen);
  banner.classList.add(anyOpen ? "open" : "closed");
  title.textContent = anyOpen ? "Preorder sedang dibuka" : "Preorder sedang ditutup";
  description.textContent = anyOpen
    ? "Pilih salah satu menu yang tersedia untuk mulai memesan."
    : "Ikuti kabar terbaru kami untuk mengetahui jadwal preorder berikutnya.";
}

function loadPreorder() {
  if (preorderLoading) return;
  preorderLoading = true;
  updatePreorderBanner();
  const finish = (data) => {
    preorderLoading = false;
    if (data && data.ok === true && data.preorder) {
      const isEnabled = (value) => value === true || value === 1 ||
        ["true", "1", "ya", "buka", "open"].includes(String(value || "").trim().toLowerCase());
      preorder = { stup: isEnabled(data.preorder.stup), roasted: isEnabled(data.preorder.roasted) };
      preorderReady = true;
      preorderErrorMessage = "";
    } else {
      preorderReady = false;
      preorderErrorMessage = data && data.message
        ? String(data.message)
        : "Apps Script tidak merespons. Periksa URL /exec dan akses Web App harus disetel ke Anyone.";
    }
    updatePreorderBanner();
    renderProducts($("#menu-search").value);
  };
  const host = location.hostname;
  const isNetlify = host.endsWith("netlify.app");
  const isNetlifyDev = ["localhost", "127.0.0.1"].includes(host) && location.port === "8888";

  if (isNetlify || isNetlifyDev) {
    fetch("/.netlify/functions/preorder", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data && data.message ? data.message : "Netlify Function HTTP " + response.status);
        }
        return data;
      })
      .then(finish)
      .catch((error) => finish({
        ok: false,
        message: "Netlify Function gagal: " + (error && error.message ? error.message : "periksa deployment fungsi.")
      }));
    return;
  }

  // Live Server uses Apps Script JSONP directly. Netlify production uses the proxy above.
  loadPreorderJsonp(finish);
}

function loadPreorderJsonp(finish) {
  const callbackName = "meletupPreorderCallback" + Date.now() + Math.floor(Math.random() * 10000);
  const script = document.createElement("script");
  let finished = false;
  let timeoutId = null;
  const complete = (data) => {
    if (finished) return;
    finished = true;
    window.clearTimeout(timeoutId);
    script.remove();
    delete window[callbackName];
    finish(data);
  };
  window[callbackName] = complete;
  script.onerror = () => complete(null);
  script.onload = () => window.setTimeout(() => {
    if (!finished) complete({ ok: false, message: "Web App merespons tanpa callback preorder. Perbarui deployment Apps Script." });
  }, 0);
  script.src = GOOGLE_SHEETS_WEB_APP_URL + "?action=preorder&callback=" + callbackName + "&t=" + Date.now();
  timeoutId = window.setTimeout(() => complete(null), 12000);
  document.head.appendChild(script);
}

function renderProducts(searchText) {
  const grid = $("#product-grid");
  const query = String(searchText || "").trim().toLocaleLowerCase("id-ID");
  const visible = products.filter((product) => {
    const haystack = [product.name, product.category, product.description,
      ...product.variants.map((variant) => variant.name)].join(" ").toLocaleLowerCase("id-ID");
    return haystack.includes(query);
  });
  if (scrollRevealObserver) {
    grid.querySelectorAll(".reveal-on-scroll").forEach((element) => scrollRevealObserver.unobserve(element));
  }
  grid.innerHTML = "";
  $("#no-result").classList.toggle("show", visible.length === 0);
  $("#search-result-info").textContent = query ? visible.length + " menu ditemukan" : "";

  visible.forEach((product) => {
    const open = productIsOpen(product);
    const statusText = !preorderReady ? "Memeriksa preorder..." : (open ? "Preorder dibuka" : "Preorder ditutup");
    const statusClass = !preorderReady ? "checking" : (open ? "open" : "closed");
    const minPrice = Math.min(...product.variants.map((variant) => variant.price));
    const card = document.createElement("article");
    card.className = "product-card";
    card.innerHTML = '<div class="product-image-wrapper"><img class="product-image" src="' + escapeHtml(product.image) +
      '" data-fallback="' + escapeHtml(product.fallback) + '" alt="' + escapeHtml(product.name) + '" loading="lazy">' +
      '<span class="product-badge">' + escapeHtml(product.category) + '</span></div><div class="product-info">' +
      '<span class="product-category">' + escapeHtml(product.category) + '</span><h3>' + escapeHtml(product.name) + '</h3>' +
      '<p class="product-description">' + escapeHtml(product.description) + '</p>' +
      '<div class="preorder-status ' + statusClass + '"><span class="status-dot" aria-hidden="true"></span><span>' + statusText + '</span></div>' +
      '<div class="product-bottom"><div class="product-price">Mulai ' + money(minPrice) + '<small>' + product.variants.length + ' pilihan varian</small></div>' +
      '<button class="add-to-cart" type="button" ' + (!preorderReady || !open ? "disabled" : "") + '>' +
      (!preorderReady ? "Memeriksa..." : (open ? 'Pilih <i class="fa-solid fa-plus" aria-hidden="true"></i>' : "Ditutup")) +
      '</button></div></div>';
    const image = card.querySelector(".product-image");
    image.addEventListener("error", useImageFallback, { once: true });
    card.querySelector(".add-to-cart").addEventListener("click", () => {
      if (!productIsOpen(product)) { loadPreorder(); showNotification("Preorder untuk menu ini sedang ditutup."); return; }
      openToppingModal(product.id);
    });
    grid.appendChild(card);
    revealOnScroll(card, visible.indexOf(product));
  });
}

function useImageFallback(event) {
  const image = event.currentTarget;
  const fallback = image.getAttribute("data-fallback");
  if (fallback && image.src !== fallback) { image.src = fallback; image.removeAttribute("data-fallback"); }
}

function openToppingModal(productId) {
  selectedProduct = products.find((product) => product.id === productId);
  if (!selectedProduct || !productIsOpen(selectedProduct)) return;
  $("#topping-modal-title").textContent = selectedProduct.name;
  $("#topping-base-price").textContent = "Pilih varian dan jumlah yang ingin dipesan.";
  const options = $("#topping-options");
  options.innerHTML = "";
  selectedProduct.variants.forEach((variant) => {
    const row = document.createElement("div");
    row.className = "topping-label";
    row.dataset.sku = variant.sku;
    row.dataset.price = String(variant.price);
    row.innerHTML = '<img class="topping-image" src="' + escapeHtml(variant.image) + '" data-fallback="' +
      escapeHtml(selectedProduct.fallback) + '" alt="' + escapeHtml(variant.name) + '" loading="lazy">' +
      '<label class="topping-left"><input class="variant-check" type="checkbox"><span>' + escapeHtml(variant.name) +
      '</span></label><span class="topping-price">' + money(variant.price) + '</span>' +
      '<div class="topping-quantity disabled"><button class="topping-qty-btn decrease" type="button" aria-label="Kurangi">−</button>' +
      '<span class="topping-qty-number">0</span><button class="topping-qty-btn increase" type="button" aria-label="Tambah">+</button></div>';
    options.appendChild(row);
    row.querySelector(".topping-image").addEventListener("error", useImageFallback, { once: true });
    const check = row.querySelector(".variant-check");
    const qty = row.querySelector(".topping-qty-number");
    const quantityBox = row.querySelector(".topping-quantity");
    const setQuantity = (next) => {
      qty.textContent = String(next);
      check.checked = next > 0;
      quantityBox.classList.toggle("disabled", next <= 0);
      row.classList.toggle("selected", next > 0);
      calculateSubtotal();
    };
    check.addEventListener("change", () => setQuantity(check.checked ? 1 : 0));
    row.querySelector(".increase").addEventListener("click", () => setQuantity(Number(qty.textContent) + 1));
    row.querySelector(".decrease").addEventListener("click", () => setQuantity(Math.max(0, Number(qty.textContent) - 1)));
  });
  calculateSubtotal();
  openModal($("#topping-modal"));
}

function calculateSubtotal() {
  const total = Array.from($("#topping-options").querySelectorAll(".topping-label.selected"))
    .reduce((sum, row) => sum + Number(row.dataset.price) * Number(row.querySelector(".topping-qty-number").textContent), 0);
  $("#topping-subtotal").textContent = money(total);
}

function addSelectedVariants() {
  if (!selectedProduct || !productIsOpen(selectedProduct)) {
    closeModal($("#topping-modal")); loadPreorder(); showNotification("Preorder menu ini sedang ditutup."); return;
  }
  const rows = Array.from($("#topping-options").querySelectorAll(".topping-label.selected"));
  if (!rows.length) { showNotification("Pilih minimal satu varian."); return; }
  rows.forEach((row) => {
    const variant = selectedProduct.variants.find((entry) => entry.sku === row.dataset.sku);
    const qty = Number(row.querySelector(".topping-qty-number").textContent);
    const existing = cart.find((item) => item.sku === variant.sku);
    if (existing) existing.qty += qty;
    else cart.push({ sku: variant.sku, productId: selectedProduct.id, name: selectedProduct.name,
      detail: variant.name, price: variant.price, qty });
  });
  closeModal($("#topping-modal")); updateCart(); showNotification("Menu ditambahkan ke keranjang.");
}

function updateCart() {
  $("#cart-count").textContent = String(cart.reduce((sum, item) => sum + item.qty, 0));
  const container = $("#cart-items");
  container.innerHTML = "";
  if (!cart.length) container.innerHTML = '<div class="empty-cart"><i class="fa-solid fa-basket-shopping" aria-hidden="true"></i><p>Keranjang masih kosong.</p><small>Yuk pilih menu favoritmu!</small></div>';
  cart.forEach((item) => {
    const row = document.createElement("div"); row.className = "cart-item-row";
    row.innerHTML = '<div class="cart-item-info"><strong>' + escapeHtml(item.name) + '</strong><span>' + escapeHtml(item.detail) +
      ' · ' + money(item.price) + ' / pcs</span><b>' + money(item.price * item.qty) + '</b></div>' +
      '<div class="cart-item-actions"><button class="qty-btn decrease-cart" type="button" aria-label="Kurangi">−</button>' +
      '<span class="qty-number">' + item.qty + '</span><button class="qty-btn increase-cart" type="button" aria-label="Tambah">+</button>' +
      '<button class="delete-btn remove-cart" type="button" aria-label="Hapus"><i class="fa-solid fa-trash" aria-hidden="true"></i></button></div>';
    row.querySelector(".decrease-cart").addEventListener("click", () => changeCartQuantity(item.sku, -1));
    row.querySelector(".increase-cart").addEventListener("click", () => changeCartQuantity(item.sku, 1));
    row.querySelector(".remove-cart").addEventListener("click", () => { cart.splice(cart.indexOf(item), 1); updateCart(); });
    container.appendChild(row);
  });
  $("#total-price").textContent = money(cart.reduce((sum, item) => sum + item.price * item.qty, 0));
}

function changeCartQuantity(sku, delta) {
  const item = cart.find((entry) => entry.sku === sku);
  if (!item) return;
  if (delta > 0 && !productIsOpen(products.find((product) => product.id === item.productId))) {
    showNotification("Preorder menu ini sedang ditutup."); loadPreorder(); return;
  }
  item.qty += delta;
  if (item.qty <= 0) cart.splice(cart.indexOf(item), 1);
  updateCart();
}

function openCheckout() {
  if (!cart.length) { showNotification("Keranjang masih kosong."); return; }
  if (!preorderReady) { showNotification("Status preorder belum tersedia. Coba perbarui."); loadPreorder(); return; }
  if (cart.some((item) => !productIsOpen(products.find((product) => product.id === item.productId)))) {
    showNotification("Preorder salah satu menu di keranjang telah ditutup."); loadPreorder(); return;
  }
  $("#checkout-summary").innerHTML = cart.map((item) => '<div class="checkout-item"><div><strong>' + item.qty + "x " +
    escapeHtml(item.name) + '</strong><small>' + escapeHtml(item.detail) + '</small></div><span>' + money(item.price * item.qty) +
    '</span></div>').join("");
  $("#checkout-total-price").textContent = money(cart.reduce((sum, item) => sum + item.price * item.qty, 0));
  closeModal($("#cart-modal")); openModal($("#checkout-modal"));
}

function buildOrder() {
  const customerName = $("#cust-name").value.trim();
  const paymentMethod = $("#cust-payment").value;
  const orderId = "MLT-" + Date.now().toString(36).toUpperCase();
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const items = cart.map((item) => ({ sku: item.sku, productId: item.productId, productName: item.name,
    variantName: item.detail, quantity: item.qty, unitPrice: item.price }));
  const message = ["Halo Kak, saya mau pesan:", "", "ID Pesanan: " + orderId, "Nama: " + customerName,
    "Pembayaran: " + paymentMethod, "", "Rincian pesanan:", ...cart.map((item) => "- " + item.qty + "x " + item.name +
    " (" + item.detail + ") = " + money(item.qty * item.price)), "", "Total: " + money(total), "", "Terima kasih!"].join("\n");
  return { order: { orderId, customerName, paymentMethod, total, items }, message };
}

function submitOrder(event) {
  event.preventDefault();
  if (!cart.length || !$("#checkout-form").reportValidity()) return;
  const submitButton = $("#checkout-form button[type='submit']");
  if (submitButton.disabled) return;
  if (!preorderReady || cart.some((item) => !productIsOpen(products.find((product) => product.id === item.productId)))) {
    showNotification("Preorder sudah berubah atau belum tersedia. Pesanan belum dikirim."); loadPreorder(); return;
  }
  const payload = buildOrder();
  const whatsappUrl = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(payload.message);
  // Navigate to WhatsApp immediately inside the user's click gesture. Waiting
  // for a cross-origin Apps Script iframe response can otherwise leave a blank tab.
  const whatsappWindow = window.open(whatsappUrl, "_blank");
  if (!whatsappWindow) { showNotification("Izinkan pop-up untuk membuka WhatsApp, lalu klik pesan lagi."); return; }
  submitButton.disabled = true;
  showNotification("WhatsApp dibuka. Sedang mencatat pesanan...");
  sendOrderToSpreadsheet(payload.order, (success, message) => {
    submitButton.disabled = false;
    if (!success) {
      showNotification("WhatsApp sudah terbuka, tetapi pesanan belum tercatat di spreadsheet. " +
        (message || "Periksa koneksi atau deployment Apps Script."));
      return;
    }
    closeModal($("#checkout-modal")); $("#checkout-form").reset(); cart.splice(0, cart.length); updateCart();
    showNotification("Pesanan tercatat. Silakan kirim pesan WhatsApp.");
  });
}

function sendOrderToSpreadsheet(order, done) {
  const frameName = "meletup-order-frame";
  let frame = document.querySelector("iframe[name='" + frameName + "']");
  if (!frame) { frame = document.createElement("iframe"); frame.name = frameName; frame.title = "Pengiriman pesanan"; frame.hidden = true; document.body.appendChild(frame); }
  const form = document.createElement("form");
  form.method = "POST"; form.action = GOOGLE_SHEETS_WEB_APP_URL; form.target = frameName; form.hidden = true; form.acceptCharset = "UTF-8";
  const input = document.createElement("input"); input.type = "hidden"; input.name = "payload"; input.value = JSON.stringify(order); form.appendChild(input);
  document.body.appendChild(form);
  let finished = false;
  const finish = (success, message) => {
    if (finished) return; finished = true; window.clearTimeout(timeoutId); window.removeEventListener("message", onMessage);
    form.remove(); done(success, message);
  };
  const onMessage = (event) => {
    if (event.source !== frame.contentWindow || !event.data || event.data.type !== "MELETUP_ORDER_RESULT") return;
    finish(Boolean(event.data.ok), String(event.data.message || ""));
  };
  window.addEventListener("message", onMessage);
  const timeoutId = window.setTimeout(() => finish(false, "Server belum memberi jawaban. Periksa koneksi lalu coba lagi."), 20000);
  form.submit();
}

function openModal(modal) { modal.classList.add("show"); }
function closeModal(modal) { modal.classList.remove("show"); }

function revealOnScroll(element, index) {
  if (!element) return;
  element.classList.add("reveal-on-scroll");
  element.style.setProperty("--reveal-delay", String((Number(index) % 4) * 75) + "ms");
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !scrollRevealObserver) {
    element.classList.add("is-visible");
    return;
  }
  scrollRevealObserver.observe(element);
}

function setupScrollReveal() {
  const elements = document.querySelectorAll(
    ".benefit, .section-heading, #preorder-banner, .search-box, .about-text, .about-card, .step-card"
  );
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    elements.forEach((element, index) => revealOnScroll(element, index));
    return;
  }
  scrollRevealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -36px 0px" });
  elements.forEach((element, index) => revealOnScroll(element, index));
}

function closeMobileMenu() {
  $("#nav-menu").classList.remove("active");
  $("#hamburger").classList.remove("active");
  $("#hamburger").setAttribute("aria-expanded", "false");
  $("#hamburger").setAttribute("aria-label", "Buka menu");
}

$("#hamburger").addEventListener("click", () => {
  const open = $("#hamburger").classList.toggle("active");
  $("#nav-menu").classList.toggle("active", open); $("#hamburger").setAttribute("aria-expanded", String(open));
  $("#hamburger").setAttribute("aria-label", open ? "Tutup menu" : "Buka menu");
});
document.querySelectorAll(".nav-link").forEach((link) => link.addEventListener("click", () => {
  closeMobileMenu();
  document.querySelectorAll(".nav-link").forEach((item) => item.classList.remove("active")); link.classList.add("active");
}));
document.addEventListener("click", (event) => {
  if (!event.target.closest(".navbar") && $("#nav-menu").classList.contains("active")) closeMobileMenu();
});
$("#menu-search").addEventListener("input", (event) => {
  $("#clear-search").classList.toggle("show", Boolean(event.target.value.trim())); renderProducts(event.target.value);
});
$("#clear-search").addEventListener("click", () => {
  $("#menu-search").value = ""; $("#clear-search").classList.remove("show"); renderProducts(""); $("#menu-search").focus();
});
$("#refresh-preorder").addEventListener("click", loadPreorder);
$("#confirm-topping").addEventListener("click", addSelectedVariants);
$("#cart-btn").addEventListener("click", () => openModal($("#cart-modal")));
$("#close-cart").addEventListener("click", () => closeModal($("#cart-modal")));
$("#close-topping").addEventListener("click", () => closeModal($("#topping-modal")));
$("#close-checkout").addEventListener("click", () => closeModal($("#checkout-modal")));
$("#checkout-btn").addEventListener("click", openCheckout);
$("#checkout-form").addEventListener("submit", submitOrder);
document.querySelectorAll(".modal").forEach((modal) => modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(modal); }));
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    document.querySelectorAll(".modal").forEach(closeModal);
    closeMobileMenu();
  }
});
$("#brand-logo").addEventListener("error", (event) => {
  const logo = event.currentTarget; logo.classList.add("logo-image-failed");
  const fallback = document.createElement("span"); fallback.className = "logo-wordmark"; fallback.textContent = "MELETUP"; logo.parentNode.appendChild(fallback);
}, { once: true });
document.querySelectorAll(".hero-track img").forEach((image) => image.addEventListener("error", useImageFallback, { once: true }));

setupScrollReveal(); renderProducts(""); updateCart(); loadPreorder(); window.setInterval(loadPreorder, 60000);
window.addEventListener("focus", loadPreorder);