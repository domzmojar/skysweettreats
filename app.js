const CONFIG = {
    currency: "₱",
    messengerUrl: "https://www.facebook.com/profile.php?id=100089330907916", // Update this!
};

const products = [
    { id: 1, name: "Overload Cheesy Hotdog", price: 55, image: "images/overload-cheesy-hotdog.jpg" },
    { id: 2, name: "Overload Cheesy Burger", price: 50, image: "images/overload-cheesy-burger.jpg" },
    { id: 3, name: "Egg Sandwich", price: 30, image: "images/egg-sandwich.jpg" },
    { id: 4, name: "Fries", price: 25, image: "images/fries.jpg" },
    { id: 5, name: "Graham Bar", price: 15, image: "images/graham-bar.jpg" },
    { id: 6, name: "Graham in Tub 300ml", price: 40, image: "images/graham-bar-tub.jpg" },
    { id: 7, name: "Fruity Soda 12oz", price: 29, image: "images/12oz.jpg" },
    { id: 8, name: "Fruity Soda 16oz", price: 39, image: "images/16oz.jpg" }
];

let cart = [];
let hasCopied = false;

function initMenu() {
    const grid = document.getElementById('menu-grid');
    grid.innerHTML = products.map(p => `
        <div class="product-card">
            <img src="${p.image}" class="product-image" onerror="this.src='https://placehold.co/300x400?text=Sky+Sweet'">
            <div class="product-details">
                <div class="product-info">
                    <h3>${p.name}</h3>
                    <span class="price">₱${p.price}</span>
                </div>
                <button class="add-btn" onclick="addToCart(${p.id})">+ Add</button>
            </div>
        </div>
    `).join('');
}

window.addToCart = (id) => {
    const p = products.find(x => x.id === id);
    const existing = cart.find(x => x.id === id);
    if (existing) existing.qty++;
    else cart.push({...p, qty: 1});
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
                <button class="qty-btn" onclick="changeQty(${i.id}, -1)">-</button>
                <span>${i.qty}</span>
                <button class="qty-btn" onclick="changeQty(${i.id}, 1)">+</button>
            </div>
        </div>
    `).join('');
}

window.changeQty = (id, delta) => {
    const idx = cart.findIndex(i => i.id === id);
    cart[idx].qty += delta;
    if (cart[idx].qty <= 0) cart.splice(idx, 1);
    updateUI();
};

window.openCheckout = () => {
    const name = document.getElementById('customer-name').value.trim();
    const addr = document.getElementById('customer-address').value.trim();
    if(cart.length === 0) return alert("Please add items to your cart first!");
    if(!name || !addr) return alert("Please fill in your Name and Address.");
    
    hasCopied = false;
    document.getElementById('cart-modal').classList.remove('active');
    document.getElementById('checkout-modal').classList.add('active');
    
    let summary = cart.map(i => `• ${i.qty}x ${i.name}`).join('<br>');
    document.getElementById('final-summary-text').innerHTML = summary;
};

window.toggleGcashInfo = () => {
    const val = document.getElementById('payment-method').value;
    document.getElementById('gcash-info').style.display = (val === 'GCASH') ? 'block' : 'none';
};

window.downloadQR = () => {
    const link = document.createElement('a');
    link.href = 'images/qr-pay.jpg';
    link.download = 'SkySweetTreats-QR.jpg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.copyOrderDetails = () => {
    const name = document.getElementById('customer-name').value;
    const addr = document.getElementById('customer-address').value;
    const type = document.getElementById('order-type').value;
    const pay = document.getElementById('payment-method').value;
    const total = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    
    let text = `🛒 SKY SWEET TREATS ORDER\n👤 Name: ${name}\n📍 Addr: ${addr}\n🚚 Type: ${type}\n💳 Pay: ${pay}\n----------\n`;
    cart.forEach(i => text += `• ${i.qty}x ${i.name}\n`);
    text += `----------\n💰 TOTAL: ₱${total}\n\n*NOTICE: DON'T FORGET TO SEND YOUR GCASH RECEIPT!*`;

    navigator.clipboard.writeText(text).then(() => {
        hasCopied = true;
        showToast("Order Copied! 📋");
        const btn = document.getElementById('copy-details-btn');
        btn.innerHTML = "✅ Details Copied!";
        btn.style.background = "#28a745";
        btn.style.color = "white";
    });
};

window.sendToMessenger = () => {
    if(!hasCopied) return alert("⚠️ Please click 'Copy Order Details' first so you can paste it to us!");
    window.location.href = CONFIG.messengerUrl;
};

window.closeModal = (id) => document.getElementById(id).classList.remove('active');
document.getElementById('open-cart-btn').onclick = () => document.getElementById('cart-modal').classList.add('active');

function showToast(m) {
    const t = document.getElementById('toast');
    t.textContent = m; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2000);
}

initMenu();