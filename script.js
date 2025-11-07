// ===============================
// Config and state
// ===============================
const BASE_URL =
  window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://sidedish-backend.onrender.com';

let cart = JSON.parse(localStorage.getItem('cart')) || [];
let total = parseFloat(localStorage.getItem('total')) || 0;
let currentUser = null;

// ===============================
// Auth state and UI helpers
// ===============================

// Call this after any auth change
function checkAuthState() {
  const token = localStorage.getItem('token');
  const userInfo = localStorage.getItem('user');

  const loginBtn = document.getElementById('login-btn');
  const userInfoBox = document.getElementById('user-info');
  const userNameEl = document.getElementById('user-name');

  if (token && userInfo) {
    currentUser = JSON.parse(userInfo);

    // Replace Sign In button with avatar
    if (loginBtn) loginBtn.style.display = 'none';
    if (userInfoBox) userInfoBox.style.display = 'flex';

    // Prioritize name, then email, then a default
    const displayName = currentUser?.name || currentUser?.email || 'U';
    const firstLetter = displayName.charAt(0).toUpperCase();
    if (userNameEl) {
      userNameEl.innerHTML = `<div class="avatar">${firstLetter}</div>`;
    }
  } else {
    currentUser = null;
    if (loginBtn) loginBtn.style.display = 'flex';
    if (userInfoBox) userInfoBox.style.display = 'none';
    if (userNameEl) userNameEl.textContent = '';
  }
  updateCartSummary(); // Ensure cart state reflects auth state
}

// Modal utils
function openModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.style.display = 'flex';
}
function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.style.display = 'none';
}

// Switch between login and signup
function switchToSignup() {
  closeModal('login-modal');
  openModal('signup-modal');
}
function switchToLogin() {
  closeModal('signup-modal');
  openModal('login-modal');
}

// Logout
function handleLogout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  cart = []; // Clear cart on logout
  total = 0; // Reset total on logout
  localStorage.removeItem('cart');
  localStorage.removeItem('total');
  checkAuthState();
}

// ===============================
// Normal email/password LOGIN
// ===============================
async function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById('email')?.value?.trim();
  const password = document.getElementById('password')?.value;

  if (!email || !password) {
    alert('Please enter your email and password.');
    return;
  }

  try {
    const response = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }) 
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      alert(err.message || 'Invalid credentials. Please try again.');
      return;
    }

    const data = await response.json();
    // Expecting { token, user: { id, name, email } }
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    closeModal('login-modal');
    checkAuthState();
  } catch (error) {
    console.error('Login failed:', error);
    alert('Login failed. Please try again later.');
  }
}

// ===============================
// Normal email/password SIGNUP
// ===============================
async function handleSignup(event) {
  event.preventDefault();

  const name = document.getElementById('name')?.value?.trim();
  const email = document.getElementById('signup-email')?.value?.trim();
  const password = document.getElementById('signup-password')?.value;
  const confirm = document.getElementById('confirm-password')?.value;

  if (!name || !email || !password || !confirm) {
    alert('Please complete all fields.');
    return;
  }
  if (password !== confirm) {
    alert('Passwords do not match.');
    return;
  }
  if (password.length < 6) {
    alert('Password should be at least 6 characters.');
    return;
  }

  try {
    const response = await fetch(`${BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      alert(err.message || 'Signup failed. Please try again.');
      return;
    }

    const data = await response.json();
    // Expecting { token, user: { id, name, email } }
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    closeModal('signup-modal');
    checkAuthState();
  } catch (error) {
    console.error('Signup failed:', error);
    alert('Signup failed. Please try again later.');
  }
}

// ===============================
// Google OAuth (Login / Signup) using GSI
// ===============================

// This function will be called by the GSI library after a successful sign-in
async function handleGoogleCredentialResponse(response) {
  if (!response.credential) {
    console.error('No credential found in Google response.');
    return;
  }

  try {
    const backendResponse = await fetch(`${BASE_URL}/api/auth/google/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: response.credential }) // Send the ID token to your backend
    });

    if (!backendResponse.ok) {
      const err = await backendResponse.json().catch(() => ({}));
      alert(err.message || 'Google login/signup failed on server. Please try again.');
      return;
    }

    const data = await backendResponse.json();
    // Expecting { token, user: { id, name, email } }
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    closeModal('login-modal'); // Close whatever modal is open
    closeModal('signup-modal');
    checkAuthState();
  } catch (error) {
    console.error('Google credential processing failed:', error);
    alert('Google login/signup failed. Please try again later.');
  }
}

// Function to render Google buttons with custom callbacks (since GSI is for client-side)
function renderGoogleButtons() {
  if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
      console.warn('Google Identity Services library not loaded yet.');
      return;
  }

  const googleClientId = document.querySelector('meta[name="google-signin-client_id"]')?.content;
  if (!googleClientId) {
      console.error('Google Client ID not found in meta tag.');
      return;
  }

  // Initialize GSI for pop-up or redirect flow
  google.accounts.id.initialize({
    client_id: googleClientId,
    callback: handleGoogleCredentialResponse,
  });

  // Render the "Sign in with Google" button for the login modal
  const loginGoogleBtn = document.getElementById('login-modal').querySelector('.btn-google');
  if (loginGoogleBtn) {
    google.accounts.id.renderButton(loginGoogleBtn, {
      type: 'standard', // or 'icon'
      size: 'large',
      text: 'continue_with', // 'signin_with', 'signup_with', 'continue_with', 'federated_signin'
      shape: 'rectangular',
      theme: 'outline',
      logo_alignment: 'left',
      width: '300px' // Adjust width as needed
    });
    // Attach an event listener if the renderButton isn't automatically showing it
    // Or, remove the existing button and let renderButton create a new one.
    // For now, let's just make sure the `google.accounts.id.prompt()` is called
    // which handles the UX directly from Google's JS library.
    loginGoogleBtn.onclick = () => google.accounts.id.prompt();
  }

  // Render the "Sign up with Google" button for the signup modal
  const signupGoogleBtn = document.getElementById('signup-modal').querySelector('.btn-google');
  if (signupGoogleBtn) {
    google.accounts.id.renderButton(signupGoogleBtn, {
      type: 'standard', // or 'icon'
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      theme: 'outline',
      logo_alignment: 'left',
      width: '300px'
    });
    signupGoogleBtn.onclick = () => google.accounts.id.prompt();
  }
}


// ===============================
// Cart functions (existing)
// ===============================
function addToCart(name, price, qty = 1, img) {
  if (!currentUser) {
    openModal('login-modal');
    return;
  }

  const item = {
    name,
    price: Number(price),
    qty: Number(qty) || 1,
    userId: currentUser?.id || null, // Now currentUser.id should be available
    img: img || ''
  };

  
  cart.push(item);
  total += item.price * item.qty;
  localStorage.setItem('cart', JSON.stringify(cart));
  localStorage.setItem('total', total);
  showToast(name, qty, price);

  const cartIcon = document.getElementById('cart-toggle');
  if (cartIcon) {
    cartIcon.classList.add('cart-jiggle');
    setTimeout(() => cartIcon.classList.remove('cart-jiggle'), 500); // Remove after animation
  }

  updateCartSummary();
}

// Toast Notification
function showToast(name, qty, price) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';

  // Calculate total for this item
  const itemTotal = (Number(qty) * Number(price)).toLocaleString('en-NG');
  const qtyText = Number(qty) === 1 ? '1 piece' : `${qty} pieces`;
  toast.innerHTML = `
    <i class="fa-solid fa-check-circle"></i>
    <div class="toast-content">
        <p>Added to cart!</p>
        <span>${qtyText} of ${name} (NGN ${itemTotal})</span>
        
        <a href="checkout.htm" class="toast-action">
            View Cart & Checkout
        </a>
    </div>
  `;

  // Add toast to the container
  container.appendChild(toast);

  // --- Animate in ---
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  // --- Animate out and remove ---
  // Hide after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    
    // Remove the element from the DOM after the fade-out (500ms)
    setTimeout(() => {
      if (container.contains(toast)) {
          container.removeChild(toast);
      }
    }, 500); // Must match the CSS transition duration
  }, 3000); 
}

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

function removeFromCart(index) {
  if (index < 0 || index >= cart.length) return;
  const item = cart[index];
  total -= (Number(item.price) * Number(item.qty));
  cart.splice(index, 1);
  localStorage.setItem('cart', JSON.stringify(cart));
  localStorage.setItem('total', total);
  updateCartSummary();
  if (typeof updateCheckoutSummary === 'function') updateCheckoutSummary();
}

function updateCartSummary() {
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

  const count = cart.reduce((s, it) => s + (Number(it.qty) || 1), 0);
  const cartCountEls = document.querySelectorAll('#cart-count');
  cartCountEls.forEach(el => el.textContent = count);
  const badgeEls = document.querySelectorAll('.cart-badge');
  badgeEls.forEach(el => el.setAttribute('data-count', count));

  localStorage.setItem('cart', JSON.stringify(cart));
  localStorage.setItem('total', total);
}

// ===============================
// Checkout helpers (existing)
// ===============================
function updateDeliveryFee() {
  const city = document.getElementById('city')?.value;
  const deliveryOption = document.querySelector('input[name="delivery-option"]:checked')?.value;
  const deliveryFeeElement = document.getElementById('delivery-fee');
  const cashOnDeliveryOption = document.getElementById('cash-on-delivery');
  const cardPaymentOption = document.getElementById('card-payment');

  window.deliveryFee = 0;
  if (!deliveryFeeElement || !deliveryOption){
    if (typeof updateGrandTotal === 'function') updateGrandTotal(); 
    return;
  }

  if (deliveryOption === 'pickup') {
    deliveryFeeElement.textContent = '0 NGN (In-restaurant pickup)';
    if (cashOnDeliveryOption) cashOnDeliveryOption.disabled = true;
    if (cardPaymentOption) cardPaymentOption.disabled = false;
    if(typeof updateGrandTotal === 'function') updateGrandTotal();
    return;
  }

  // Assuming total is in NGN, adjust thresholds as needed
  if (total < 10000) {
    if (city === 'Kano') {
      window.deliveryFee = 2400;
      deliveryFeeElement.textContent = '2,400 NGN';
      if (cashOnDeliveryOption) cashOnDeliveryOption.disabled = false;
      if (cardPaymentOption) cardPaymentOption.disabled = true;
    } else {
      deliveryFeeElement.textContent = 'Not available (Order under 10,000 NGN)';
      if (cashOnDeliveryOption) cashOnDeliveryOption.disabled = true;
      if (cardPaymentOption) cardPaymentOption.disabled = true;
    }
  } else {
    if (city === 'Kano') {
      window.deliveryFee = 2400;
      deliveryFeeElement.textContent = '2,400 NGN';
      if (cashOnDeliveryOption) cashOnDeliveryOption.disabled = false;
      if (cardPaymentOption) cardPaymentOption.disabled = true;
    } else {
      deliveryFeeElement.textContent = 'To be paid upon arrival (varies by state)';
      if (cashOnDeliveryOption) cashOnDeliveryOption.disabled = true;
      if (cardPaymentOption) cardPaymentOption.disabled = true;
    }
  }
  if (typeof updateGrandTotal === 'function') updateGrandTotal();
}

function updateGrandTotal(){
  const grandTotal = document.getElementById('grand-total');
  if(!grandTotal) return
  const numericPrice = window.deliveryFee || 0;
  grandNumericTotal = total + numericPrice;
  grandTotal.textContent = grandNumericTotal.toLocaleString("en-NGN") + " NGN";
}

function showPaymentDetails(paymentMethod) {
  const bankTransferDetails = document.getElementById('bank-transfer-details');
  if (bankTransferDetails) {
    bankTransferDetails.style.display = (paymentMethod === 'bank-transfer') ? 'block' : 'none';
  }
  console.log(`Payment method selected: ${paymentMethod}`);
}

async function submitOrder() {
  if (cart.length === 0) {
    alert('Your cart is empty. Please add items before ordering.');
    return;
  }
  if (!currentUser) {
    alert('Please sign in to place an order.');
    openModal('login-modal');
    return;
  }

  const address = document.getElementById('address')?.value?.trim();
  const state = document.getElementById('city')?.value; // Renamed to state for consistency
  const delivery_option = document.querySelector('input[name="delivery-option"]:checked')?.value;
  const payment_method = document.querySelector('input[name="payment"]:checked')?.value;

  if (!address || !state || !delivery_option || !payment_method) {
    alert('Please fill in all delivery and payment details.');
    return;
  }

  const orderData = {
    items: cart,
    total: total,
    customer: currentUser, // Include current user information
    address,
    state,
    delivery_option,
    payment_method,
    payment_confirmed: false
  };

  try {
    const response = await fetch(`${BASE_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });

    if (response.ok) {
      const responseData = await response.json();
      alert('Order placed successfully! Order ID: ' + responseData.order.id);
      localStorage.removeItem('cart');
      localStorage.removeItem('total');
      cart = [];
      total = 0;
      updateCartSummary(); // Clear cart UI
      window.location.href = '/index.htm'; // Redirect to home or order confirmation page
    } else {
      const error = await response.json();
      alert('Failed to place order: ' + (error.message || 'Unknown error.'));
    }
  } catch (error) {
    console.error('Error submitting order:', error);
    alert('An error occurred: ' + error.message);
  }
}

// ===============================
// Expose functions to global (if needed by inline handlers)
// ===============================
window.openModal = openModal;
window.closeModal = closeModal;
window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.handleGoogleCredentialResponse = handleGoogleCredentialResponse; // Expose for GSI callback
window.handleLogout = handleLogout;

window.addToCartFromCard = addToCartFromCard;
window.changeQty = changeQty;
window.removeFromCart = removeFromCart;
window.updateDeliveryFee = updateDeliveryFee;
window.showPaymentDetails = showPaymentDetails;
window.submitOrder = submitOrder;

window.switchToSignup = switchToSignup;
window.switchToLogin = switchToLogin;


// ===============================
// Init
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  // Update auth UI
  checkAuthState();

  // Update cart UI
  updateCartSummary();
  console.log('Page loaded');

  if (!document.getElementById('toast-container')) {
    const toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  // Load and render Google buttons
  renderGoogleButtons();
});

// Re-render Google buttons if the GSI script loads after DOMContentLoaded
// (since it's `async defer`)
window.addEventListener('load', renderGoogleButtons);

// Handle newsletter submission (add a placeholder function)
function handleNewsletterSubmit(event) {
  event.preventDefault();
  const emailInput = document.getElementById('newsletter-email');
  if (emailInput && emailInput.value) {
    alert(`Thanks for subscribing with ${emailInput.value}!`);
    emailInput.value = ''; // Clear the input
  }
}
window.handleNewsletterSubmit = handleNewsletterSubmit; // Expose to global
window.updateGrandTotal = updateGrandTotal;
window.submitOrder = submitOrder;