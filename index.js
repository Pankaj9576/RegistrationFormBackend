const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');

// Load environment variables from .env file
dotenv.config();
console.log('MONGODB_URI:', process.env.MONGODB_URI); // Debug line to verify MongoDB URI

const app = express();

// Updated CORS configuration to allow requests from Vercel frontend
app.use(cors({
  origin: ['https://registration-form-frontend-umber.vercel.app', 'http://localhost:3000'], // Allow both production and local development origins
  methods: ['GET', 'POST'], // Specify allowed methods
  credentials: true, // Allow credentials if needed
}));
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });

// Customer Schema
const customerSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  gender: { type: String, required: true },
  dateOfBirth: { type: String, required: true },
  address: { type: String, required: true },
  password: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  deviceInfo: { type: Object }, // Store device information
});

const Customer = mongoose.model('Customer', customerSchema);

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail', // Using Gmail as the email service
  auth: {
    user: process.env.EMAIL_USER, // Your Gmail address from .env
    pass: process.env.EMAIL_PASS, // Your Gmail App Password from .env
  },
});

// Function to send confirmation email
const sendConfirmationEmail = async (email, fullName) => {
  try {
    const mailOptions = {
      from: `"Registration System" <${process.env.EMAIL_USER}>`, // Sender address
      to: email, // Recipient's email
      subject: 'Registration Confirmation', // Email subject
      html: `
        <h2>Welcome, ${fullName}!</h2>
        <p>Thank you for registering with us!</p>
        <p>Your account has been successfully created. You can now log in using your email and password.</p>
        <p>If you did not initiate this registration, please contact our support team.</p>
        <p>Best regards,<br>Registration System Team</p>
      `, // HTML email content
    };

    // Send the email
    await transporter.sendMail(mailOptions);
    console.log(`Confirmation email sent to ${email}`);
  } catch (error) {
    console.error('Error sending email:', error.message);
    throw new Error('Failed to send confirmation email');
  }
};

// Test Route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is running!' });
});

// Fetch customer by phone number for auto-fill
app.get('/api/customers/phone/:phoneNumber', async (req, res) => {
  try {
    const customer = await Customer.findOne({ phoneNumber: req.params.phoneNumber });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    res.status(200).json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error.message);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// API to handle form submission and send confirmation email
app.post('/api/customers', async (req, res) => {
  try {
    const { fullName, email, phoneNumber, gender, dateOfBirth, address, password, confirmPassword, latitude, longitude, deviceInfo } = req.body;

    // Backend validations
    if (!fullName || !email || !phoneNumber || !gender || !dateOfBirth || !address || !password || !latitude || !longitude) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (!/^\d{10}$/.test(phoneNumber)) {
      return res.status(400).json({ error: 'Phone number must be 10 digits' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Create new customer
    const customer = new Customer({
      fullName,
      email,
      phoneNumber,
      gender,
      dateOfBirth,
      address,
      password, // In production, hash the password using bcrypt
      latitude,
      longitude,
      deviceInfo,
    });

    // Save Donations customer to database
    await customer.save();

    // Send confirmation email
    await sendConfirmationEmail(email, fullName);

    res.status(201).json({ message: 'Customer registered successfully and confirmation email sent' });
  } catch (error) {
    console.error('Error in /api/customers:', error.message);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));