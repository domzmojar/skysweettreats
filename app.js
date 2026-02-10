const CONFIG = {
    currency: "₱",
    // Direct link to your Page's Messenger chat
    messengerUrl: "https://m.me/100089330907916", 
    // Paste your Google Sheet CSV Link below
    sheetUrl: "PASTE_YOUR_CSV_LINK_HERE" 
};

let products = [];
let cart = [];
let hasCopied = false;

// 1. Fetch products from Google Sheets
async function loadProducts() {
    try {
        const response = await fetch(CONFIG.sheetUrl);
        const data = await response.text();
        const rows = data.split('\n').slice(1);
        
        products = rows.map(row => {
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

        renderMenu();
    } catch (error) {
        console.error("Error loading products:", error);
        document.getElementById('menu-grid').innerHTML = "<p>Menu updating... Please refresh.</p>";
    }
}

// 2. Render Menu with Stock Badges
function renderMenu() {
    const grid = document.getElementById('menu-grid');
    grid.innerHTML = products.map(p => {
        const isSoldOut = p.status?.toLowerCase() === 'sold out' || p.stock <= 0;
        
        let stockBadge = '';
        if (isSoldOut) {
            stockBadge = `<span class="tag sold-out">SOLD OUT</span>`;
        } else if (p.stock <= 5) {
            stockBadge = `<span class="tag low-stock">Only ${p.stock} left!</span>`;
        } else {
            stockBadge = `<span class="tag available">In Stock</span>`;
        }

        return `
            <div class="product-card ${isSoldOut ? 'sold-out-gray' : ''}">
                <img src="${p.image}" class="product-image" onerror="this.src='https://placehold.co/300x400?text=Sky+Sweet'">
                <div class="product-details">
                    <div class="product-info">
                        <h3>${p.name}</h3>
                        ${stockBadge}
                        <span class="price">₱${p.price}</span>
                    </div>
                    ${isSoldOut ? 
                        `<button class="add-btn disabled" disabled>Unavailable</button>` : 
                        `<button class="add-btn" onclick="addToCart('${p.id}')">+ Add</button>`
                    }
                </div>
            </div>`;
    }).join('');
}

// 3. Cart Logic
window.addToCart = (id) => {
    const p = products.find(x => x.id === id);
    const existing = cart.find(x => x.id === id);
    if (existing) {
        if(existing.qty >= p.stock) return alert(`Sorry, we only have ${p.stock} left!`);
        existing.qty++;
    } else {
        cart.push({...p, qty: 1});
    }
    updateUI();
    showToast(`Added ${p.name}`);
};

function updateUI() {
    const totalQty = cart.reduce((s, i) => s + i.qty, 0);
    const totalVal = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    document.getElementById('cart-count').textContent = totalQty;
    document.getElementById('float-total').textContent = `₱${totalVal.toFixed(2)}`;
    document.getElementById('modal-total').textContent = `₱${totalVal.toFixed(2)}`;
    
    const cartContainer = document.getElementById('cart-items');
    cartContainer.innerHTML = cart.length === 0 ? '<p style="text-align:center;">Empty Cart</p>' : cart.map(i => `
        <div class="cart-item">
            <div><strong>${i.name}</strong><br><small>₱${i.price} each</small></div>
            <div style="display:flex; align-items:center; gap:10px;">
                <button class="qty-btn" onclick="changeQty('${i.id}', -1)">-</button>
                <span>${i.qty}</span>
                <button class="qty-btn" onclick="changeQty('${i.id}', 1)">+</button>
            </div>
        </div>
    `).join('');
}

window.changeQty = (id, delta) => {
    const idx = cart.findIndex(i => i.id === id);
    const p = products.find(x => x.id === id);
    if (delta > 0 && cart[idx].qty >= p.stock) return alert("No more stock!");
    cart[idx].qty += delta;
    if (cart[idx].qty <= 0) cart.splice(idx, 1);
    updateUI();
};

// 4. Upgraded Receipt Generation
window.copyOrderDetails = () => {
    const name = document.getElementById('customer-name').value.trim();
    const addr = document.getElementById('customer-address').value.trim();
    const type = document.getElementById('order-type').value;
    const pay = document.getElementById('payment-method').value;
    const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    
    if(!name || !addr) return alert("Please enter your name and address!");

    // Timestamp for Receipt
    const now = new Date();
    const timestamp = now.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

    let text = `✨ SKY SWEET TREATS ORDER ✨\n`;
    text += `📅 ${timestamp}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    text += `👤 CUSTOMER: ${name}\n`;
    text += `📍 ADDRESS: ${addr}\n`;
    text += `🚚 METHOD: ${type}\n`;
    text += `💳 PAYMENT: ${pay}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    
    text += `🛒 ORDER SUMMARY:\n`;
    cart.forEach(i => {
        text += `◽ ${i.qty}x ${i.name} ....... ₱${(i.price * i.qty).toFixed(2)}\n`;
    });
    
    text += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💰 TOTAL AMOUNT: ₱${total.toFixed(2)}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    if (pay === "GCASH") {
        text += `📝 INSTRUCTION FOR GCASH:\n`;
        text += `1. Please PASTE this order first.\n`;
        text += `2. SEND your GCash Receipt screenshot.\n`;
        text += `⚠️ PLEASE SEND THE GCASH RECEIPT! ✅\n`;
        text += `\nRef No: _________________`;
    } else {
        text += `👉 Please PASTE this to our chat to confirm your order!`;
    }

    navigator.clipboard.writeText(text).then(() => {
        hasCopied = true;
        const btn = document.getElementById('copy-details-btn');
        btn.innerHTML = "✅ RECEIPT COPIED!";
        btn.style.background = "#28a745";
        alert("Receipt & Timestamp Copied! 📋");
    });
};

window.sendToMessenger = () => {
    if(!hasCopied) return alert("⚠️ Please click '1. Copy Order Details' first!");
    alert("ORDER COPIED! 📋\n\n1. The chat will open now.\n2. Tap the message box and select PASTE.\n3. Hit SEND! 🚀");
    window.location.href = CONFIG.messengerUrl;
};

// ... existing UI helpers (closeModal, toggleGcashInfo, showToast) ...
loadProducts();
