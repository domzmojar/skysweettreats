const CONFIG = {
    currency: "₱",
    messengerUrl: "https://m.me/100089330907916", 
    sheetUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRBquyZXkcMOzDv_14qyXq7sQvxqQ6k1l6tWZsiqspZ_mgl88Lqx08h3wUVYu9W9-MIP-ja5f-Yvtsj/pub?gid=1109857950&single=true&output=csv",
    businessPhone: "09264569430",
    businessHours: "8:00 AM - 9:00 PM",
    // Smart detection settings
    quickCheckInterval: 60000, // Check every 1 minute when active
    slowCheckInterval: 300000, // Check every 5 minutes when less active
    idleCheckInterval: 1800000 // Check every 30 minutes when idle
};

let products = [];
let cart = [];
let hasCopied = false;
let lastDataHash = null;
let isUserActive = true;
let checkAttempts = 0;

// ============================================
// SMART STOCK CHANGE DETECTION
// ============================================
function generateDataHash(data) {
    const lines = data.split('\n');
    if (lines.length < 3) return 'empty';
    
    const firstRow = lines[1] || '';
    const lastRow = lines[lines.length - 2] || '';
    const rowCount = lines.length - 1;
    
    return btoa(`${firstRow.slice(0, 30)}${lastRow.slice(0, 30)}${rowCount}`)
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 50);
}

async function checkForChanges() {
    try {
        const headResponse = await fetch(CONFIG.sheetUrl, { 
            method: 'HEAD',
            cache: 'no-cache'
        });
        
        const lastModified = headResponse.headers.get('last-modified');
        const contentLength = headResponse.headers.get('content-length');
        const headerFingerprint = `${lastModified || ''}|${contentLength || ''}`;
        const storedFingerprint = localStorage.getItem('sheet_fingerprint');
        
        if (storedFingerprint === headerFingerprint) {
            console.log('📊 No changes detected');
            return false;
        }
        
        const response = await fetch(`${CONFIG.sheetUrl}&t=${Date.now()}`, {
            cache: 'no-cache'
        });
        
        if (!response.ok) throw new Error('Fetch failed');
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let data = '';
        let bytesRead = 0;
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            data += decoder.decode(value);
            bytesRead += value.length;
            if (bytesRead > 2048) break;
        }
        
        reader.cancel();
        const newHash = generateDataHash(data);
        
        if (lastDataHash === newHash) {
            localStorage.setItem('sheet_fingerprint', headerFingerprint);
            return false;
        }
        
        lastDataHash = newHash;
        localStorage.setItem('sheet_fingerprint', headerFingerprint);
        console.log('🔄 Changes detected');
        return true;
        
    } catch (error) {
        console.log('Change check error:', error.message);
        return false;
    }
}

// ============================================
// CORE FUNCTIONS
// ============================================
async function loadProducts(forceRefresh = false) {
    try {
        if (!forceRefresh && checkAttempts > 0) {
            const hasChanges = await checkForChanges();
            if (!hasChanges) {
                updateLastCheckedTime();
                return;
            }
        }
        
        console.log('📥 Loading fresh product data...');
        const response = await fetch(`${CONFIG.sheetUrl}&t=${Date.now()}`);
        const data = await response.text();
        
        if (lastDataHash === null) {
            lastDataHash = generateDataHash(data);
            localStorage.setItem('sheet_fingerprint', 'initial');
        }
        
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
        lastUpdateTime = new Date();
        
        renderMenu();
        validateCartAgainstNewStock();
        
        if (checkAttempts > 0) {
            showStockUpdatedNotification();
        }
        
        checkAttempts++;
        updateLastCheckedTime();
        
    } catch (error) {
        console.error('Error loading products:', error);
        if (products.length === 0) {
            document.getElementById('menu-grid').innerHTML = `
                <div class='error-message'>
                    <p>📋 Menu is updating...</p>
                    <p>Please refresh in a minute.</p>
                </div>`;
        }
    }
}

// ============================================
// ANIMATION SYSTEM - ADD TO CART FLYING EFFECT
// ============================================
function createFlyingImage(imageSrc, startX, startY, endX, endY) {
    const flyingImg = document.createElement('div');
    flyingImg.className = 'flying-item';
    
    // Set starting position
    flyingImg.style.left = `${startX}px`;
    flyingImg.style.top = `${startY}px`;
    
    // Create image inside
    flyingImg.innerHTML = `<img src="${imageSrc}" alt="Flying item">`;
    document.body.appendChild(flyingImg);
    
    // Force reflow
    flyingImg.offsetWidth;
    
    // Animate to cart
    flyingImg.style.transform = `translate(${endX - startX}px, ${endY - startY}px) scale(0.3)`;
    flyingImg.style.opacity = '0.5';
    
    // Remove after animation
    setTimeout(() => {
        flyingImg.style.transition = 'all 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
        flyingImg.style.transform = `translate(${endX - startX}px, ${endY - startY}px) scale(0.1)`;
        flyingImg.style.opacity = '0';
        
        setTimeout(() => {
            if (flyingImg.parentNode) {
                flyingImg.parentNode.removeChild(flyingImg);
            }
        }, 800);
    }, 100);
}

// Enhanced add to cart with animation
window.addToCart = (id, event) => {
    const p = products.find(x => x.id === id);
    if (!p) {
        showToast("❌ Product not available");
        return;
    }
    
    // Get positions for animation
    if (event) {
        const button = event.currentTarget;
        const buttonRect = button.getBoundingClientRect();
        
        // Get cart position
        const cartBtn = document.getElementById('open-cart-btn');
        const cartRect = cartBtn.getBoundingClientRect();
        
        // Calculate positions
        const startX = buttonRect.left + buttonRect.width / 2;
        const startY = buttonRect.top + buttonRect.height / 2;
        const endX = cartRect.left + cartRect.width / 2;
        const endY = cartRect.top + cartRect.height / 2;
        
        // Create multiple flying items for better effect
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                createFlyingImage(p.image || 'https://placehold.co/300x400?text=Sweet', 
                                 startX + Math.random() * 20 - 10, 
                                 startY + Math.random() * 20 - 10,
                                 endX, 
                                 endY);
            }, i * 100);
        }
    }
    
    const existing = cart.find(x => x.id === id);
    if (existing) {
        if(existing.qty >= p.stock) {
            showToast(`⚠️ Only ${p.stock} ${p.name} available!`);
            return;
        }
        existing.qty++;
    } else {
        if(p.stock <= 0) {
            showToast("⛔ This item is sold out!");
            return;
        }
        cart.push({...p, qty: 1});
    }
    
    updateUI();
    showToast(`✅ Added ${p.name}`);
    animateCart();
};

function animateCart() {
    const cartBtn = document.getElementById('open-cart-btn');
    const cartCount = document.getElementById('cart-count');
    
    // Bounce animation
    cartBtn.style.transform = 'translateX(-50%) scale(1.15)';
    cartCount.style.transform = 'scale(1.5)';
    cartCount.style.backgroundColor = '#FF9800';
    
    setTimeout(() => {
        cartBtn.style.transform = 'translateX(-50%) scale(1)';
        cartCount.style.transform = 'scale(1)';
        
        setTimeout(() => {
            cartCount.style.backgroundColor = '';
        }, 300);
    }, 300);
}

// ============================================
// SMART SCHEDULER & ACTIVITY TRACKING
// ============================================
function startSmartScheduler() {
    let nextCheckDelay = CONFIG.quickCheckInterval;
    
    function scheduleNextCheck() {
        setTimeout(async () => {
            if (document.hidden) {
                scheduleNextCheck();
                return;
            }
            
            if (isUserActive) {
                nextCheckDelay = CONFIG.quickCheckInterval;
            } else if (checkAttempts > 10) {
                nextCheckDelay = CONFIG.slowCheckInterval;
            } else {
                nextCheckDelay = CONFIG.idleCheckInterval;
            }
            
            await loadProducts();
            scheduleNextCheck();
            
        }, nextCheckDelay);
    }
    
    scheduleNextCheck();
}

function trackUserActivity() {
    let activityTimeout;
    
    function resetActivityTimer() {
        isUserActive = true;
        clearTimeout(activityTimeout);
        
        activityTimeout = setTimeout(() => {
            isUserActive = false;
        }, 180000);
    }
    
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    events.forEach(event => {
        document.addEventListener(event, resetActivityTimer, { passive: true });
    });
    
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            setTimeout(() => loadProducts(), 2000);
            resetActivityTimer();
        }
    });
    
    resetActivityTimer();
}

// ============================================
// UI FUNCTIONS
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

function updateUI() {
    const totalQty = cart.reduce((s, i) => s + i.qty, 0);
    const totalVal = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    
    document.getElementById('cart-count').textContent = totalQty;
    document.getElementById('float-total').textContent = `₱${totalVal.toFixed(2)}`;
    document.getElementById('modal-total').textContent = `₱${totalVal.toFixed(2)}`;
    
    const cartContainer = document.getElementById('cart-items');
    if (cart.length === 0) {
        cartContainer.innerHTML = '<div class="empty-cart"><p>🛒 Your cart is empty</p><p class="empty-hint">Add some sweet treats! 🍰</p></div>';
    } else {
        cartContainer.innerHTML = cart.map(i => `
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
}

window.changeQty = (id, delta) => {
    const idx = cart.findIndex(i => i.id === id);
    const p = products.find(x => x.id === id);
    
    if (!p) {
        showToast("❌ Product no longer available");
        cart.splice(idx, 1);
        updateUI();
        return;
    }
    
    if (delta > 0) {
        if (cart[idx].qty >= p.stock) {
            showToast(`⚠️ Only ${p.stock} ${p.name} available!`);
            return;
        }
        cart[idx].qty += delta;
    } else {
        cart[idx].qty += delta;
        if (cart[idx].qty <= 0) cart.splice(idx, 1);
    }
    updateUI();
};

// ============================================
// CHECKOUT FLOW
// ============================================
window.openCheckout = () => {
    const name = document.getElementById('customer-name').value.trim();
    const addr = document.getElementById('customer-address').value.trim();
    
    if(cart.length === 0) {
        showToast("🛒 Add some treats first!");
        return;
    }
    if(!name) {
        showToast("👤 Please enter your name");
        document.getElementById('customer-name').focus();
        return;
    }
    if(!addr) {
        showToast("📍 Please enter your address");
        document.getElementById('customer-address').focus();
        return;
    }
    
    document.getElementById('cart-modal').classList.remove('active');
    document.getElementById('checkout-modal').classList.add('active');
    
    const summaryHTML = cart.map(i => 
        `<div class="summary-item">${i.qty}x ${i.name} = ₱${(i.price * i.qty).toFixed(2)}</div>`
    ).join('');
    document.getElementById('final-summary-text').innerHTML = summaryHTML;
};

window.copyOrderDetails = () => {
    const name = document.getElementById('customer-name').value.trim();
    const addr = document.getElementById('customer-address').value.trim();
    const type = document.getElementById('order-type').value;
    const pay = document.getElementById('payment-method').value;
    const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-PH', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        weekday: 'long'
    });
    const timeStr = now.toLocaleTimeString('en-PH', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
    });
    
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
    cart.forEach(i => {
        text += `• ${i.qty}x ${i.name} = ₱${(i.price * i.qty).toFixed(2)}\n`;
    });
    
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
    text += `We'll contact you within 5-10 minutes.`;

    navigator.clipboard.writeText(text).then(() => {
        hasCopied = true;
        const btn = document.getElementById('copy-details-btn');
        btn.innerHTML = "✅ Order Details Copied!";
        btn.style.background = "#28a745";
        
        if (pay === 'GCASH') {
            showToast("📋 Order copied! Don't forget to send GCash receipt!", 4000);
        } else {
            showToast("📋 Order details copied to clipboard!", 2000);
        }
    }).catch(err => {
        console.error('Failed to copy:', err);
        showToast("❌ Failed to copy. Please try again.");
    });
};

window.sendToMessenger = () => {
    if(!hasCopied) {
        showToast("⚠️ Please click '1. Copy Order Details' first!");
        return;
    }
    
    const pay = document.getElementById('payment-method').value;
    let confirmMsg = "📱 **Ready to Send Your Order?**\n\n";
    
    if (pay === 'GCASH') {
        confirmMsg += "✅ Order details copied!\n\n";
        confirmMsg += "**NEXT STEPS:**\n";
        confirmMsg += "1. We'll open Messenger now\n";
        confirmMsg += "2. **PASTE** the order details\n";
        confirmMsg += "3. **SEND** the message\n";
        confirmMsg += "4. **SEND SCREENSHOT** of your GCash payment\n\n";
        confirmMsg += "Your order will be processed after payment confirmation.";
    } else {
        confirmMsg += "✅ Order details copied!\n\n";
        confirmMsg += "**NEXT STEPS:**\n";
        confirmMsg += "1. We'll open Messenger now\n";
        confirmMsg += "2. **PASTE** the order details\n";
        confirmMsg += "3. **SEND** the message\n\n";
        confirmMsg += "We'll confirm your order within 5-10 minutes.";
    }
    
    if (confirm(confirmMsg)) {
        window.open(CONFIG.messengerUrl, '_blank');
        setTimeout(() => {
            const btn = document.getElementById('copy-details-btn');
            btn.innerHTML = "1. Copy Order Details 📋";
            btn.style.background = "";
            hasCopied = false;
        }, 5000);
    }
};

// ============================================
// HELPER FUNCTIONS
// ============================================
window.toggleGcashInfo = () => {
    const isGcash = document.getElementById('payment-method').value === 'GCASH';
    const gcashInfo = document.getElementById('gcash-info');
    gcashInfo.style.display = isGcash ? 'block' : 'none';
    
    if (isGcash) {
        showToast("💳 GCash selected: Don't forget to send payment receipt!", 3000);
    }
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

window.downloadQR = () => {
    showToast("📱 GCash QR instructions sent to Messenger");
};

function showStockUpdatedNotification() {
    const notification = document.createElement('div');
    notification.className = 'stock-update-notification';
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">🔄</span>
            <div class="notification-text">
                <strong>Stock Updated</strong>
                <small>Menu refreshed with latest availability</small>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">&times;</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

function updateLastCheckedTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    const timeElement = document.querySelector('.last-checked-time');
    if (timeElement) {
        timeElement.textContent = `Updated: ${timeString}`;
    }
}

function validateCartAgainstNewStock() {
    let cartModified = false;
    const removedItems = [];
    
    for (let i = cart.length - 1; i >= 0; i--) {
        const cartItem = cart[i];
        const product = products.find(p => p.id === cartItem.id);
        
        if (!product || product.stock <= 0) {
            removedItems.push(cartItem.name);
            cart.splice(i, 1);
            cartModified = true;
        } else if (cartItem.qty > product.stock) {
            cartItem.qty = product.stock;
            cartModified = true;
            showToast(`⚠️ ${product.name} quantity reduced to ${product.stock} available`);
        }
    }
    
    if (cartModified) {
        updateUI();
        
        if (removedItems.length > 0) {
            showToast(
                `❌ ${removedItems.length} item(s) removed - no longer available`,
                4000
            );
        }
    }
}

function showToast(message, duration = 2000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
}

// ============================================
// ADMIN FUNCTIONS
// ============================================
window.forceStockRefresh = () => {
    if (confirm("Force refresh stock from Google Sheets?")) {
        showToast("🔄 Forcing stock refresh...");
        lastDataHash = null;
        localStorage.removeItem('sheet_fingerprint');
        loadProducts(true);
    }
};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Initial load
    loadProducts();
    
    // Start activity tracking
    trackUserActivity();
    
    // Start smart scheduler
    startSmartScheduler();
    
    // Add last checked time to floating cart
    setTimeout(() => {
        const cartElement = document.querySelector('.floating-cart');
        if (cartElement && !cartElement.querySelector('.last-checked-time')) {
            const timeSpan = document.createElement('small');
            timeSpan.className = 'last-checked-time';
            timeSpan.style.cssText = `
                font-size: 0.7rem;
                opacity: 0.7;
                margin-left: 10px;
                display: block;
                text-align: center;
                margin-top: 2px;
            `;
            timeSpan.textContent = 'Updated: Just now';
            cartElement.appendChild(timeSpan);
        }
    }, 1000);
    
    // Event listeners
    document.getElementById('open-cart-btn').onclick = () => {
        document.getElementById('cart-modal').classList.add('active');
    };
    
    // Add input validation
    document.getElementById('customer-name').addEventListener('input', function() {
        if (this.value.trim().length > 0) {
            this.style.borderColor = '#4CAF50';
        }
    });
    
    document.getElementById('customer-address').addEventListener('input', function() {
        if (this.value.trim().length > 0) {
            this.style.borderColor = '#4CAF50';
        }
    });
});

// Admin access key
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        const adminBtn = document.querySelector('.admin-refresh-btn');
        if (adminBtn) {
            adminBtn.style.display = 'flex';
            showToast('🛠️ Admin refresh enabled for 10 seconds');
            
            setTimeout(() => {
                adminBtn.style.display = 'none';
            }, 10000);
        }
    }
});
