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

/* ---------- HELPERS ---------- */
function getTimestamp() {
    const now = new Date();
    return now.toLocaleString('en-PH', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}

/* ---------- LOAD PRODUCTS ---------- */
async function loadProducts() {
    try {
        const res = await fetch(CONFIG.sheetUrl);
        const text = await res.text();
        const rows = text.split('\n').slice(1);

        products = rows.map(r => {
            const c = r.split(',');
            return {
                id: c[0],
                name: c[1],
                price: Number(c[2]),
                image: c[3],
                status: c[4],
                stock: Number(c[5])
            };
        }).filter(p => p.name);

        renderMenu();
    } catch {
        document.getElementById('menu-grid').innerHTML =
            "<p style='text-align:center'>Menu temporarily unavailable</p>";
    }
}

/* ---------- MENU ---------- */
function renderMenu() {
    const grid = document.getElementById('menu-grid');
    grid.innerHTML = products.map(p => {
        const soldOut = p.stock <= 0;
        return `
        <div class="product-card ${soldOut ? 'sold-out-gray' : ''}">
            <img src="${p.image}" class="product-image">
            <div class="product-details">
                <h3>${p.name}</h3>
                <span class="price">₱${p.price}</span>
                <button class="add-btn ${soldOut ? 'disabled' : ''}"
                    ${soldOut ? 'disabled' : `onclick="addToCart('${p.id}')"`}>
                    ${soldOut ? 'Sold Out' : '+ Add'}
                </button>
            </div>
        </div>`;
    }).join('');
}

/* ---------- CART ---------- */
window.addToCart = id => {
    const p = products.find(x => x.id === id);
    const item = cart.find(x => x.id === id);
    if (item) item.qty++;
    else cart.push({ ...p, qty: 1 });
    updateUI();
};

function updateUI() {
    const qty = cart.reduce((s, i) => s + i.qty, 0);
    const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

    document.getElementById('cart-count').textContent = qty;
    document.getElementById('float-total').textContent = `₱${total.toFixed(2)}`;
    document.getElementById('modal-total').textContent = `₱${total.toFixed(2)}`;

    document.getElementById('cart-items').innerHTML = cart.map(i => `
        <div class="cart-item">
            <strong>${i.qty}× ${i.name}</strong>
            <span>₱${(i.qty * i.price).toFixed(2)}</span>
        </div>
    `).join('');
}

/* ---------- CHECKOUT ---------- */
window.openCheckout = () => {
    if (!cart.length) return alert("Cart is empty");
    document.getElementById('cart-modal').classList.remove('active');
    document.getElementById('checkout-modal').classList.add('active');

    document.getElementById('final-summary-text').innerHTML =
        cart.map(i => `• ${i.qty}× ${i.name}`).join('<br>');
};

window.copyOrderDetails = () => {
    const name = customer-name.value;
    const addr = customer-address.value;
    const type = order-type.value;
    const pay = payment-method.value;
    const time = getTimestamp();

    let receipt = `
🧾 SKY SWEET TREATS
━━━━━━━━━━━━━━━━
👤 Name: ${name}
📍 Address: ${addr}
🚚 Order: ${type}
💳 Payment: ${pay}
🕒 Time: ${time}
━━━━━━━━━━━━━━━━
`;

    cart.forEach(i => receipt += `✅ ${i.qty}× ${i.name}\n`);

    const total = cart.reduce((s, i) => s + i.qty * i.price, 0);
    receipt += `━━━━━━━━━━━━━━━━\n💰 TOTAL: ₱${total.toFixed(2)}\n`;

    if (pay === 'GCASH') {
        receipt += `
⚠️ IMPORTANT
Please send your GCASH PAYMENT RECEIPT here to confirm your order.
`;
    }

    navigator.clipboard.writeText(receipt.trim());
    hasCopied = true;

    const btn = document.getElementById('copy-details-btn');
    btn.textContent = "✅ Copied";
    btn.style.background = "#28a745";
};

window.sendToMessenger = () => {
    if (!hasCopied) return alert("Please copy order details first");
    window.location.href = CONFIG.messengerUrl;
};

/* ---------- UI ---------- */
window.toggleGcashInfo = () => {
    document.getElementById('gcash-info').style.display =
        payment-method.value === 'GCASH' ? 'block' : 'none';
};

window.closeModal = id => document.getElementById(id).classList.remove('active');
document.getElementById('open-cart-btn').onclick =
    () => document.getElementById('cart-modal').classList.add('active');

loadProducts();
