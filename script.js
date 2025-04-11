// script.js
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let total = parseInt(localStorage.getItem('total')) || 0;

function addToCart(name, price) {
    cart.push({ name, price });
    total += price;
    localStorage.setItem('cart', JSON.stringify(cart));
    localStorage.setItem('total', total);
    updateCartSummary();
}

function updateCartSummary() {
    const cartItems = document.getElementById('cart-items');
    const cartTotal = document.getElementById('cart-total');
    if (cartItems && cartTotal) {
        cartItems.innerHTML = cart.map(item => `<p>${item.name}: ${item.price} NGN</p>`).join('');
        cartTotal.textContent = total;
    }
}

function updateCheckoutSummary() {
    const orderItems = document.getElementById('order-items');
    const orderTotal = document.getElementById('order-total');
    if (orderItems && orderTotal) {
        orderItems.innerHTML = cart.map(item => `<p>${item.name}: ${item.price} NGN</p>`).join('');
        orderTotal.textContent = total;
    }
}

window.onload = function() {
    updateCartSummary();
};