#!/usr/bin/env node
/**
 * Generate a JWT for DoorDash Reporting API (Data Exchange).
 * Usage: set env vars or replace PASTE_YOUR_* below, then: node scripts/doordash-reporting-jwt.js
 * Requires: npm install jsonwebtoken (or use project root npm install)
 */
const jwt = require('jsonwebtoken');

const accessKey = {
  developer_id: process.env.DOORDASH_DEVELOPER_ID || 'PASTE_YOUR_DEVELOPER_ID_HERE',
  key_id: process.env.DOORDASH_KEY_ID || 'PASTE_YOUR_KEY_ID_HERE',
  signing_secret: process.env.DOORDASH_SIGNING_SECRET || 'PASTE_YOUR_BASE64_SIGNING_SECRET_HERE',
};

const data = {
  aud: 'doordash',
  iss: accessKey.developer_id,
  kid: accessKey.key_id,
  exp: Math.floor(Date.now() / 1000 + 300),
  iat: Math.floor(Date.now() / 1000),
};

const headers = { algorithm: 'HS256', header: { 'dd-ver': 'DD-JWT-V1' } };

const token = jwt.sign(
  data,
  Buffer.from(accessKey.signing_secret, 'base64'),
  headers,
);

console.log(token);
