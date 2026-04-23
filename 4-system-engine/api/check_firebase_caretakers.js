import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function checkFirebaseCaretakers() {
  console.log('=========================================');
  console.log('🔥 Checking Firebase for Caretakers...');
  console.log('=========================================\n');

  try {
    const serviceAccountPath = path.resolve(__dirname, '../../serviceAccountKey.json');
    if (!fs.existsSync(serviceAccountPath)) {
      console.log('❌ ERROR: serviceAccountKey.json is missing!');
      console.log('   Please make sure the file is in the root directory of the project.');
      return;
    }

    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
    
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }

    console.log('✅ Connected to Firebase.');
    console.log('⏳ Fetching all users and inspecting roles...\n');
    
    const listUsersResult = await admin.auth().listUsers(1000);
    const caretakers = [];
    const patients = [];
    const admins = [];

    listUsersResult.users.forEach((user) => {
      const role = user.customClaims?.role || 'patient'; // Default to patient if no claim
      
      const userInfo = {
        email: user.email,
        uid: user.uid,
        name: user.displayName || 'No Name',
        role: role
      };

      if (role === 'caretaker') caretakers.push(userInfo);
      else if (role === 'admin') admins.push(userInfo);
      else patients.push(userInfo);
    });

    console.log(`📊 Found ${caretakers.length} Caretakers in Firebase:`);
    if (caretakers.length === 0) {
      console.log('   (No users with the "caretaker" role found in Firebase)');
    } else {
      caretakers.forEach(c => console.log(`   🩺 ${c.name} (${c.email})`));
    }

    console.log(`\n📊 Found ${patients.length} Patients in Firebase:`);
    patients.forEach(p => console.log(`   🛏️ ${p.name} (${p.email})`));

    console.log('\n=========================================');
    console.log('Check complete.');
    
  } catch (error) {
    console.log('\n❌ FIREBASE ERROR:');
    console.log(error.message);
  }
}

checkFirebaseCaretakers();
