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
let refreshPromptCount = 0;        // number of times refresh prompt was shown
const MAX_REFRESH_PROMPTS = 2;     // limit to 2 per session

// ============================================
// LOAD PRODUCTS (initial + manual refresh)
// ============================================
async function loadProducts(showToastOnSuccess = true) {
    try {
        const response = await fetch(`${CONFIG.sheetUrl}&t=${Date.now()}`);
        const data = await response.text();
        const rows = data.split('\n').slice(1);
        
        const newProducts = rows.map(row => {
            const cols = row.split(',');
            return {
                id: cols[0]?.trim(),
                name: cols[1]?.trim(),
                price: parseFloat(cols[2]) || 0,
                image: cols[3]?.trim(),
                status: cols[4]?.trim(),
                stock: parseInt(cols[5]) || 0
            };
        }).filter(p => p.name);

        products = newProducts;
        renderMenu();
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
// MANUAL REFRESH PROMPT (soft call-to-action)
// ============================================
function showRefreshPrompt() {
    if (refreshPromptCount >= MAX_REFRESH_PROMPTS) return;

    const prompt = document.createElement('div');
    prompt.className = 'refresh-prompt';
    prompt.innerHTML = `
        <div class="refresh-prompt-content">
            <span class="refresh-icon">🔄</span>
            <div class="refresh-text">
                <strong>Check for Stock Updates?</strong>
                <small>We may have added new items or updated availability.</small>
            </div>
            <button class="refresh-now-btn" onclick="handleRefreshClick()">Check Now</button>
            <button class="refresh-close-btn" onclick="this.closest('.refresh-prompt').remove()">✕</button>
        </div>
    `;
    document.body.appendChild(prompt);
    refreshPromptCount++;
}

window.handleRefreshClick = function() {
    loadProducts(true);
    // Remove all visible prompts
    document.querySelectorAll('.refresh-prompt').forEach(el => el.remove());
    // Schedule next prompt only if under limit
    if (refreshPromptCount < MAX_REFRESH_PROMPTS) {
        setTimeout(showRefreshPrompt, 120000); // 2 minutes
    }
};

// ============================================
// RENDER MENU (no stock‑badge animation changes)
// ============================================
function renderMenu() {
    const grid = document.getElementById('menu-grid');
    grid.innerHTML = products.map(p => {
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
                    <div class="add-to-cart-overlay" onclick="addToCart('${p.id}', event)">
                        <span>+</span>
                    </div>
                </div>
                <div class="product-details">
                    <div class="product-info">
                        <h3>${p.name}</h3>
                        <div class="stock-badge">${stockBadge}</div>
                        <span class="price">₱${p.price.toFixed(2)}</span>
                    </div>
                    ${isSoldOut ? 
                        `<button class="add-btn disabled" disabled>⛔ Sold Out</button>` : 
                        `<button class="add-btn" onclick="addToCart('${p.id}', event)">➕ Add to Cart</button>`
                    }
                </div>
            </div>`;
    }).join('');
}

// ============================================
// CART & CHECKOUT (exactly as before – keep everything)
// ============================================
window.addToCart = (id, event) => {
    const p = products.find(x => x.id === id);
    if (!p) return showToast("❌ Product not available");
    
    if (event) {
        const button = event.currentTarget;
        const buttonRect = button.getBoundingClientRect();
        const cartBtn = document.getElementById('open-cart-btn');
        const cartRect = cartBtn.getBoundingClientRect();
        const startX = buttonRect.left + buttonRect.width / 2;
        const startY = buttonRect.top + buttonRect.height / 2;
        const endX = cartRect.left + cartRect.width / 2;
        const endY = cartRect.top + cartRect.height / 2;
        
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                createFlyingImage(p.image || 'https://placehold.co/300x400?text=Sweet', 
                                 startX + Math.random() * 20 - 10, 
                                 startY + Math.random() * 20 - 10,
                                 endX, endY);
            }, i * 100);
        }
    }

    const existing = cart.find(x => x.id === id);
    if (existing) {
        if (existing.qty >= p.stock) return showToast(`⚠️ Only ${p.stock} ${p.name} available!`);
        existing.qty++;
    } else {
        if (p.stock <= 0) return showToast("⛔ Sold out!");
        cart.push({...p, qty: 1});
    }
    updateUI();
    showToast(`✅ Added ${p.name}`);
    animateCart();
};

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
    const p = products.find(x => x.id === id);
    if (!p) { cart.splice(idx, 1); updateUI(); return; }
    if (delta > 0) {
        if (cart[idx].qty >= p.stock) return showToast(`⚠️ Only ${p.stock} ${p.name} available!`);
        cart[idx].qty += delta;
    } else {
        cart[idx].qty += delta;
        if (cart[idx].qty <= 0) cart.splice(idx, 1);
    }
    updateUI();
};

function validateCartAgainstNewStock() {
    let changed = false;
    const removed = [];
    for (let i = cart.length - 1; i >= 0; i--) {
        const item = cart[i];
        const prod = products.find(p => p.id === item.id);
        if (!prod || prod.stock <= 0) {
            removed.push(item.name);
            cart.splice(i, 1);
            changed = true;
        } else if (item.qty > prod.stock) {
            item.qty = prod.stock;
            changed = true;
            showToast(`⚠️ ${prod.name} quantity reduced to ${prod.stock}`);
        }
    }
    if (changed) {
        updateUI();
        if (removed.length) showToast(`❌ ${removed.length} item(s) removed – no longer available`, 4000);
    }
}

// ============================================
// CHECKOUT & RECEIPT (with updated contact time)
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
    text += `══════════════════════════════\n\n`;
    text += `📋 **ORDER RECEIPT**\n`;
    text += `📅 ${dateStr}\n`;
    text += `⏰ ${timeStr}\n`;
    text += `🆔 #${Date.now().toString().slice(-6)}\n\n`;
    text += `══════════════════════════════\n\n`;
    text += `👤 **CUSTOMER DETAILS**\n`;
    text += `• Name: ${name}\n`;
    text += `• Address: ${addr}\n`;
    text += `• Order Type: ${type}\n`;
    text += `• Payment: ${pay}\n\n`;
    text += `══════════════════════════════\n\n`;
    text += `🛒 **ORDER ITEMS**\n`;
    cart.forEach(i => { text += `• ${i.qty}x ${i.name} = ₱${(i.price * i.qty).toFixed(2)}\n`; });
    text += `\n══════════════════════════════\n\n`;
    text += `💰 **PAYMENT SUMMARY**\n`;
    text += `• Subtotal: ₱${total.toFixed(2)}\n`;
    text += `• Total Amount: ₱${total.toFixed(2)}\n\n`;
    text += `⚠️ **IMPORTANT REMINDERS**\n`;
    if (pay === 'GCASH') {
        text += `\n💳 **GCASH PAYMENT REQUIRED**\n`;
        text += `1. Send payment to: ${CONFIG.businessPhone}\n`;
        text += `2. Account Name: K** M.\n`;
        text += `3. Send SCREENSHOT of payment receipt\n`;
        text += `4. Order will only be processed after payment confirmation\n\n`;
    }
    text += `📞 **CONTACT INFORMATION**\n`;
    text += `• Messenger: Sky Sweet Treats Page\n`;
    text += `• Phone: ${CONFIG.businessPhone}\n`;
    text += `• Hours: ${CONFIG.businessHours}\n\n`;
    text += `══════════════════════════════\n`;
    text += `Thank you for your order! 🎉\n`;
    text += `We'll contact you within 5-10 minutes.`;   // <--- UPDATED

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
    if (pay === 'GCASH') msg += "4. **SEND SCREENSHOT** of your GCash payment\n\nYour order will be processed after payment confirmation.";
    else msg += "\nWe'll confirm your order within 5-10 minutes.";   // <--- UPDATED
    if (confirm(msg)) {
        window.open(CONFIG.messengerUrl, '_blank');
        setTimeout(() => {
            document.getElementById('copy-details-btn').innerHTML = "1. Copy Order Details 📋";
            document.getElementById('copy-details-btn').style.background = "";
            hasCopied = false;
        }, 5000);
    }
};

// ============================================
// UI HELPERS (toast, modal, etc.)
// ============================================
window.toggleGcashInfo = () => {
    const isGcash = document.getElementById('payment-method').value === 'GCASH';
    document.getElementById('gcash-info').style.display = isGcash ? 'block' : 'none';
    if (isGcash) showToast("💳 GCash selected: Don't forget to send payment receipt!", 3000);
};

window.closeModal = (id) => {
    document.getElementById(id).classList.remove('active');
    if (id === 'checkout-modal') {
        const btn = document.getElementById('copy-details-btn');
        btn.innerHTML = "1. Copy Order Details 📋";
        btn.style.background = "";
        hasCopied = false;
    }
};

window.downloadQR = () => showToast("📱 GCash QR instructions sent to Messenger");

function showToast(message, duration = 2000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
}

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Load menu first
    loadProducts(false);  // no toast on initial load
    
    // Cart button
    document.getElementById('open-cart-btn').onclick = () => {
        document.getElementById('cart-modal').classList.add('active');
    };
    
    // Show refresh prompt after 10 seconds, then again after 2 minutes (max 2 times)
    setTimeout(showRefreshPrompt, 10000);
    
    // Input validation
    document.getElementById('customer-name')?.addEventListener('input', function() {
        if (this.value.trim()) this.style.borderColor = '#4CAF50';
    });
    document.getElementById('customer-address')?.addEventListener('input', function() {
        if (this.value.trim()) this.style.borderColor = '#4CAF50';
    });
});

// Admin refresh button (Ctrl+Shift+R) – optional, keep if you want
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        loadProducts(true);
        showToast('🔄 Manual refresh triggered');
    }
});
