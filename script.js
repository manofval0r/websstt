// script.js
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let total = parseInt(localStorage.getItem('total')) || 0;

function addToCart(name, price) {
    cart.push({ name, price });
    total += price;
    localStorage.setItem('cart', JSON.stringify(cart));
    localStorage.setItem('total', total);

    console.log('Cart:', cart);
    console.log('Total:', total);

    updateCartSummary();
    updateCheckoutSummary();
}

function updateCartSummary() {
    const cartItems = document.getElementById('cart-items');
    const cartTotal = document.getElementById('cart-total');
    if (cartItems && cartTotal) {
        cartItems.innerHTML = cart.map(item => `<p>${item.name}: ${item.price} NGN</p>`).join('');
        cartTotal.textContent = total.toLocaleString(); // Format total with commas
    }
}

function updateCheckoutSummary() {
    const orderItems = document.getElementById('order-items');
    const orderTotal = document.getElementById('order-total');

    console.log('Cart:', cart);
    console.log('Total:', total);

    if (orderItems && orderTotal) {
        orderItems.innerHTML = cart.map(item => `<p>${item.name}: ${item.price} NGN</p>`).join('');
        orderTotal.textContent = total.toLocaleString(); // Format total with commas
    }
}

window.onload = function() {
    updateCartSummary();
    updateCheckoutSummary();
};