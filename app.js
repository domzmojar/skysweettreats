const CONFIG = {
    messengerUrl: "https://m.me/100089330907916",
    sheetUrl: "PASTE_YOUR_CSV_LINK_HERE" // Put your Google Sheet CSV Link here
};

let products = [];
let cart = [];
let hasCopied = false;

// Load Menu
async function init() {
    try {
        const res = await fetch(CONFIG.sheetUrl);
        const data = await res.text();
        const rows = data.split('\n').slice(1);
        products = rows.map(r => {
            const c = r.split(',');
            return { id: c[0], name: c[1], price: parseFloat(c[2]), img: c[3], stock: parseInt(c[5]) };
        }).filter(p => p.name);
        renderMenu();
    } catch (e) { console.error("Error loading menu"); }
}

function renderMenu() {
    document.getElementById('menu-grid').innerHTML = products.map(p => `
        <div class="product-item">
            <img src="${p.img}">
            <h3>${p.name}</h3>
            <span class="price">₱${p.price}</span>
            <button class="btn add-btn" onclick="addToCart('${p.id}')">Add to Cart</button>
        </div>
    `).join('');
}

window.addToCart = (id) => {
    const p = products.find(x => x.id === id);
    const item = cart.find(x => x.id === id);
    if(item) item.qty++; else cart.push({...p, qty: 1});
    updateCart();
};

function updateCart() {
    document.getElementById('cart-count').innerText = cart.reduce((s, i) => s + i.qty, 0);
    document.getElementById('cart-total').innerText = cart.reduce((s, i) => s + (i.price * i.qty), 0).toFixed(2);
    document.getElementById('cart-items').innerHTML = cart.map(i => `
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <span>${i.qty}x ${i.name}</span>
            <span>₱${(i.price * i.qty).toFixed(2)}</span>
        </div>
    `).join('');
}

window.handleCopy = () => {
    const name = document.getElementById('customer-name').value;
    const addr = document.getElementById('customer-address').value;
    const pay = document.getElementById('payment-method').value;
    const now = new Date().toLocaleString();
    
    let text = `✨ SKY SWEET TREATS ORDER\n📅 ${now}\n👤 Name: ${name}\n📍 Addr: ${addr}\n💳 Pay: ${pay}\n━━━━━━━\n`;
    cart.forEach(i => text += `• ${i.qty}x ${i.name} - ₱${(i.price * i.qty).toFixed(2)}\n`);
    text += `━━━━━━━\n💰 Total: ₱${document.getElementById('cart-total').innerText}`;

    navigator.clipboard.writeText(text).then(() => {
        hasCopied = true;
        document.getElementById('copy-btn').innerText = "✅ COPIED";
        alert("Order Copied! Click Step 2 to Send.");
    });
};

window.handleMessenger = () => {
    if(!hasCopied) return alert("Please click Step 1 first!");
    window.location.href = CONFIG.messengerUrl;
};

window.openModal = (id) => document.getElementById(id).style.display = 'block';
window.closeModal = (id) => document.getElementById(id).style.display = 'none';

window.goToCheckout = () => {
    if(!document.getElementById('customer-name').value || cart.length === 0) return alert("Fill in details!");
    closeModal('cart-modal');
    openModal('checkout-modal');
    document.getElementById('summary-list').innerHTML = cart.map(i => `• ${i.qty}x ${i.name}`).join('<br>');
};

init();
