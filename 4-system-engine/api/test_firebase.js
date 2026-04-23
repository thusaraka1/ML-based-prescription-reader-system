import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

async function testFirebase() {
  console.log('=========================================');
  console.log('🔥 Firebase Connection Diagnostic');
  console.log('=========================================\n');

  try {
    const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
    if (!fs.existsSync(serviceAccountPath)) {
      console.log('❌ ERROR: serviceAccountKey.json is MISSING in 4-system-engine/api/');
      console.log('   Your backend cannot authenticate with Firebase without this file!');
      return;
    }

    console.log('✅ serviceAccountKey.json found.');
    
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    console.log('✅ Connected to Firebase successfully!');
    
    console.log('\nFetching Firebase Users...');
    const listUsersResult = await admin.auth().listUsers(100);
    
    console.log(`\n📊 Found ${listUsersResult.users.length} users registered in Firebase:`);
    listUsersResult.users.forEach((userRecord) => {
      console.log(`   - ${userRecord.email} (UID: ${userRecord.uid})`);
    });

    console.log('\n=========================================');
    console.log('Firebase is working perfectly!');
    
  } catch (error) {
    console.log('\n❌ FIREBASE ERROR:');
    console.log(error.message);
  }
}

testFirebase();
