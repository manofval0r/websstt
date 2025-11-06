// server.js
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
import { OAuth2Client } from 'google-auth-library';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(helmet());

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 failed attempts per IP
  message: 'Too many login attempts, please try again later',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
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
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn(`Blocked CORS request from: ${origin}`); // Log blocked origins
    return callback(new Error('Not allowed by CORS'), false);
  }
}));

app.use(express.json());

// Apply rate limiters to specific routes
app.use('/api/auth/login', authLimiter); // Only apply to login endpoint
app.use('/api/auth/signup', authLimiter); // Apply to signup as well
app.use('/api', apiLimiter); // General API limiter, but we'll exclude specific auth routes from this if they have their own.

// Serve static files from the 'public' directory (or the root if desired)
// For favicon, it's common to serve it from the root.
app.use(express.static(join(__dirname, 'public'))); // Create a 'public' folder and put favicon there
app.use('/assets', express.static(join(__dirname, 'assets'))); // If assets are in a separate folder

const ordersFilePath = join(__dirname, 'orders.json');
const usersFilePath = join(__dirname, 'users.json');

// file utilities
async function readJSONFile(path, defaultValue = []) {
  try {
    await fs.access(path);
    const data = await fs.readFile(path, 'utf8');
    return JSON.parse(data || '[]');
  } catch (error) {
    if (error.code === 'ENOENT') return defaultValue;
    throw error;
  }
}
async function writeJSONFile(path, data) {
  await fs.writeFile(path, JSON.stringify(data, null, 2));
}
async function initializeOrdersFile() {
  try { await fs.access(ordersFilePath); } catch { await writeJSONFile(ordersFilePath, []); }
}
async function initializeUsersFile() {
  try {
    const users = await readJSONFile(usersFilePath);
    if (Array.isArray(users) && users.length > 0 && users[0].password) return;
  } catch {}
  const seed = { id: 'admin1', email: 'admin@sidedish.test' }; // Add an ID for consistency
  const plainPassword = process.env.SEED_ADMIN_PW || 'ChangeMe123!';
  const saltRounds = 12;
  const hash = await bcrypt.hash(plainPassword, saltRounds);
  seed.password = hash;
  await writeJSONFile(usersFilePath, [seed]);
  console.log('Seeded users.json with default admin account');
}

function verifyToken(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ message: 'Unauthorized' });
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// orders routes
app.get('/api/orders', verifyToken, async (req, res) => {
  try {
    const orders = await readJSONFile(ordersFilePath);
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching orders' });
  }
});
app.post('/api/orders', async (req, res) => {
  try {
    const newOrder = req.body;
    if (!newOrder || !newOrder.items || !Array.isArray(newOrder.items) || newOrder.items.length === 0 || !newOrder.customer) {
      return res.status(400).json({ message: 'Invalid order data' });
    }
    const orders = await readJSONFile(ordersFilePath);
    const lastId = orders.length > 0 ? parseInt(orders[orders.length - 1].id) : 0;
    newOrder.id = (lastId + 1).toString();
    newOrder.created_at = new Date().toISOString();
    newOrder.status = 'Pending';
    orders.push(newOrder);
    await writeJSONFile(ordersFilePath, orders);
    res.status(201).json({ success: true, order: newOrder });
  } catch {
    res.status(500).json({ message: 'Error saving order' });
  }
});
app.delete('/api/orders/:id', verifyToken, async (req, res) => {
  try {
    const orderId = req.params.id;
    let orders = await readJSONFile(ordersFilePath);
    const initialLength = orders.length;
    orders = orders.filter(order => order.id !== orderId);
    if (orders.length === initialLength) return res.status(404).json({ message: 'Order not found' });
    await writeJSONFile(ordersFilePath, orders);
    res.status(200).json({ message: 'Order deleted successfully' });
  } catch {
    res.status(500).json({ message: 'Error deleting order' });
  }
});
app.patch('/api/orders/:id', verifyToken, async (req, res) => {
  try {
    const orderId = req.params.id;
    const { payment_confirmed } = req.body;
    if (typeof payment_confirmed !== 'boolean') return res.status(400).json({ message: 'Invalid value' });
    let orders = await readJSONFile(ordersFilePath);
    const orderIndex = orders.findIndex(order => order.id === orderId);
    if (orderIndex === -1) return res.status(404).json({ message: 'Order not found' });
    orders[orderIndex].payment_confirmed = payment_confirmed;
    await writeJSONFile(ordersFilePath, orders);
    res.status(200).json({ message: 'Payment status updated' });
  } catch {
    res.status(500).json({ message: 'Error updating status' });
  }
});

// auth routes
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
  try {
    const users = await readJSONFile(usersFilePath);
    const user = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ email: user.email, id: user.id }, process.env.JWT_SECRET, { expiresIn: '8h' }); // Include user.id
    return res.status(200).json({ token, user: { id: user.id, email: user.email, name: user.name } }); // Return id and name
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Login error' });
  }
});
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password required' });
  try {
    const users = await readJSONFile(usersFilePath);
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) return res.status(409).json({ message: 'User already exists' });
    const saltRounds = 12;
    const hash = await bcrypt.hash(password, saltRounds);
    const newUser = { id: `user_${Date.now()}`, name, email, password: hash }; // Generate a simple ID
    users.push(newUser);
    await writeJSONFile(usersFilePath, users);
    const token = jwt.sign({ email, id: newUser.id }, process.env.JWT_SECRET, { expiresIn: '8h' }); // Include new user's ID
    res.status(201).json({ token, user: { id: newUser.id, name, email } }); // Return new user's ID and name
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Signup error' });
  }
});

// google auth
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID); // Use GOOGLE_CLIENT_ID here
app.post('/api/auth/google/callback', async (req, res) => {
  const { token } = req.body; // This 'token' is the ID token from Google
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID // Audience should be your Google Client ID
    });
    const payload = ticket.getPayload();
    const email = payload.email;
    const name = payload.name;
    let users = await readJSONFile(usersFilePath);
    let user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      // If user doesn't exist, create an account for them
      const newUserPassword = jwt.sign({ email }, process.env.JWT_SECRET); // Generate a strong random password hash
      const hash = await bcrypt.hash(newUserPassword, 12);
      user = { id: `google_${payload.sub}`, name, email, password: hash }; // Use Google's sub as part of ID
      users.push(user);
      await writeJSONFile(usersFilePath, users);
    }
    const appToken = jwt.sign({ email, id: user.id }, process.env.JWT_SECRET, { expiresIn: '8h' }); // Include user.id
    res.status(200).json({ token: appToken, user: { id: user.id, name, email } }); // Return id and name
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(401).json({ message: 'Invalid Google token' });
  }
});

// admin user management
app.get('/api/admin/users', verifyToken, async (req, res) => {
  try {
    const users = await readJSONFile(usersFilePath);
    // Ensure only necessary fields are exposed, and only to authorized users (you might add an admin role check)
    const safeUsers = users.map(({ id, email, name }) => ({ id, email, name })); // Include name if available
    res.status(200).json(safeUsers);
  } catch {
    res.status(500).json({ message: 'Error fetching users' });
  }
});
app.post('/api/admin/users', verifyToken, async (req, res) => {
  try {
    const { email, password, name } = req.body; // Allow setting a name
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
    const users = await readJSONFile(usersFilePath);
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) return res.status(409).json({ message: 'User already exists' });
    const hash = await bcrypt.hash(password, 12);
    const newUser = { id: `admin_${Date.now()}`, name: name || 'Admin User', email, password: hash };
    users.push(newUser);
    await writeJSONFile(usersFilePath, users);
    res.status(201).json({ message: 'Admin user created successfully' });
  } catch {
    res.status(500).json({ message: 'Error creating user' });
  }
});
app.delete('/api/admin/users/:email', verifyToken, async (req, res) => {
  try {
    const emailToDelete = req.params.email.toLowerCase();
    const users = await readJSONFile(usersFilePath);
    if (users.length <= 1) return res.status(403).json({ message: 'Cannot delete the last admin user' });
    if (req.user && emailToDelete === req.user.email.toLowerCase()) return res.status(403).json({ message: 'Cannot delete your own account' }); // Check req.user exists
    const filteredUsers = users.filter(u => u.email.toLowerCase() !== emailToDelete);
    if (filteredUsers.length === users.length) return res.status(404).json({ message: 'User not found' });
    await writeJSONFile(usersFilePath, filteredUsers);
    res.status(200).json({ message: 'Admin user deleted successfully' });
  } catch {
    res.status(500).json({ message: 'Error deleting user' });
  }
});

// start server
app.listen(PORT, async () => {
  await initializeOrdersFile();
  await initializeUsersFile();
  console.log(`Server running on http://localhost:${PORT}`);
});