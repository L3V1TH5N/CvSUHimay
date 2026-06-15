// file path: backend/createAdmin.js
// Run this to create a fresh admin account

require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function createAdmin() {
  try {
    // Connect to database
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
    });

    console.log('Connected to database...');

    // Delete existing admin if exists
    await connection.query('DELETE FROM users WHERE email = ?', ['admin@cvsuhimay.edu.ph']);
    console.log('Removed existing admin (if any)...');

    // Hash the password
    const password = 'admin123';
    const hash = await bcrypt.hash(password, 10);

    // Insert new admin
    const [result] = await connection.query(
      'INSERT INTO users (email, password_hash, role, full_name) VALUES (?, ?, ?, ?)',
      ['admin@cvsuhimay.edu.ph', hash, 'admin', 'System Administrator']
    );

    console.log('\n========================================');
    console.log('✅ Admin Account Created Successfully!');
    console.log('========================================');
    console.log('Email:', 'admin@cvsuhimay.edu.ph');
    console.log('Password:', password);
    console.log('User ID:', result.insertId);
    console.log('========================================\n');

    await connection.end();
  } catch (error) {
    console.error('Error creating admin:', error);
  }
}

createAdmin();