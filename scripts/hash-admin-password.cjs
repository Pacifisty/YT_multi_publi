'use strict';

const { randomBytes, scryptSync } = require('node:crypto');

const password = process.env.ADMIN_PASSWORD;
if (!password || password.length < 12) {
  console.error('Defina ADMIN_PASSWORD com pelo menos 12 caracteres somente para executar este comando.');
  process.exitCode = 1;
} else {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64).toString('base64url');
  process.stdout.write(`scrypt:${salt}:${derivedKey}\n`);
}
