import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../firebase/config';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Required Fields", "Please enter your email and password.");
      return;
    }
    
    setLoading(true);
    try {
      // 1. Authenticate with Firebase
      const credential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const user = credential.user;
      
      // 2. Get JWT token
      const token = await user.getIdToken();

      // 3. Verify role with backend securely via Cloudflare
      const apiUrl = 'https://api.careconnect.website/api';
      const userRes = await fetch(`${apiUrl}/users/${user.uid}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!userRes.ok) {
        // User authenticated via Firebase but has no record in the system
        await signOut(auth);
        Alert.alert(
          "Account Not Found",
          "Your Firebase account is not linked to a caretaker profile. Caretaker accounts are provisioned by administrators."
        );
        setLoading(false);
        return;
      }

      const userData = await userRes.json();
      
      if (userData.role !== 'caretaker') {
        // Not a caretaker! Sign them out immediately.
        await signOut(auth);
        Alert.alert("Access Denied", "This portal is strictly for Caretakers. Please use the Patient App.");
        setLoading(false);
        return;
      }

      // Success!
      navigation.replace('Dashboard');
    } catch (error) {
      console.error('Login error:', error);
      const msg = error?.code === 'auth/invalid-credential'
        ? 'Incorrect email or password. Please check and try again.'
        : error?.code === 'auth/user-not-found'
        ? 'No account found with this email.'
        : error?.code === 'auth/too-many-requests'
        ? 'Too many failed attempts. Please try again later.'
        : error?.message || 'An unexpected error occurred.';
      Alert.alert("Login Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.keyboardView} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          
          <View style={styles.headerContainer}>
            <View style={styles.logoContainer}>
              <MaterialCommunityIcons name="shield-account" size={48} color="#0D9488" />
            </View>
            <Text style={styles.brandName}>CareConnect</Text>
            <Text style={styles.subtitle}>Caretaker Portal</Text>
          </View>

          <View style={styles.formContainer}>
            <Text style={styles.label}>Caretaker Email</Text>
            <View style={styles.inputWrapper}>
              <MaterialCommunityIcons name="email-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrapper}>
              <MaterialCommunityIcons name="lock-outline" size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity style={styles.forgotBtn}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
              <MaterialCommunityIcons name="login" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.loginBtnText}>{loading ? 'Authenticating...' : 'Sign In'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.adminNote}>
            <MaterialCommunityIcons name="information-outline" size={16} color="#0F766E" />
            <Text style={styles.adminNoteText}>
              Caretaker accounts are provisioned by system administrators. 
              Contact support if you need access.
            </Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F0FDFA' }, // Light teal background
  keyboardView: { flex: 1 },
  scrollContainer: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 24, justifyContent: 'center' },
  
  headerContainer: { alignItems: 'center', marginBottom: 40 },
  logoContainer: { 
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#CCFBF1', 
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    borderWidth: 2, borderColor: '#99F6E4'
  },
  brandName: { fontSize: 28, fontWeight: '800', color: '#134E4A', marginBottom: 4, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: '#0D9488', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5 },
  
  formContainer: { width: '100%', backgroundColor: '#FFFFFF', padding: 24, borderRadius: 24, shadowColor: '#134E4A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 16, elevation: 4 },
  
  label: { fontSize: 14, color: '#115E59', marginBottom: 8, fontWeight: '700' },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC',
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, marginBottom: 20, paddingHorizontal: 16
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: 50, color: '#0F172A', fontSize: 15 },
  
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 24 },
  forgotText: { color: '#0D9488', fontSize: 14, fontWeight: '600' },
  
  loginBtn: {
    backgroundColor: '#0D9488', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: 12,
    shadowColor: '#0D9488', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4
  },
  loginBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  adminNote: { 
    flexDirection: 'row', backgroundColor: '#CCFBF1', padding: 16, borderRadius: 12, 
    marginTop: 32, alignItems: 'flex-start' 
  },
  adminNoteText: { flex: 1, color: '#0F766E', fontSize: 13, lineHeight: 18, marginLeft: 8, fontWeight: '500' }
});

export default LoginScreen;
