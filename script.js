const BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://sidedish-backend.onrender.com';

let cart = JSON.parse(localStorage.getItem('cart')) || [];
let total = parseFloat(localStorage.getItem('total')) || 0;
let deliveryFee = 0; // Declare and initialize deliveryFee at the top

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

window.submitOrder = async function () {
    console.log('Place Order button clicked');
    try {
        // Reset error messages
        document.getElementById('cart-error').style.display = 'none';
        document.getElementById('address-error').style.display = 'none';
        document.getElementById('city-error').style.display = 'none';
        document.getElementById('payment-error').style.display = 'none';

        // Get form values
        const city = document.getElementById('city').value;
        const address = document.getElementById('address').value.trim();
        const deliveryOption = document.querySelector('input[name="delivery-option"]:checked').value;
        const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value;

        // Validation checks
        let hasError = false;

        if (cart.length === 0) {
            document.getElementById('cart-error').style.display = 'block';
            hasError = true;
        }

        if (!address) {
            document.getElementById('address-error').style.display = 'block';
            hasError = true;
        }

        if (!city) {
            document.getElementById('city-error').style.display = 'block';
            hasError = true;
        }

        if (!paymentMethod) {
            document.getElementById('payment-error').style.display = 'block';
            hasError = true;
        }

        if (total < 10000 && city !== 'Kano' && deliveryOption !== 'pickup') {
            alert('Orders under 10,000 NGN are only available for delivery in Kano.');
            hasError = true;
        }

        if (deliveryOption === 'pickup' && paymentMethod !== 'card-payment' && paymentMethod !== 'bank-transfer') {
            alert('For in-restaurant pickup, please select Card Payment or Bank Transfer.');
            hasError = true;
        }

        if (city === 'Kano' && deliveryOption !== 'pickup' && paymentMethod !== 'cash-on-delivery' && paymentMethod !== 'bank-transfer') {
            alert('For Kano deliveries, please select Cash on Delivery or Bank Transfer.');
            hasError = true;
        }

        if (city !== 'Kano' && deliveryOption !== 'pickup' && paymentMethod !== 'bank-transfer') {
            alert('For deliveries outside Kano, please select Bank Transfer.');
            hasError = true;
        }

        if (hasError) return;

        // Calculate total including delivery fee
        let finalTotal = total;
        if (deliveryOption !== 'pickup' && total >= 10000 && city !== 'Kano') {
            // Delivery fee varies by state, not included in total
        } else if (deliveryOption !== 'pickup' && city === 'Kano') {
            deliveryFee = 2400;
            finalTotal += deliveryFee;
        }

        // Prepare order data
        const orderData = {
            items: cart,
            total: finalTotal,
            address: address,
            state: city,
            delivery_option: deliveryOption,
            payment_method: paymentMethod,
            payment_confirmed: false,
            delivery_fee: deliveryFee
        };

        console.log('Order Data:', orderData);

        const response = await fetch(`${BASE_URL}/api/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });

        if (response.ok) {
            alert('Order placed successfully! You can view your order in the dashboard.');
            // Clear localStorage first
            localStorage.removeItem('cart');
            localStorage.removeItem('total');
            // Then reset global variables
            cart = [];
            total = 0;
            deliveryFee = 0;
            window.location.href = '/index.htm';
        } else {
            const error = await response.json();
            alert('Failed to place order: ' + (error.message || 'Unknown error. Please try again.'));
        }
    } catch (error) {
        console.error('Error in submitOrder:', error);
        alert('An error occurred while placing the order: ' + error.message + '. Please check your internet connection and try again.');
    }
};

window.updateDeliveryFee = updateDeliveryFee;
window.showPaymentDetails = showPaymentDetails;

window.addEventListener('load', function() {
    updateCartSummary();
    console.log('Page loaded');
});