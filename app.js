const CONFIG = {
    currency: "₱",
    messengerUrl: "https://m.me/100089330907916",
    sheetUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRBquyZXkcMOzDv_14qyXq7sQvxqQ6k1l6tWZsiqspZ_mgl88Lqx08h3wUVYu9W9-MIP-ja5f-Yvtsj/pub?gid=1109857950&single=true&output=csv",
    businessPhone: "09264569430",
    businessHours: "8:00 AM - 9:00 PM"
};

let products = [];
let cart = [];
let hasCopied = false;
let refreshPromptCount = 0;
const MAX_REFRESH_PROMPTS = 1;
let toastTimeout = null;

// ============================================
// CSV ROW PARSER – handles quoted fields
// ============================================
function parseCSVRow(row) {
    const result = [];
    let inQuote = false;
    let currentField = '';
    for (let i = 0; i < row.length; i++) {
        const char = row[i];
        if (char === '"') {
            inQuote = !inQuote;
        } else if (char === ',' && !inQuote) {
            result.push(currentField);
            currentField = '';
        } else {
            currentField += char;
        }
    }
    result.push(currentField);
    return result;
}

// ============================================
// LOAD PRODUCTS – matches your column layout
// ============================================
async function loadProducts(showToastOnSuccess = true) {
    try {
        const response = await fetch(`${CONFIG.sheetUrl}&t=${Date.now()}`);
        const data = await response.text();
        const lines = data.split('\n');
        const rows = lines.slice(1).filter(line => line.trim() !== '');

        const allProducts = rows.map(row => {
            const cols = parseCSVRow(row);

            // YOUR COLUMN ORDER:
            // 0:id, 1:name, 2:category, 3:price, 4:image, 5:status, 6:stock,
            // 7:variant_option, 8:has_flavors, 9:unavailable_flavors

            const id = cols[0]?.trim();
            const name = cols[1]?.trim();
            const category = cols[2]?.trim() || 'Uncategorized';  // <-- Column 2
            const price = parseFloat(cols[3]) || 0;
            const image = cols[4]?.trim();
            const status = cols[5]?.trim();
            const stock = parseInt(cols[6]) || 0;
            
            // Column 7: variant_option (comma-separated flavors)
            let variant_option_raw = cols[7]?.trim() || '';
            let flavorArray = variant_option_raw
                .split(',')
                .map(f => f.trim())
                .filter(f => f.length > 0);

            // Column 8: has_flavors (we can derive from flavorArray)
            const has_flavors = flavorArray.length > 0;

            // Column 9: unavailable_flavors
            let unavailable_raw = cols[9]?.trim() || '';
            let unavailableArray = unavailable_raw
                .split(',')
                .map(f => f.trim())
                .filter(f => f.length > 0);

            return {
                id, name, category, price, image, status, stock,
                variant_option: flavorArray,
                unavailable_flavors: unavailableArray,
                has_flavors
            };
        }).filter(p => p.id && p.name);

        products = allProducts;
        renderCategoriesAndMenu();
        validateCartAgainstNewStock();

        if (showToastOnSuccess) {
            showToast("🔄 Menu updated with latest stock!");
        }

    } catch (error) {
        console.error("Error loading products:", error);
        if (products.length === 0) {
            document.getElementById('menu-grid').innerHTML = `
                <div class='error-message'>
                    <p>📋 Menu is updating...</p>
                    <p>Please refresh the page.</p>
                </div>`;
        } else {
            showToast("❌ Could not update stock. Check connection.");
        }
    }
}

// ============================================
// RENDER CATEGORY TABS + CATEGORY HEADINGS + PRODUCT CARDS
// ============================================
function renderCategoriesAndMenu() {
    // Group products by category
    const categoryMap = new Map();
    products.forEach(prod => {
        const cat = prod.category || 'Uncategorized';
        if (!categoryMap.has(cat)) {
            categoryMap.set(cat, []);
        }
        categoryMap.get(cat).push(prod);
    });

    // Render sticky tabs
    const tabsContainer = document.getElementById('category-tabs');
    let tabsHtml = '';
    categoryMap.forEach((_, category) => {
        const safeId = category.replace(/\s+/g, '-').toLowerCase();
        tabsHtml += `<button class="category-tab" data-category="${safeId}">${category}</button>`;
    });
    tabsContainer.innerHTML = tabsHtml;

    // Attach click handlers to tabs – with scroll offset
document.querySelectorAll('.category-tab').forEach(tab => {
    tab.addEventListener('click', function(e) {
        const categoryId = this.dataset.category;
        const heading = document.getElementById(`cat-${categoryId}`);
        if (heading) {
            // Calculate sticky header + tabs height
            const header = document.querySelector('.app-header');
            const tabs = document.querySelector('.category-tabs');
            const headerHeight = header ? header.offsetHeight : 0;
            const tabsHeight = tabs ? tabs.offsetHeight : 0;
            const offset = headerHeight + tabsHeight + 15; // 15px extra breathing room
            
            // Get the heading's position relative to the document
            const y = heading.getBoundingClientRect().top + window.scrollY - offset;
            
            // Smooth scroll to the calculated position
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
        // Update active state
        document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
    });
});

    // Render menu grid with category headings + product cards
    const grid = document.getElementById('menu-grid');
    let gridHtml = '';

    categoryMap.forEach((productsInCat, category) => {
        const safeId = category.replace(/\s+/g, '-').toLowerCase();
        gridHtml += `<div id="cat-${safeId}" class="category-heading">${category}</div>`;
        
        // Render each product in this category
        productsInCat.forEach(prod => {
            if (prod.has_flavors && prod.variant_option.length > 0) {
                gridHtml += renderFlavorProductCard(prod);
            } else {
                gridHtml += renderSimpleProductCard(prod);
            }
        });
    });

    grid.innerHTML = gridHtml;
}

// ============================================
// RENDER SIMPLE PRODUCT (no flavors) – NO OVERLAY
// ============================================
function renderSimpleProductCard(p) {
    const isSoldOut = p.stock <= 0;
    let stockBadge = '';
    if (isSoldOut) {
        stockBadge = `<span class="tag sold-out">⛔ SOLD OUT</span>`;
    } else if (p.stock <= 5) {
        stockBadge = `<span class="tag low-stock">⚠️ Only ${p.stock} left!</span>`;
    } else {
        stockBadge = `<span class="tag available">✅ In Stock</span>`;
    }

    return `
        <div class="product-card ${isSoldOut ? 'sold-out-gray' : ''}" data-product-id="${p.id}">
            <div class="product-image-container">
                <img src="${p.image}" class="product-image" onerror="this.src='https://placehold.co/300x400?text=Sweet'">
            </div>
            <div class="product-details">
                <div class="product-info">
                    <h3>${p.name}</h3>
                    <div class="stock-badge">${stockBadge}</div>
                    <span class="price">₱${p.price.toFixed(2)}</span>
                </div>
                ${isSoldOut ?
                    `<button class="add-btn disabled" disabled>⛔ Sold Out</button>` :
                    `<button class="add-btn" onclick="addSimpleToCart('${p.id}', event)">➕ Add to Cart</button>`
                }
            </div>
        </div>`;
}

// ============================================
// RENDER FLAVOR PRODUCT CARD – NO OVERLAY
// ============================================
function renderFlavorProductCard(p) {
    const isSoldOut = p.stock <= 0;
    const dropdownId = `flavor-select-${p.id}`;

    let options = `<option value="" disabled selected class="placeholder-option">🍹 Choose flavor</option>`;
    p.variant_option.forEach(flavor => {
        const isUnavailable = p.unavailable_flavors && p.unavailable_flavors.includes(flavor);
        const disabledAttr = isUnavailable ? 'disabled' : '';
        const displayText = isUnavailable ? `${flavor} (not available)` : flavor;
        options += `<option value="${flavor}" ${disabledAttr}>${displayText}</option>`;
    });

    let stockBadge = '';
    if (isSoldOut) {
        stockBadge = `<span class="tag sold-out">⛔ SOLD OUT</span>`;
    } else if (p.stock <= 5) {
        stockBadge = `<span class="tag low-stock">⚠️ Only ${p.stock} left!</span>`;
    } else {
        stockBadge = `<span class="tag available">✅ In Stock</span>`;
    }

    return `
        <div class="product-card product-card-variant ${isSoldOut ? 'sold-out-gray' : ''}" data-product-id="${p.id}">
            <div class="product-image-container">
                <img src="${p.image}" class="product-image" onerror="this.src='https://placehold.co/300x400?text=Sweet'">
            </div>
            <div class="product-details">
                <div class="product-info">
                    <h3>${p.name}</h3>
                    ${stockBadge}
                    <span class="price">₱${p.price.toFixed(2)}</span>
                    
                    <div class="variant-selector">
                        <select id="${dropdownId}" class="variant-dropdown" ${isSoldOut ? 'disabled' : ''} required>
                            ${options}
                        </select>
                    </div>
                </div>
                ${isSoldOut ?
                    `<button class="add-btn disabled" disabled>⛔ Sold Out</button>` :
                    `<button class="add-btn" onclick="addFlavorToCart('${p.id}', '${dropdownId}', event)">➕ Add to Cart</button>`
                }
            </div>
        </div>`;
}

// ============================================
// ADD TO CART: SIMPLE PRODUCT
// ============================================
window.addSimpleToCart = (id, event) => {
    const p = products.find(x => x.id === id);
    if (!p) return showToast("❌ Product not available");
    if (event) animateAddToCart(event.currentTarget, p.image);

    const existing = cart.find(x => x.id === id);
    if (existing) {
        if (existing.qty >= p.stock) return showToast(`⚠️ Only ${p.stock} ${p.name} available!`);
        existing.qty++;
    } else {
        if (p.stock <= 0) return showToast("⛔ Sold out!");
        cart.push({ ...p, qty: 1 });
    }
    updateUI();
    showToast(`✅ Added ${p.name}`);
    animateCart();
};

// ============================================
// ADD TO CART: FLAVOR PRODUCT
// ============================================
window.addFlavorToCart = (productId, dropdownId, event) => {
    const product = products.find(x => x.id === productId);
    if (!product) return showToast("❌ Product not available");
    if (product.stock <= 0) return showToast("⛔ Sold out!");

    const select = document.getElementById(dropdownId);
    if (!select) return showToast("❌ Error: Flavor selector not found");

    const selectedFlavor = select.value;
    if (!selectedFlavor) {
        showToast("⚠️ Please choose a flavor first!", 3000);
        return;
    }

    if (product.unavailable_flavors && product.unavailable_flavors.includes(selectedFlavor)) {
        showToast(`❌ ${selectedFlavor} is currently not available`, 3000);
        return;
    }

    if (event) animateAddToCart(event.currentTarget, product.image);

    const variantId = `${productId}-${selectedFlavor.replace(/\s+/g, '-')}`;
    const variantName = `${product.name} (${selectedFlavor})`;

    const existingIndex = cart.findIndex(item => item.id === variantId);
    if (existingIndex !== -1) {
        if (cart[existingIndex].qty >= product.stock) {
            return showToast(`⚠️ Only ${product.stock} ${variantName} available!`);
        }
        cart[existingIndex].qty++;
    } else {
        cart.push({
            id: variantId,
            name: variantName,
            price: product.price,
            image: product.image,
            stock: product.stock,
            parentId: product.id,
            flavor: selectedFlavor,
            qty: 1
        });
    }

    updateUI();
    showToast(`✅ Added ${variantName}`);
    animateCart();
};

// ============================================
// ANIMATION HELPERS (unchanged)
// ============================================
function animateAddToCart(button, imageSrc) {
    if (!button) return;
    const buttonRect = button.getBoundingClientRect();
    const cartBtn = document.getElementById('open-cart-btn');
    const cartRect = cartBtn.getBoundingClientRect();
    const startX = buttonRect.left + buttonRect.width / 2;
    const startY = buttonRect.top + buttonRect.height / 2;
    const endX = cartRect.left + cartRect.width / 2;
    const endY = cartRect.top + cartRect.height / 2;

    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            createFlyingImage(imageSrc || 'https://placehold.co/300x400?text=Sweet',
                startX + Math.random() * 20 - 10,
                startY + Math.random() * 20 - 10,
                endX, endY);
        }, i * 100);
    }
}

function createFlyingImage(src, startX, startY, endX, endY) {
    const flyingImg = document.createElement('div');
    flyingImg.className = 'flying-item';
    flyingImg.style.left = `${startX}px`;
    flyingImg.style.top = `${startY}px`;
    flyingImg.innerHTML = `<img src="${src}" alt="Flying item">`;
    document.body.appendChild(flyingImg);
    flyingImg.offsetWidth;
    flyingImg.style.transform = `translate(${endX - startX}px, ${endY - startY}px) scale(0.3)`;
    flyingImg.style.opacity = '0.5';
    setTimeout(() => {
        flyingImg.style.transition = 'all 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
        flyingImg.style.transform = `translate(${endX - startX}px, ${endY - startY}px) scale(0.1)`;
        flyingImg.style.opacity = '0';
        setTimeout(() => flyingImg.remove(), 800);
    }, 100);
}

function animateCart() {
    const cartBtn = document.getElementById('open-cart-btn');
    const cartCount = document.getElementById('cart-count');
    cartBtn.style.transform = 'translateX(-50%) scale(1.15)';
    cartCount.style.transform = 'scale(1.5)';
    cartCount.style.backgroundColor = '#FF9800';
    setTimeout(() => {
        cartBtn.style.transform = 'translateX(-50%) scale(1)';
        cartCount.style.transform = 'scale(1)';
        setTimeout(() => cartCount.style.backgroundColor = '', 300);
    }, 300);
}

// ============================================
// UPDATE CART UI (unchanged)
// ============================================
function updateUI() {
    const totalQty = cart.reduce((s, i) => s + i.qty, 0);
    const totalVal = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    document.getElementById('cart-count').textContent = totalQty;
    document.getElementById('float-total').textContent = `₱${totalVal.toFixed(2)}`;
    document.getElementById('modal-total').textContent = `₱${totalVal.toFixed(2)}`;

    const cartContainer = document.getElementById('cart-items');
    cartContainer.innerHTML = cart.length === 0
        ? '<div class="empty-cart"><p>🛒 Your cart is empty</p><p class="empty-hint">Add some sweet treats! 🍰</p></div>'
        : cart.map(i => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <strong>${i.name}</strong>
                    <small>₱${i.price.toFixed(2)} each</small>
                </div>
                <div class="cart-item-controls">
                    <button class="qty-btn minus" onclick="changeQty('${i.id}', -1)">−</button>
                    <span class="qty-display">${i.qty}</span>
                    <button class="qty-btn plus" onclick="changeQty('${i.id}', 1)">+</button>
                </div>
            </div>
        `).join('');
}

window.changeQty = (id, delta) => {
    const idx = cart.findIndex(i => i.id === id);
    if (idx === -1) return;
    const item = cart[idx];
    const product = item.parentId
        ? products.find(p => p.id === item.parentId)
        : products.find(p => p.id === item.id);

    if (!product) {
        cart.splice(idx, 1);
        updateUI();
        return;
    }

    if (delta > 0) {
        if (item.qty >= product.stock) {
            return showToast(`⚠️ Only ${product.stock} ${item.name} available!`);
        }
        item.qty += delta;
    } else {
        item.qty += delta;
        if (item.qty <= 0) cart.splice(idx, 1);
    }
    updateUI();
};

// ============================================
// VALIDATE CART AGAINST CURRENT STOCK (unchanged)
// ============================================
function validateCartAgainstNewStock() {
    let changed = false;
    const removed = [];
    for (let i = cart.length - 1; i >= 0; i--) {
        const item = cart[i];
        const prodId = item.parentId || item.id;
        const prod = products.find(p => p.id === prodId);
        if (!prod || prod.stock <= 0) {
            removed.push(item.name);
            cart.splice(i, 1);
            changed = true;
        } else if (item.qty > prod.stock) {
            item.qty = prod.stock;
            changed = true;
            showToast(`⚠️ ${item.name} quantity reduced to ${prod.stock}`);
        }
    }
    if (changed) {
        updateUI();
        if (removed.length) showToast(`❌ ${removed.length} item(s) removed – no longer available`, 4000);
    }
}

// ============================================
// RESET COPY BUTTON (unchanged)
// ============================================
function resetCopyButton() {
    hasCopied = false;
    const btn = document.getElementById('copy-details-btn');
    if (btn) {
        btn.innerHTML = "1. Copy Order Details 📋";
        btn.style.background = "";
    }
}

// ============================================
// CHECKOUT & RECEIPT (unchanged)
// ============================================
window.openCheckout = () => {
    const name = document.getElementById('customer-name').value.trim();
    const addr = document.getElementById('customer-address').value.trim();
    if (cart.length === 0) return showToast("🛒 Add some treats first!");
    if (!name) return showToast("👤 Please enter your name");
    if (!addr) return showToast("📍 Please enter your address");

    document.getElementById('cart-modal').classList.remove('active');
    document.getElementById('checkout-modal').classList.add('active');
    document.getElementById('final-summary-text').innerHTML = cart.map(i =>
        `<div class="summary-item">${i.qty}x ${i.name} = ₱${(i.price * i.qty).toFixed(2)}</div>`
    ).join('');
};

window.copyOrderDetails = () => {
    const name = document.getElementById('customer-name').value.trim();
    const addr = document.getElementById('customer-address').value.trim();
    const type = document.getElementById('order-type').value;
    const pay = document.getElementById('payment-method').value;
    const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });

    let text = `✨ SKY SWEET TREATS ✨\n`;
    text += `════════════════\n`;

    text += `📋 **ORDER RECEIPT**\n`;
    text += `📅 ${dateStr}\n`;
    text += `⏰ ${timeStr}\n`;
    text += `🆔 #${Date.now().toString().slice(-6)}\n`;
    text += `════════════════\n`;

    text += `👤 **CUSTOMER DETAILS**\n`;
    text += `• Name: ${name}\n`;
    text += `• Address: ${addr}\n`;
    text += `• Order Type: ${type}\n`;
    text += `• Payment: ${pay}\n`;
    text += `════════════════\n`;

    text += `🛒 **ORDER ITEMS**\n`;
    cart.forEach(i => {
        text += `• ${i.qty}x ${i.name} = ₱${(i.price * i.qty).toFixed(2)}\n`;
    });
    text += `════════════════\n`;

    text += `💰 **PAYMENT SUMMARY**\n`;
    text += `• Subtotal: ₱${total.toFixed(2)}\n`;
    text += `• Total Amount: ₱${total.toFixed(2)}\n`;
    text += `════════════════\n`;

    text += `⚠️ **IMPORTANT REMINDERS**\n`;
    if (pay === 'GCASH') {
        text += `\n💳 **GCASH PAYMENT REQUIRED**\n`;
        text += `1. Send payment to: ${CONFIG.businessPhone}\n`;
        text += `2. Account Name: K** M.\n`;
        text += `3. Send SCREENSHOT of payment receipt\n`;
        text += `4. Order will only be processed after payment confirmation\n`;
    }

    text += `\n📞 **CONTACT INFORMATION**\n`;
    text += `• Messenger: Sky Sweet Treats Page\n`;
    text += `• Phone: ${CONFIG.businessPhone}\n`;
    text += `• Hours: ${CONFIG.businessHours}\n`;
    text += `════════════════\n`;
    text += `Thank you for your order! 🎉\n`;
    text += `We'll contact you within 5-10 minutes.`;

    navigator.clipboard.writeText(text).then(() => {
        hasCopied = true;
        const btn = document.getElementById('copy-details-btn');
        btn.innerHTML = "✅ Order Details Copied!";
        btn.style.background = "#28a745";
        showToast(pay === 'GCASH' ? "📋 Order copied! Don't forget to send GCash receipt!" : "📋 Order details copied!", pay === 'GCASH' ? 4000 : 2000);
    }).catch(() => showToast("❌ Failed to copy. Please try again."));
};

window.sendToMessenger = () => {
    if (!hasCopied) return showToast("⚠️ Please click '1. Copy Order Details' first!");
    const pay = document.getElementById('payment-method').value;
    let msg = "📱 **Ready to Send Your Order?**\n\n✅ Order details copied!\n\n**NEXT STEPS:**\n1. We'll open Messenger now\n2. **PASTE** the order details\n3. **SEND** the message\n";
    if (pay === 'GCASH') {
        msg += "4. **SEND SCREENSHOT** of your GCash payment\n\nYour order will be processed after payment confirmation.";
    } else {
        msg += "\nWe'll confirm your order within 5-10 minutes.";
    }
    if (confirm(msg)) {
        window.open(CONFIG.messengerUrl, '_blank');
        setTimeout(() => resetCopyButton(), 5000);
    }
};

// ============================================
// UI HELPERS (toast, modal, GCash)
// ============================================
window.toggleGcashInfo = () => {
    const isGcash = document.getElementById('payment-method').value === 'GCASH';
    document.getElementById('gcash-info').style.display = isGcash ? 'block' : 'none';
    if (isGcash) showToast("💳 GCash selected: Don't forget to send payment receipt!", 3000);
    resetCopyButton();
};

window.closeModal = (id) => {
    document.getElementById(id).classList.remove('active');
    if (id === 'checkout-modal') resetCopyButton();
};

window.downloadQR = function() {
    const qrImage = document.getElementById('qr-image-el');
    if (!qrImage || !qrImage.src) {
        showToast("❌ QR code image not found");
        return;
    }

    showToast("📥 Downloading QR code...", 0);

    try {
        const a = document.createElement('a');
        a.href = qrImage.src;
        a.download = 'gcash-qr.jpg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => {
            showToast("✅ QR code downloaded!", 2000);
        }, 500);
    } catch (e) {
        console.error('Download failed:', e);
        window.open(qrImage.src, '_blank');
        showToast("📱 Long‑press to save the QR code", 4000);
    }
};

function showToast(message, duration = 2000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    
    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    
    if (duration > 0) {
        window.toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    }
}

// ============================================
// GENTLE REFRESH BANNER
// ============================================
function showRefreshPrompt() {
    if (refreshPromptCount >= MAX_REFRESH_PROMPTS) return;
    const prompt = document.createElement('div');
    prompt.className = 'refresh-prompt';
    prompt.innerHTML = `
        <div class="refresh-prompt-content">
            <span class="refresh-icon">🔄</span>
            <div class="refresh-text">
                <strong>Stock may have changed?</strong>
                <small>Check for updates</small>
            </div>
            <button class="refresh-now-btn" onclick="handleRefreshClick()">Check Now</button>
            <button class="refresh-close-btn" onclick="this.closest('.refresh-prompt').remove()">✕</button>
        </div>
    `;
    document.body.prepend(prompt);
    refreshPromptCount++;
}

window.handleRefreshClick = function() {
    loadProducts(true);
    document.querySelectorAll('.refresh-prompt').forEach(el => el.remove());
};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    loadProducts(false);
    document.getElementById('open-cart-btn').onclick = () => {
        document.getElementById('cart-modal').classList.add('active');
    };
    setTimeout(showRefreshPrompt, 10000);

    const orderTypeSelect = document.getElementById('order-type');
    const paymentMethodSelect = document.getElementById('payment-method');
    if (orderTypeSelect) orderTypeSelect.addEventListener('change', resetCopyButton);
    if (paymentMethodSelect) paymentMethodSelect.addEventListener('change', resetCopyButton);

    document.getElementById('customer-name')?.addEventListener('input', function() {
        if (this.value.trim()) this.style.borderColor = '#4CAF50';
    });
    document.getElementById('customer-address')?.addEventListener('input', function() {
        if (this.value.trim()) this.style.borderColor = '#4CAF50';
    });
});

// Admin shortcut
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        loadProducts(true);
        showToast('🔄 Manual refresh triggered');
    }
});
