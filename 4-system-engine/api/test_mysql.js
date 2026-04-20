import mysql from 'mysql2/promise';

const credentials = [
  { user: 'Nadun', password: 'Nadun@123' },
  { user: 'Nadun', password: 'Nadun@456' },
  { user: 'Nadun', password: 'admin' },
  { user: 'Nadun', password: 'admin123' },
  { user: 'Nadun', password: 'Admin123' },
  { user: 'Nadun', password: '' },
];

async function testPasswords() {
  for (const cred of credentials) {
    try {
      console.log(`Testing user: ${cred.user}, pass: ${cred.password === '' ? '<empty>' : cred.password}`);
      const connection = await mysql.createConnection({
        host: 'localhost',
        user: cred.user,
        password: cred.password,
      });
      console.log(`SUCCESS: Connected with user: ${cred.user}, password: ${cred.password === '' ? '<empty>' : cred.password}`);
      await connection.end();
      process.exit(0);
    } catch (err) {
      console.log(`Failed: ${err.message}`);
    }
  }
  console.log('All credentials failed.');
  process.exit(1);
}

testPasswords();
