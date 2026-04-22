import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// TODO: Replace with your Firebase config object
const firebaseConfig = {
  apiKey: "AIzaSyDogCfoI28FaRJ-8_IcxNaJ5FrocaX7H6Q",
  authDomain: "pescription.firebaseapp.com",
  projectId: "pescription",
  storageBucket: "pescription.firebasestorage.app",
  messagingSenderId: "874959405712",
  appId: "1:874959405712:web:795c54330532e4d3f68e15"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

export { auth };
