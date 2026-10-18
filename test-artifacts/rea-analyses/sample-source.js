const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

// Simple encryption utility
function encrypt(text, key) {
  const cipher = crypto.createCipher('aes-256-cbc', key);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

// API endpoint
app.get('/api/data', (req, res) => {
  const data = {
    message: 'Hello from sample app',
    timestamp: Date.now(),
    encrypted: encrypt('secret data', 'my-key')
  };
  res.json(data);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = { app, encrypt };
