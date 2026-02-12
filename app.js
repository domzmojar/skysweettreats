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

// Shipping state
let selectedShippingAddress = '';
let selectedShippingFee = 0;

// ============================================
// SHIPPING ADDRESSES – sorted alphabetically by second word
// ============================================
const SHIPPING_OPTIONS = [
    { name: "Proper Tamlang", fee: 10.00 },
    { name: "Sitio Balud", fee: 15.00 },
    { name: "Sitio Gequilan", fee: 20.00 },
    { name: "Sitio Quartel", fee: 20.00 },
    { name: "Sitio Minaongca", fee: 30.00 },
    { name: "Sitio Alangahag", fee: 30.00 },
    { name: "Sitio Bongabong", fee: 30.00 },
    { name: "Brgy. Binaguiohan", fee: 30.00 },
    { name: "Sitio Carbon", fee: 30.00 },
    { name: "Sitio Balaring", fee: 50.00 },
    { name: "Brgy. Lopez Jaena", fee: 30.00 },
    { name: "Brgy. Magsaysay", fee: 50.00 }
];

function sortShippingOptions() {
    return [...SHIPPING_OPTIONS].sort((a, b) => {
        const getSecondWord = (str) => {
            const parts = str.split(' ');
            return parts.length > 1 ? parts[1] : str;
        };
        return getSecondWord(a.name).localeCompare(getSecondWord(b.name));
    });
}

function renderShippingDropdown() {
    const select = document.getElementById('shipping-address');
    if (!select) return;
    
    const sorted = sortShippingOptions();
    let html = `<option value="" disabled selected>Select your barangay/sitio</option>`;
    sorted.forEach(opt => {
        html += `<option value="${opt.name}|${opt.fee.toFixed(2)}">${opt.name}</option>`;
    });
    select.innerHTML = html;
}

// ============================================
// TOGGLE DELIVERY FIELDS + PAYMENT OPTIONS
// ============================================
window.toggleDeliveryFields = function() {
    const orderType = document.getElementById('order-type').value;
    const shippingGroup = document.getElementById('shipping-group');
    const landmarkGroup = document.getElementById('landmark-group');
    const landmarkField = document.getElementById('customer-address');
    const paymentSelect = document.getElementById('payment-method');
    
    if (orderType === 'Delivery') {
        shippingGroup.style.display = 'block';
        landmarkGroup.style.display = 'block';
        landmarkField.required = true;
    } else {
        shippingGroup.style.display = 'none';
        landmarkGroup.style.display = 'none';
        landmarkField.required = false;
        selectedShippingAddress = '';
        selectedShippingFee = 0;
        const shippingSelect = document.getElementById('shipping-address');
        if (shippingSelect) shippingSelect.value = '';
        updateUI();
    }
    
    const codOption = paymentSelect.querySelector('option[value="COD"]');
    const copOption = paymentSelect.querySelector('option[value="COP"]');
    
    if (orderType === 'Delivery') {
        codOption.style.display = 'block';
        copOption.style.display = 'none';
        if (paymentSelect.value === 'COP') {
            paymentSelect.value = 'COD';
            toggleGcashInfo();
        }
    } else {
        codOption.style.display = 'none';
        copOption.style.display = 'block';
        if (paymentSelect.value === 'COD') {
            paymentSelect.value = 'COP';
            toggleGcashInfo();
        }
    }
};

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
// LOAD PRODUCTS – NEW COLUMN ORDER (with badge at index 2)
// ============================================
async function loadProducts(showToastOnSuccess = true) {
    try {
        const response = await fetch(`${CONFIG.sheetUrl}&t=${Date.now()}`);
        const data = await response.text();
        const lines = data.split('\n');
        const rows = lines.slice(1).filter(line => line.trim() !== '');

        const allProducts = rows.map(row => {
            const cols = parseCSVRow(row);

            // NEW COLUMN ORDER:
            // 0:id, 1:name, 2:badge, 3:category, 4:price, 5:details,
            // 6:status, 7:stock, 8:variant_option, 9:has_flavors,
            // 10:unavailable_flavors, 11:image

            const id = cols[0]?.trim();
            const name = cols[1]?.trim();
            const badge = cols[2]?.trim() || '';               // 🆕 Badge
            const category = cols[3]?.trim() || 'Uncategorized';
            const price = parseFloat(cols[4]) || 0;
            const details = cols[5]?.trim() || '';
            const status = cols[6]?.trim();
            const stock = parseInt(cols[7]) || 0;
            
            let variant_option_raw = cols[8]?.trim() || '';
            let flavorArray = variant_option_raw
                .split(',')
                .map(f => f.trim())
                .filter(f => f.length > 0);

            const has_flavors = flavorArray.length > 0;

            let unavailable_raw = cols[10]?.trim() || '';
            let unavailableArray = unavailable_raw
                .split(',')
                .map(f => f.trim())
                .filter(f => f.length > 0);

            const image = cols[11]?.trim() || '';

            return {
                id, name, badge, category, price, details, status, stock,
                variant_option: flavorArray,
                unavailable_flavors: unavailableArray,
                has_flavors,
                image
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
// RENDER CATEGORY TABS + HEADINGS + PRODUCT CARDS
// (Scroll spy – unchanged, perfect)
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

    // Store mapping
    const tabMap = new Map();
    document.querySelectorAll('.category-tab').forEach(tab => {
        const categoryId = tab.dataset.category;
        tabMap.set(categoryId, tab);
    });

    // Click handler
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.addEventListener('click', function(e) {
            const categoryId = this.dataset.category;
            const heading = document.getElementById(`cat-${categoryId}`);
            if (heading) {
                const header = document.querySelector('.app-header');
                const tabs = document.querySelector('.category-tabs');
                const headerHeight = header ? header.offsetHeight : 0;
                const tabsHeight = tabs ? tabs.offsetHeight : 0;
                const offset = headerHeight + tabsHeight + 15;
                const y = heading.getBoundingClientRect().top + window.scrollY - offset;
                window.scrollTo({ top: y, behavior: 'smooth' });
            }
            document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            window.lastActiveCategory = categoryId;
        });
    });

    // Render menu grid
    const grid = document.getElementById('menu-grid');
    let gridHtml = '';
    const categoryBoundaries = [];

    categoryMap.forEach((productsInCat, category) => {
        const safeId = category.replace(/\s+/g, '-').toLowerCase();
        gridHtml += `<div id="cat-${safeId}" class="category-heading">${category}</div>`;
        
        productsInCat.forEach((prod, index) => {
            if (prod.has_flavors && prod.variant_option.length > 0) {
                gridHtml += renderFlavorProductCard(prod);
            } else {
                gridHtml += renderSimpleProductCard(prod);
            }
            if (index === productsInCat.length - 1) {
                gridHtml += `<div id="end-${safeId}" class="category-end" style="height:0; opacity:0;"></div>`;
            }
        });
    });

    grid.innerHTML = gridHtml;

    // Build boundaries
    categoryBoundaries.length = 0;
    categoryMap.forEach((_, category) => {
        const safeId = category.replace(/\s+/g, '-').toLowerCase();
        const heading = document.getElementById(`cat-${safeId}`);
        const endMarker = document.getElementById(`end-${safeId}`);
        if (heading && endMarker) {
            categoryBoundaries.push({
                id: safeId,
                headingEl: heading,
                endEl: endMarker,
                tab: tabMap.get(safeId)
            });
        }
    });

    // Scroll spy
    let lastScrollY = window.scrollY;
    let scrollDirection = 'down';
    let activeCategoryId = window.lastActiveCategory || categoryBoundaries[0]?.id || null;

    function updateActiveTab(categoryId) {
        if (!categoryId || activeCategoryId === categoryId) return;
        const tab = tabMap.get(categoryId);
        if (tab) {
            document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeCategoryId = categoryId;
            window.lastActiveCategory = categoryId;
        }
    }

    function onScroll() {
        const currentScrollY = window.scrollY;
        scrollDirection = currentScrollY > lastScrollY ? 'down' : 'up';
        lastScrollY = currentScrollY;

        const header = document.querySelector('.app-header');
        const tabs = document.querySelector('.category-tabs');
        const headerHeight = header ? header.offsetHeight : 0;
        const tabsHeight = tabs ? tabs.offsetHeight : 0;
        const stickyBottom = headerHeight + tabsHeight;

        if (scrollDirection === 'down') {
            for (let i = categoryBoundaries.length - 1; i >= 0; i--) {
                const boundary = categoryBoundaries[i];
                const headingTop = boundary.headingEl.getBoundingClientRect().top;
                if (headingTop <= stickyBottom + 10) {
                    updateActiveTab(boundary.id);
                    break;
                }
            }
        } else {
            for (let i = 0; i < categoryBoundaries.length; i++) {
                const boundary = categoryBoundaries[i];
                const endBottom = boundary.endEl.getBoundingClientRect().bottom;
                const viewportBottom = window.innerHeight;
                if (endBottom >= viewportBottom - 10 && endBottom <= viewportBottom + 10) {
                    updateActiveTab(boundary.id);
                    break;
                }
            }
        }
    }

    let ticking = false;
    const scrollHandler = function() {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                onScroll();
                ticking = false;
            });
            ticking = true;
        }
    };

    if (window.scrollListenerAttached) {
        window.removeEventListener('scroll', window.scrollHandler);
    }
    window.scrollHandler = scrollHandler;
    window.scrollListenerAttached = true;
    window.addEventListener('scroll', window.scrollHandler);

    // Set initial active tab
    setTimeout(() => {
        const header = document.querySelector('.app-header');
        const tabs = document.querySelector('.category-tabs');
        const headerHeight = header ? header.offsetHeight : 0;
        const tabsHeight = tabs ? tabs.offsetHeight : 0;
        const stickyBottom = headerHeight + tabsHeight;
        for (let i = categoryBoundaries.length - 1; i >= 0; i--) {
            const boundary = categoryBoundaries[i];
            const headingTop = boundary.headingEl.getBoundingClientRect().top;
            if (headingTop <= stickyBottom + 10) {
                updateActiveTab(boundary.id);
                break;
            }
        }
        if (!activeCategoryId && categoryBoundaries.length > 0) {
            updateActiveTab(categoryBoundaries[0].id);
        }
    }, 100);
}

// ============================================
// RENDER SIMPLE PRODUCT – with BADGE + DETAILS
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

    // Badge on image
    let badgeHtml = '';
    if (p.badge) {
        // Create a CSS class from badge text (lowercase, replace spaces with hyphens)
        const badgeClass = `badge-${p.badge.toLowerCase().replace(/\s+/g, '-')}`;
        badgeHtml = `<span class="product-badge ${badgeClass}">${p.badge}</span>`;
    }

    // Details
    let detailsHtml = '';
    if (p.details) {
        const lines = p.details.split(',').map(item => item.trim()).filter(item => item);
        detailsHtml = '<div class="product-details-text">' + 
            lines.map(line => `<span>${line}</span>`).join('') + 
            '</div>';
    }

    return `
        <div class="product-card ${isSoldOut ? 'sold-out-gray' : ''}" data-product-id="${p.id}">
            <div class="product-image-container">
                <img src="${p.image}" class="product-image" onerror="this.src='https://placehold.co/300x400?text=Sweet'">
                ${badgeHtml}
            </div>
            <div class="product-details">
                <div class="product-info">
                    <h3>${p.name}</h3>
                    ${stockBadge}
                    <span class="price">₱${p.price.toFixed(2)}</span>
                    ${detailsHtml}
                </div>
                ${isSoldOut ?
                    `<button class="add-btn disabled" disabled>⛔ Sold Out</button>` :
                    `<button class="add-btn" onclick="addSimpleToCart('${p.id}', event)">➕ Add to Cart</button>`
                }
            </div>
        </div>`;
}

// ============================================
// RENDER FLAVOR PRODUCT CARD – with BADGE + DETAILS
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

    // Badge on image
    let badgeHtml = '';
    if (p.badge) {
        const badgeClass = `badge-${p.badge.toLowerCase().replace(/\s+/g, '-')}`;
        badgeHtml = `<span class="product-badge ${badgeClass}">${p.badge}</span>`;
    }

    // Details
    let detailsHtml = '';
    if (p.details) {
        const lines = p.details.split(',').map(item => item.trim()).filter(item => item);
        detailsHtml = '<div class="product-details-text">' + 
            lines.map(line => `<span>${line}</span>`).join('') + 
            '</div>';
    }

    return `
        <div class="product-card product-card-variant ${isSoldOut ? 'sold-out-gray' : ''}" data-product-id="${p.id}">
            <div class="product-image-container">
                <img src="${p.image}" class="product-image" onerror="this.src='https://placehold.co/300x400?text=Sweet'">
                ${badgeHtml}
            </div>
            <div class="product-details">
                <div class="product-info">
                    <h3>${p.name}</h3>
                    ${stockBadge}
                    <span class="price">₱${p.price.toFixed(2)}</span>
                    ${detailsHtml}
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
// CART & TOTAL HELPERS – with shipping
// ============================================
function getSubtotal() {
    return cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
}

function getTotal() {
    return getSubtotal() + selectedShippingFee;
}

function updateUI() {
    const totalQty = cart.reduce((s, i) => s + i.qty, 0);
    const subtotal = getSubtotal();
    const total = getTotal();

    document.getElementById('cart-count').textContent = totalQty;
    document.getElementById('float-total').textContent = `₱${total.toFixed(2)}`;
    document.getElementById('modal-total').textContent = `₱${total.toFixed(2)}`;

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

    if (document.getElementById('checkout-modal').classList.contains('active')) {
        updateCheckoutSummary();
    }
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
// SHIPPING FEE HANDLERS
// ============================================
window.updateShippingFee = function() {
    const select = document.getElementById('shipping-address');
    const selected = select.value;
    if (selected) {
        const [address, fee] = selected.split('|');
        selectedShippingAddress = address;
        selectedShippingFee = parseFloat(fee);
    } else {
        selectedShippingAddress = '';
        selectedShippingFee = 0;
    }
    
    animateTotalUpdate();
    updateUI();
    if (document.getElementById('checkout-modal').classList.contains('active')) {
        updateCheckoutSummary();
    }
};

function animateTotalUpdate() {
    const totalElements = [
        document.getElementById('float-total'),
        document.getElementById('modal-total')
    ];
    totalElements.forEach(el => {
        if (el) {
            el.classList.add('total-update');
            setTimeout(() => el.classList.remove('total-update'), 400);
        }
    });
}

function updateCheckoutSummary() {
    const subtotal = getSubtotal();
    const total = getTotal();
    const shippingEl = document.getElementById('shipping-summary');
    
    if (selectedShippingAddress && document.getElementById('order-type').value === 'Delivery') {
        shippingEl.innerHTML = `
            <div class="shipping-line">
                <span>🚚 Shipping (${selectedShippingAddress}):</span>
                <span>₱${selectedShippingFee.toFixed(2)}</span>
            </div>
            <div class="shipping-line" style="font-weight:700; color:var(--primary); margin-top:8px;">
                <span>Total with shipping:</span>
                <span>₱${total.toFixed(2)}</span>
            </div>
        `;
    } else {
        shippingEl.innerHTML = '';
    }

    document.getElementById('final-summary-text').innerHTML = cart.map(i =>
        `<div class="summary-item">${i.qty}x ${i.name} = ₱${(i.price * i.qty).toFixed(2)}</div>`
    ).join('');
}

// ============================================
// VALIDATE CART AGAINST CURRENT STOCK
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
// RESET COPY BUTTON
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
// CHECKOUT & RECEIPT
// ============================================
window.openCheckout = () => {
    if (cart.length === 0) return showToast("🛒 Add some treats first!");
    toggleDeliveryFields();
    document.getElementById('cart-modal').classList.remove('active');
    document.getElementById('checkout-modal').classList.add('active');
    updateCheckoutSummary();
};

window.copyOrderDetails = () => {
    const name = document.getElementById('customer-name').value.trim();
    const landmark = document.getElementById('customer-address').value.trim();
    const type = document.getElementById('order-type').value;
    const pay = document.getElementById('payment-method').value;
    
    if (!name) return showToast("👤 Please enter your name");
    
    if (type === 'Delivery') {
        if (!selectedShippingAddress) {
            return showToast("📍 Please select your shipping address");
        }
        if (!landmark) {
            return showToast("🗺️ Please provide a landmark or delivery instructions");
        }
    }
    
    const subtotal = getSubtotal();
    const total = getTotal();

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });

    let paymentDisplay = '';
    if (pay === 'COD') paymentDisplay = 'Cash on Delivery';
    else if (pay === 'COP') paymentDisplay = 'Cash on Pickup';
    else paymentDisplay = 'GCash';

    let text = `✨ SKY SWEET TREATS ✨\n`;
    text += `════════════════\n`;

    text += `📋 **ORDER RECEIPT**\n`;
    text += `📅 ${dateStr}\n`;
    text += `⏰ ${timeStr}\n`;
    text += `🆔 #${Date.now().toString().slice(-6)}\n`;
    text += `════════════════\n`;

    text += `👤 **CUSTOMER DETAILS**\n`;
    text += `• Name: ${name}\n`;
    if (type === 'Delivery') {
        text += `• Shipping Address: ${selectedShippingAddress}\n`;
        text += `• Landmark/Instructions: ${landmark}\n`;
    }
    text += `• Order Type: ${type}\n`;
    text += `• Payment: ${paymentDisplay}\n\n`;

    if (type === 'Delivery' && selectedShippingAddress) {
        text += `🚚 **SHIPPING**\n`;
        text += `• Barangay: ${selectedShippingAddress}\n`;
        text += `• Shipping Fee: ₱${selectedShippingFee.toFixed(2)}\n\n`;
    }

    text += `════════════════\n`;
    text += `🛒 **ORDER ITEMS**\n`;
    cart.forEach(i => {
        text += `• ${i.qty}x ${i.name} = ₱${(i.price * i.qty).toFixed(2)}\n`;
    });
    text += `════════════════\n`;

    text += `💰 **PAYMENT SUMMARY**\n`;
    text += `• Subtotal: ₱${subtotal.toFixed(2)}\n`;
    if (type === 'Delivery' && selectedShippingFee > 0) {
        text += `• Shipping Fee: ₱${selectedShippingFee.toFixed(2)}\n`;
    }
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
// UI HELPERS
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
// ANIMATION HELPERS
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

window.forceStockRefresh = function() {
    loadProducts(true);
    showToast("🔄 Manual refresh triggered");
};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    renderShippingDropdown();
    loadProducts(false);
    
    document.getElementById('open-cart-btn').onclick = () => {
        document.getElementById('cart-modal').classList.add('active');
    };
    setTimeout(showRefreshPrompt, 10000);

    const orderTypeSelect = document.getElementById('order-type');
    const paymentMethodSelect = document.getElementById('payment-method');
    if (orderTypeSelect) {
        orderTypeSelect.addEventListener('change', toggleDeliveryFields);
        orderTypeSelect.addEventListener('change', resetCopyButton);
    }
    if (paymentMethodSelect) paymentMethodSelect.addEventListener('change', resetCopyButton);

    toggleDeliveryFields();

    selectedShippingAddress = '';
    selectedShippingFee = 0;

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
