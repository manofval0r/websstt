const BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://sidedish-backend.onrender.com';

let cart = JSON.parse(localStorage.getItem('cart')) || [];
let total = parseFloat(localStorage.getItem('total')) || 0;
let currentUser = null;

// Auth functions
function checkAuthState() {
    const token = localStorage.getItem('token');
    const userInfo = localStorage.getItem('user');
    
    if (token && userInfo) {
        currentUser = JSON.parse(userInfo);
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('user-info').style.display = 'flex';
        document.getElementById('user-name').textContent = currentUser.name;
    } else {
        currentUser = null;
        document.getElementById('login-btn').style.display = 'flex';
        document.getElementById('user-info').style.display = 'none';
    }
}

async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            closeModal('login-modal');
            checkAuthState();
        } else {
            alert('Invalid credentials. Please try again.');
        }
    } catch (error) {
        console.error('Login failed:', error);
        alert('Login failed. Please try again later.');
    }
}

function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    checkAuthState();
}

function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

async function signInWithGoogle() {
    window.location.href = `${BASE_URL}/api/auth/google`;
}

// Initialize auth state
document.addEventListener('DOMContentLoaded', checkAuthState);

function addToCart(name, price, qty = 1, img) {
    if (!currentUser) {
        openModal('login-modal');
        return;
    }

    const item = {
        name,
        price: Number(price),
        qty: Number(qty) || 1,
        userId: currentUser?.id || null,
        img: img || ''
    };

    cart.push(item);
    total += item.price * item.qty;
    localStorage.setItem('cart', JSON.stringify(cart));
    localStorage.setItem('total', total);

    console.log('Cart:', cart);
    console.log('Total:', total);

    updateCartSummary();
}

// Called from a menu card's add button
function addToCartFromCard(button) {
    const card = button.closest('.menu-card');
    if (!card) return;
    const name = card.dataset.name || card.querySelector('.menu-card-title')?.textContent.trim();
    const priceRaw = card.dataset.price || card.querySelector('.menu-card-price')?.textContent.replace(/[^0-9\.]/g, '');
    const price = Number(priceRaw) || 0;
    const qtyInput = card.querySelector('.quantity-input');
    const qty = qtyInput ? Number(qtyInput.value) || 1 : 1;
    const img = card.dataset.img || card.querySelector('.menu-card-image')?.getAttribute('src') || '';
    addToCart(name, price, qty, img);
}

// Increase/decrease qty buttons in menu cards
function changeQty(event, delta) {
    const btn = event.currentTarget || event.target;
    const card = btn.closest('.menu-card');
    if (!card) return;
    const input = card.querySelector('.quantity-input');
    if (!input) return;
    let val = Number(input.value) || 0;
    val += delta;
    if (val < 1) val = 1;
    if (val > 99) val = 99;
    input.value = val;
}

// Remove item at index from cart
function removeFromCart(index) {
    if (index < 0 || index >= cart.length) return;
    const item = cart[index];
    total -= (Number(item.price) * Number(item.qty));
    cart.splice(index, 1);
    localStorage.setItem('cart', JSON.stringify(cart));
    localStorage.setItem('total', total);
    updateCartSummary();
    // If we're on checkout page, refresh the summary render
    if (typeof updateCheckoutSummary === 'function') updateCheckoutSummary();
}

function updateCartSummary() {
    // Update any cart-items container (cart drawer) and totals
    const cartItems = document.getElementById('cart-items');
    const cartTotal = document.getElementById('cart-total');
    if (cartItems && cartTotal) {
        cartItems.innerHTML = cart.map((item, i) => `
            <div class="cart-item">
                <img src="${item.img || 'assets/no-pic.jpg'}" class="cart-item-img" alt="${item.name}">
                <div class="cart-item-details">
                    <div class="cart-item-title">${item.name}</div>
                    <div class="cart-item-price">${(item.price).toLocaleString('en-NG')} NGN x ${item.qty}</div>
                </div>
                <div class="cart-item-quantity">
                    <button onclick="removeFromCart(${i})" class="cart-item-remove" aria-label="Remove">&times;</button>
                </div>
            </div>
        `).join('');
        cartTotal.textContent = total.toLocaleString('en-NG');
    }

    // Update header badges/counts (elements that show cart count)
    const count = cart.reduce((s, it) => s + (Number(it.qty) || 1), 0);
    // update elements with id cart-count
    const cartCountEls = document.querySelectorAll('#cart-count');
    cartCountEls.forEach(el => el.textContent = count);
    // update elements with class cart-badge (data-count attribute)
    const badgeEls = document.querySelectorAll('.cart-badge');
    badgeEls.forEach(el => el.setAttribute('data-count', count));

    // Persist
    localStorage.setItem('cart', JSON.stringify(cart));
    localStorage.setItem('total', total);
}

function updateDeliveryFee() {
    console.log('Updating delivery fee...');
    const city = document.getElementById('city').value;
    const deliveryOption = document.querySelector('input[name="delivery-option"]:checked').value;
    const deliveryFeeElement = document.getElementById('delivery-fee');
    const cashOnDeliveryOption = document.getElementById('cash-on-delivery');
    const cardPaymentOption = document.getElementById('card-payment');

    if (deliveryOption === 'pickup') {
        deliveryFeeElement.textContent = '0 NGN (In-restaurant pickup)';
        cashOnDeliveryOption.disabled = true;
        cardPaymentOption.disabled = false;
    } else {
        if (total < 10000) {
            if (city === 'Kano') {
                deliveryFeeElement.textContent = '2,400 NGN';
                cashOnDeliveryOption.disabled = false;
                cardPaymentOption.disabled = true;
            } else {
                deliveryFeeElement.textContent = 'Not available (Order under 10,000 NGN)';
                cashOnDeliveryOption.disabled = true;
                cardPaymentOption.disabled = true;
            }
        } else {
            if (city === 'Kano') {
                deliveryFeeElement.textContent = '2,400 NGN';
                cashOnDeliveryOption.disabled = false;
                cardPaymentOption.disabled = true;
            } else {
                deliveryFeeElement.textContent = 'To be paid upon arrival (varies by state)';
                cashOnDeliveryOption.disabled = true;
                cardPaymentOption.disabled = true;
            }
        }
    }
}

function showPaymentDetails(paymentMethod) {
    const bankTransferDetails = document.getElementById('bank-transfer-details');

    if (paymentMethod === 'bank-transfer') {
        bankTransferDetails.style.display = 'block';
    } else {
        bankTransferDetails.style.display = 'none';
    }

    console.log(`Payment method selected: ${paymentMethod}`);
}

async function submitOrder() {
    console.log('Placing order...');
    console.log('Cart:', cart);
    console.log('Total:', total);

    const orderData = {
        items: cart,
        total: total,
        address: document.getElementById('address').value.trim(),
        state: document.getElementById('city').value,
        delivery_option: document.querySelector('input[name="delivery-option"]:checked').value,
        payment_method: document.querySelector('input[name="payment"]:checked')?.value,
        payment_confirmed: false
    };

    console.log('Order Data:', orderData);

    try {
        const response = await fetch(`${BASE_URL}/api/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        console.log('Response Status:', response.status);
        if (response.ok) {
            const responseData = await response.json();
            console.log('Order placed successfully!', responseData);
            alert('Order placed successfully!');
            localStorage.removeItem('cart');
            localStorage.removeItem('total');
            cart = [];
            total = 0;
            window.location.href = '/index.htm';
        } else {
            const error = await response.json();
            console.error('Error Response:', error);
            alert('Failed to place order: ' + (error.message || 'Unknown error.'));
        }
    } catch (error) {
        console.error('Network Error:', error.message);
        alert('An error occurred: ' + error.message);
    }
}

window.updateDeliveryFee = updateDeliveryFee;
window.showPaymentDetails = showPaymentDetails;
window.submitOrder = submitOrder;
window.deliveryFee = deliveryFee;

window.addEventListener('load', function() {
    updateCartSummary();
    console.log('Page loaded');
});