const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = 'https://sidedish-backend.onrender.com';

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
        res.json(orders);
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

        newOrder.id = orders.length > 0 ? String(parseInt(orders[orders.length - 1].id) + 1) : '1';
        newOrder.created_at = new Date().toISOString();
        newOrder.customer_name = newOrder.customer_name || 'Unknown Customer';
        newOrder.status = 'Pending';

        orders.push(newOrder);
        await fs.writeFile(ordersFilePath, JSON.stringify(orders, null, 2));
        console.log('Order Saved:', newOrder);

        res.status(201).json({ success: true, order: newOrder });
    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).json({ message: 'Failed to place order' });
    }
});

// API to delete an order by ID
app.delete('/api/orders/:id', async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const ordersData = await fs.readFile(ordersFilePath, 'utf8');
        let orders = JSON.parse(ordersData);

        // Check if the order exists
        const orderIndex = orders.findIndex(order => order.id === orderId);
        if (orderIndex === -1) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Remove the order
        orders = orders.filter(order => order.id !== orderId);
        await fs.writeFile(ordersFilePath, JSON.stringify(orders, null, 2));
        res.status(200).json({ message: 'Order deleted successfully' });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ message: 'Failed to delete order' });
    }
});

// API to update an order's payment_confirmed status
app.patch('/api/orders/:id', async (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const { payment_confirmed } = req.body;

        console.log(`Updating payment status for Order ID: ${orderId}`);
        console.log('Request Body:', req.body);

        if (typeof payment_confirmed !== 'boolean') {
            return res.status(400).json({ message: 'payment_confirmed must be a boolean' });
        }

        const ordersData = await fs.readFile(ordersFilePath, 'utf8');
        let orders = JSON.parse(ordersData);

        const orderIndex = orders.findIndex(order => order.id === orderId);
        if (orderIndex === -1) {
            return res.status(404).json({ message: 'Order not found' });
        }

        orders[orderIndex].payment_confirmed = payment_confirmed;
        await fs.writeFile(ordersFilePath, JSON.stringify(orders, null, 2));
        console.log('Payment status updated:', orders[orderIndex]);

        res.status(200).json({ message: 'Payment status updated successfully' });
    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({ message: 'Failed to update payment status' });
    }
});

// Start the server
app.listen(PORT, async () => {
    await initializeOrdersFile();
    console.log(`Server running on http://localhost:${PORT}`);
});