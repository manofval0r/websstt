let cart = JSON.parse(localStorage.getItem('cart')) || [];
let total = parseFloat(localStorage.getItem('total')) || 0;

function addToCart(name, price) {
    cart.push({ name, price });
    total += price;
    localStorage.setItem('cart', JSON.stringify(cart));
    localStorage.setItem('total', total);

    console.log('Cart:', cart);
    console.log('Total:', total);

    updateCartSummary();
}

function updateCartSummary() {
    const cartItems = document.getElementById('cart-items');
    const cartTotal = document.getElementById('cart-total');
    if (cartItems && cartTotal) {
        cartItems.innerHTML = cart.map(item => `<p>${item.name}: ${item.price} NGN</p>`).join('');
        cartTotal.textContent = total.toLocaleString('en-NG'); // Format total with commas and locale
    }
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

window.addEventListener('load', function() {
    updateCartSummary();
    console.log('Page loaded');
});