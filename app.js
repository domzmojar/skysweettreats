const CONFIG = {
    currency: "₱",
    // 1. UPDATE THIS TO YOUR FACEBOOK PAGE LINK
    messengerUrl: "https://m.me/100089330907916", 
    // 2. PASTE YOUR PUBLISHED GOOGLE SHEET CSV LINK HERE
    sheetUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRBquyZXkcMOzDv_14qyXq7sQvxqQ6k1l6tWZsiqspZ_mgl88Lqx08h3wUVYu9W9-MIP-ja5f-Yvtsj/pub?gid=1109857950&single=true&output=csv" 
};

let products = [];
let cart = [];
let hasCopied = false;

// Initialize App: Fetch data from Google Sheets
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
        document.getElementById('menu-grid').innerHTML = "<p style='text-align:center; padding:20px;'>Menu is updating... please refresh in a minute.</p>";
    }
}

// Render the Menu with Live Stock Badges
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
            stockBadge = `<span class="tag available">${p.stock} in stock</span>`;
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
                        `<button class="add-btn disabled" disabled>Not Available</button>` : 
                        `<button class="add-btn" onclick="addToCart('${p.id}')">+ Add</button>`
                    }
                </div>
            </div>`;
    }).join('');
}

// Cart Logic
window.addToCart = (id) => {
    const p = products.find(x => x.id === id);
    const existing = cart.find(x => x.id === id);
    if (existing) {
        if(existing.qty >= p.stock) return ("Sorry, we only have " + p.stock + " left!");
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
    cartContainer.innerHTML = cart.length === 0 ? '<p style="text-align:center;">Your cart is empty</p>' : cart.map(i => `
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
    if (delta > 0 && cart[idx].qty >= p.stock) return ("No more stock available!");
    cart[idx].qty += delta;
    if (cart[idx].qty <= 0) cart.splice(idx, 1);
    updateUI();
};

// Checkout & Copy Flow
window.openCheckout = () => {
    const name = document.getElementById('customer-name').value.trim();
    const addr = document.getElementById('customer-address').value.trim();
    if(cart.length === 0) return ("Add some treats first!");
    if(!name || !addr) return ("Please provide your name and address.");
    
    document.getElementById('cart-modal').classList.remove('active');
    document.getElementById('checkout-modal').classList.add('active');
    document.getElementById('final-summary-text').innerHTML = cart.map(i => `• ${i.qty}x ${i.name}`).join('<br>');
};

window.copyOrderDetails = () => {
    const name = document.getElementById('customer-name').value;
    const addr = document.getElementById('customer-address').value;
    const type = document.getElementById('order-type').value;
    const pay = document.getElementById('payment-method').value;
    const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    
    let text = `🛒 SKY SWEET TREATS ORDER\n👤 Name: ${name}\n📍 Addr: ${addr}\n🚚 Type: ${type}\n💳 Pay: ${pay}\n----------\n`;
    cart.forEach(i => text += `• ${i.qty}x ${i.name}\n`);
    text += `----------\n💰 TOTAL: ₱${total.toFixed(2)}`;

    navigator.clipboard.writeText(text).then(() => {
        hasCopied = true;
        const btn = document.getElementById('copy-details-btn');
        btn.innerHTML = "✅ Details Copied!";
        btn.style.background = "#28a745";
    });
};

window.sendToMessenger = () => {
    if(!hasCopied) return alert("⚠️ Please click '1. Copy Order Details' first!");
    alert("Order details copied! 📋\n\n1. The chat will open now.\n2. Long-press (Hold) the message box.\n3. Select 'PASTE' and hit SEND! 🚀");
    window.location.href = CONFIG.messengerUrl;
};

// UI Helpers
window.toggleGcashInfo = () => {
    const isGcash = document.getElementById('payment-method').value === 'GCASH';
    document.getElementById('gcash-info').style.display = isGcash ? 'block' : 'none';
};

window.closeModal = (id) => document.getElementById(id).classList.remove('active');
document.getElementById('open-cart-btn').onclick = () => document.getElementById('cart-modal').classList.add('active');

function showToast(m) {
    const t = document.getElementById('toast');
    t.textContent = m; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
}

loadProducts();




