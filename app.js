const CONFIG = {
    currency: "₱",
    messengerUrl: "https://m.me/100089330907916", 
    sheetUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vRBquyZXkcMOzDv_14qyXq7sQvxqQ6k1l6tWZsiqspZ_mgl88Lqx08h3wUVYu9W9-MIP-ja5f-Yvtsj/pub?gid=1109857950&single=true&output=csv" 
};

let products = [];
let cart = [];
let hasCopied = false;

// Load Data from Google Sheets
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
        console.error(error);
        document.getElementById('menu-grid').innerHTML = "Failed to load menu. Refresh page.";
    }
}

function renderMenu() {
    const grid = document.getElementById('menu-grid');
    grid.innerHTML = products.map(p => {
        const isSoldOut = p.status?.toLowerCase() === 'sold out' || p.stock <= 0;
        let badge = isSoldOut ? `<span class="tag sold-out">SOLD OUT</span>` : 
                    (p.stock <= 5 ? `<span class="tag low-stock">Only ${p.stock} left</span>` : `<span class="tag available">Available</span>`);

        return `
            <div class="product-card ${isSoldOut ? 'sold-out-gray' : ''}">
                <img src="${p.image}" class="product-image" onerror="this.src='https://placehold.co/300x400?text=Sky+Sweet'">
                <div class="product-details">
                    <h3>${p.name}</h3>
                    ${badge}
                    <span class="price">₱${p.price}</span>
                    <button class="add-btn" ${isSoldOut ? 'disabled' : `onclick="addToCart('${p.id}')"`}>
                        ${isSoldOut ? 'Unavailable' : '+ Add'}
                    </button>
                </div>
            </div>`;
    }).join('');
}

window.addToCart = (id) => {
    const p = products.find(x => x.id === id);
    const existing = cart.find(x => x.id === id);
    if (existing) {
        if(existing.qty >= p.stock) return alert("Not enough stock!");
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
    
    const container = document.getElementById('cart-items');
    container.innerHTML = cart.length === 0 ? '<p style="text-align:center;padding:20px;">Your basket is empty</p>' : cart.map(i => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid #eee;">
            <div><strong>${i.name}</strong><br>₱${i.price}</div>
            <div style="display:flex; align-items:center; gap:10px;">
                <button onclick="changeQty('${i.id}', -1)">-</button>
                <span>${i.qty}</span>
                <button onclick="changeQty('${i.id}', 1)">+</button>
            </div>
        </div>
    `).join('');
}

window.changeQty = (id, delta) => {
    const idx = cart.findIndex(i => i.id === id);
    const p = products.find(x => x.id === id);
    if (delta > 0 && cart[idx].qty >= p.stock) return alert("Limit reached!");
    cart[idx].qty += delta;
    if (cart[idx].qty <= 0) cart.splice(idx, 1);
    updateUI();
};

window.openCheckout = () => {
    const name = document.getElementById('customer-name').value;
    const addr = document.getElementById('customer-address').value;
    if(!name || !addr || cart.length === 0) return alert("Please fill name/address and add items!");
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
    const now = new Date().toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

    let text = `✨ SKY SWEET TREATS ORDER ✨\n📅 ${now}\n━━━━━━━\n👤 CUSTOMER: ${name}\n📍 ADDRESS: ${addr}\n🚚 TYPE: ${type}\n💳 PAYMENT: ${pay}\n━━━━━━━\n🛒 ITEMS:\n`;
    cart.forEach(i => text += `◽ ${i.qty}x ${i.name} - ₱${(i.price * i.qty).toFixed(2)}\n`);
    text += `━━━━━━━\n💰 TOTAL: ₱${total.toFixed(2)}\n\n`;
    
    if(pay === "GCASH") {
        text += `⚠️ REMINDER: PASTE THIS AND SEND GCASH RECEIPT!`;
    } else {
        text += `(Paste this in the chat to confirm your order)`;
    }

    navigator.clipboard.writeText(text).then(() => {
        hasCopied = true;
        document.getElementById('copy-details-btn').innerHTML = "✅ RECEIPT COPIED!";
        alert("Receipt Copied! Go to Step 2.");
    });
};

window.sendToMessenger = () => {
    if(!hasCopied) return alert("Click Step 1 First!");
    alert("Instructions: Tap message box, select PASTE, and hit SEND! 🚀");
    window.location.href = CONFIG.messengerUrl;
};

window.toggleGcashInfo = () => {
    document.getElementById('gcash-info').style.display = (document.getElementById('payment-method').value === 'GCASH') ? 'block' : 'none';
};

window.closeModal = (id) => document.getElementById(id).classList.remove('active');

function showToast(m) {
    const t = document.getElementById('toast');
    t.textContent = m; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
}

loadProducts();
