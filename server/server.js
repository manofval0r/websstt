const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;


// Allow requests from your Vercel frontend
const allowedOrigins = ['https://sidedishfoodsweb.vercel.app', 'http://localhost:3000'];
app.use(cors({
    origin: allowedOrigins
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// Path to the orders.json file
const ordersFilePath = path.join(__dirname, 'orders.json');

// Initialize orders.json if it doesn't exist
async function initializeOrdersFile() {
    try {
        await fs.access(ordersFilePath);
    } catch (error) {
        await fs.writeFile(ordersFilePath, JSON.stringify([]));
    }
}

// API to get all orders
app.get('/api/orders', async (req, res) => {
    try {
        const ordersData = await fs.readFile(ordersFilePath, 'utf8');
        const orders = JSON.parse(ordersData);
        res.status(200).json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'Failed to fetch orders' });
    }
});

// API to place a new order
app.post('/api/orders', async (req, res) => {
    try {
        console.log('Incoming Order:', req.body);

        const newOrder = req.body;
        const ordersData = await fs.readFile(ordersFilePath, 'utf8');
        const orders = JSON.parse(ordersData);

        // Generate a new ID for the order
        const lastId = orders.length > 0 ? parseInt(orders[orders.length - 1].id) : 0;
        newOrder.id = (lastId + 1).toString();
        newOrder.created_at = new Date().toISOString();
        newOrder.status = 'Pending';

        // Add the new order to the list
        orders.push(newOrder);

        // Save the updated orders list to the file
        await fs.writeFile(ordersFilePath, JSON.stringify(orders, null, 2));
        console.log('Order Saved:', newOrder);

        res.status(201).json({ success: true, order: newOrder });
    } catch (error) {
        console.error('Error saving order:', error);
        res.status(500).json({ message: 'Failed to save order' });
    }
});

// API to delete an order by ID
app.delete('/api/orders/:id', async (req, res) => {
    try {
        const orderId = req.params.id; // Parse the order ID from the URL
        console.log(`Deleting order with ID: ${orderId}`); // Debugging log

        const ordersData = await fs.readFile(ordersFilePath, 'utf8');
        let orders = JSON.parse(ordersData);

        const orderIndex = orders.findIndex(order => order.id === orderId);
        if (orderIndex === -1) {
            return res.status(404).json({ message: 'Order not found' });
        }

        orders.splice(orderIndex, 1); // Remove the order
        await fs.writeFile(ordersFilePath, JSON.stringify(orders, null, 2));
        console.log(`Order #${orderId} deleted successfully.`);
        res.status(200).json({ message: 'Order deleted successfully' });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ message: 'Failed to delete order' });
    }
});

// API to update an order's payment_confirmed status
app.patch('/api/orders/:id', async (req, res) => {
    try {
        const orderId = req.params.id; // Parse the order ID from the URL
        const { payment_confirmed } = req.body; // Get the new payment status from the request body

        console.log(`Updating payment status for Order ID: ${orderId}`); // Debugging log

        const ordersData = await fs.readFile(ordersFilePath, 'utf8');
        let orders = JSON.parse(ordersData);

        const orderIndex = orders.findIndex(order => order.id === orderId);
        if (orderIndex === -1) {
            return res.status(404).json({ message: 'Order not found' });
        }

        orders[orderIndex].payment_confirmed = payment_confirmed; // Update the payment status
        await fs.writeFile(ordersFilePath, JSON.stringify(orders, null, 2));
        console.log(`Payment status for Order #${orderId} updated successfully.`);
        res.status(200).json({ message: 'Payment status updated successfully' });
    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({ message: 'Failed to update payment status' });
    }
});

async function placeOrder() {
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

async function fetchOrders() {
    try {
        console.log('Fetching orders...');
        const response = await fetch(`${BASE_URL}/api/orders`, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('Response Status:', response.status);
        if (response.ok) {
            const orders = await response.json();
            console.log('Fetched Orders:', orders);
            // Process and display orders...
        } else {
            const errorText = await response.text();
            console.error('Error fetching orders, status:', response.status, 'Response:', errorText);
            alert('Failed to fetch orders: ' + (response.statusText || 'Unknown error.'));
        }
    } catch (error) {
        console.error('Error fetching orders:', error);
        alert('An error occurred while fetching orders: ' + error.message);
    }
}

// Start the server
app.listen(PORT, async () => {
    await initializeOrdersFile();
    console.log(`Server running on http://localhost:${PORT}`);
});