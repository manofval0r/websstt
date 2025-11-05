import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from 'dotenv';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(helmet());

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many login attempts, please try again later'
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100 
});
const PORT = process.env.PORT || 3000;

const allowedOrigins = [
    'https://sidedishfoodsweb.vercel.app',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:3000'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        } else {
            // Using null as error to prevent CORS policy failure on client
            return callback(null, false); 
        }
    }
}));

app.use(express.json());

app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

const ordersFilePath = join(__dirname, 'orders.json');
const usersFilePath = join(__dirname, 'users.json');

// Utility Functions for File I/O
async function readJSONFile(path, defaultValue = []) {
    try {
        await fs.access(path);
        const data = await fs.readFile(path, 'utf8');
        return JSON.parse(data || '[]');
    } catch (error) {
        if (error.code === 'ENOENT') {
            return defaultValue;
        }
        throw error;
    }
}

async function writeJSONFile(path, data) {
    await fs.writeFile(path, JSON.stringify(data, null, 2));
}

async function initializeOrdersFile() {
    try {
        await fs.access(ordersFilePath);
    } catch (error) {
        await writeJSONFile(ordersFilePath, []);
    }
}

async function initializeUsersFile() {
    try {
        const users = await readJSONFile(usersFilePath);
        if (Array.isArray(users) && users.length > 0 && users[0].password) {
            return;
        }
    } catch (error) {
        // Fallthrough to create seed user if file is missing or invalid
    }

    const seed = {
        email: 'admin@sidedish.test',
    };
    const plainPassword = process.env.SEED_ADMIN_PW || 'ChangeMe123!';
    const saltRounds = 12;
    const hash = await bcrypt.hash(plainPassword, saltRounds);
    seed.password = hash;
    await writeJSONFile(usersFilePath, [seed]);
    console.log('Seeded users.json with default admin account:');
    console.log(`  email: ${seed.email}`);
    console.log('  password: (from SEED_ADMIN_PW or default ChangeMe123!) — change immediately');
}

function verifyToken(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized' });
    const token = auth.split(' ')[1];
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = payload;
        next();
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }
}

// API to get all orders
app.get('/api/orders', verifyToken, async (req, res) => {
    try {
        const orders = await readJSONFile(ordersFilePath);
        res.status(200).json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'An unexpected server error occurred while fetching orders.' });
    }
});

// API to place a new order
app.post('/api/orders', async (req, res) => {
    try {
        const newOrder = req.body;
        
        // Input validation check
        if (!newOrder || !newOrder.items || !Array.isArray(newOrder.items) || newOrder.items.length === 0 || !newOrder.customer) {
            return res.status(400).json({ message: 'Invalid order data: missing items or customer information.' });
        }

        const orders = await readJSONFile(ordersFilePath);

        const lastId = orders.length > 0 ? parseInt(orders[orders.length - 1].id) : 0;
        newOrder.id = (lastId + 1).toString();
        newOrder.created_at = new Date().toISOString();
        newOrder.status = 'Pending';
        
        orders.push(newOrder);
        await writeJSONFile(ordersFilePath, orders);
        console.log('Order Saved:', newOrder.id);

        res.status(201).json({ success: true, order: newOrder });
    } catch (error) {
        console.error('Error saving order:', error);
        res.status(500).json({ message: 'An unexpected server error occurred while saving the order.' });
    }
});

// API to delete an order by ID
app.delete('/api/orders/:id', verifyToken, async (req, res) => {
    try {
        const orderId = req.params.id;
        let orders = await readJSONFile(ordersFilePath);

        const initialLength = orders.length;
        orders = orders.filter(order => order.id !== orderId);

        if (orders.length === initialLength) {
            return res.status(404).json({ message: 'Order not found' });
        }

        await writeJSONFile(ordersFilePath, orders);
        console.log(`Order #${orderId} deleted successfully.`);
        res.status(200).json({ message: 'Order deleted successfully' });
    } catch (error) {
        console.error('Error deleting order:', error);
        res.status(500).json({ message: 'An unexpected server error occurred while deleting the order.' });
    }
});

// Authentication routes
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
    try {
        const users = await readJSONFile(usersFilePath);
        const user = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
        if (!user) return res.status(401).json({ message: 'Invalid credentials' });
        
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ message: 'Invalid credentials' });
        
        const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, { expiresIn: '8h' });
        return res.status(200).json({ token });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ message: 'Internal server error during login' });
    }
});

// Update payment status (authenticated)
app.patch('/api/orders/:id', verifyToken, async (req, res) => {
    try {
        const orderId = req.params.id;
        const { payment_confirmed } = req.body;
        
        if (typeof payment_confirmed !== 'boolean') {
            return res.status(400).json({ message: 'Invalid value for payment_confirmed. Must be a boolean.' });
        }

        let orders = await readJSONFile(ordersFilePath);

        const orderIndex = orders.findIndex(order => order.id === orderId);
        if (orderIndex === -1) {
            return res.status(404).json({ message: 'Order not found' });
        }

        orders[orderIndex].payment_confirmed = payment_confirmed;
        await writeJSONFile(ordersFilePath, orders);
        console.log(`Payment status for Order #${orderId} updated successfully.`);
        res.status(200).json({ message: 'Payment status updated successfully' });
    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({ message: 'An unexpected server error occurred while updating status.' });
    }
});

// Admin user management routes
app.get('/api/admin/users', verifyToken, async (req, res) => {
    try {
        const users = await readJSONFile(usersFilePath);
        const safeUsers = users.map(({ email }) => ({ email }));
        res.status(200).json(safeUsers);
    } catch (error) {
        console.error('Error fetching admin users:', error);
        res.status(500).json({ message: 'An unexpected server error occurred while fetching users.' });
    }
});

app.post('/api/admin/users', verifyToken, async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password required' });
        }

        const users = await readJSONFile(usersFilePath);
        
        if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
            return res.status(409).json({ message: 'User already exists' });
        }

        const saltRounds = 12;
        const hash = await bcrypt.hash(password, saltRounds);
        users.push({ email, password: hash });
        await writeJSONFile(usersFilePath, users);
        
        res.status(201).json({ message: 'Admin user created successfully' });
    } catch (error) {
        console.error('Error creating admin user:', error);
        res.status(500).json({ message: 'An unexpected server error occurred while creating a user.' });
    }
});

app.delete('/api/admin/users/:email', verifyToken, async (req, res) => {
    try {
        const emailToDelete = req.params.email.toLowerCase();
        
        const users = await readJSONFile(usersFilePath);
        
        if (users.length <= 1) {
            return res.status(403).json({ message: 'Cannot delete the last admin user' });
        }
        
        if (emailToDelete === req.user.email.toLowerCase()) {
            return res.status(403).json({ message: 'Cannot delete your own account' });
        }

        const initialLength = users.length;
        const filteredUsers = users.filter(u => u.email.toLowerCase() !== emailToDelete);
        
        if (filteredUsers.length === initialLength) {
            return res.status(404).json({ message: 'User not found' });
        }

        await writeJSONFile(usersFilePath, filteredUsers);
        res.status(200).json({ message: 'Admin user deleted successfully' });
    } catch (error) {
        console.error('Error deleting admin user:', error);
        res.status(500).json({ message: 'An unexpected server error occurred while deleting a user.' });
    }
});

// Start the server
app.listen(PORT, async () => {
    await initializeOrdersFile();
    await initializeUsersFile();
    console.log(`Server running on http://localhost:${PORT}`);
});