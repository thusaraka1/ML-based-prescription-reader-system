import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { auth } from '../firebase/config';

const DashboardScreen = ({ navigation }) => {
  const [patientName, setPatientName] = useState('Patient');

  useEffect(() => {
    // Get the name from Firebase Auth
    const user = auth.currentUser;
    if (user && user.displayName) {
      // Split to get just the first name for a friendlier greeting
      const firstName = user.displayName.split(' ')[0];
      setPatientName(firstName);
    }
  }, []);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigation.replace('Login');
    } catch (error) {
      console.error(error);
    }
  };

  const FeatureCard = ({ title, icon, color, subtitle, onPress }) => (
    <TouchableOpacity style={[styles.card, { borderLeftColor: color }]} onPress={onPress}>
      <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
        <MaterialCommunityIcons name={icon} size={32} color={color} />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={24} color="#CBD5E1" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Header Section */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello,</Text>
            <Text style={styles.userName}>{patientName}</Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <MaterialCommunityIcons name="logout" size={24} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* Today's Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Summary</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryScroll}>
            <View style={[styles.summaryChip, { backgroundColor: '#E0F2FE' }]}>
              <MaterialCommunityIcons name="pill" size={20} color="#0EA5E9" />
              <Text style={[styles.summaryText, { color: '#0369A1' }]}>3 Meds left</Text>
            </View>
            <View style={[styles.summaryChip, { backgroundColor: '#FEF3C7' }]}>
              <MaterialCommunityIcons name="calendar-clock" size={20} color="#D97706" />
              <Text style={[styles.summaryText, { color: '#92400E' }]}>1 Appointment</Text>
            </View>
            <View style={[styles.summaryChip, { backgroundColor: '#DCFCE7' }]}>
              <MaterialCommunityIcons name="face-recognition" size={20} color="#16A34A" />
              <Text style={[styles.summaryText, { color: '#166534' }]}>Mood logged</Text>
            </View>
          </ScrollView>
        </View>

        {/* Emotion Tracker: AI Emotion Check */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How do you feel today?</Text>
          <TouchableOpacity style={styles.aiEmotionCard}>
            <View style={styles.aiEmotionContent}>
              <View style={styles.aiIconContainer}>
                <MaterialCommunityIcons name="face-recognition" size={32} color="#8B5CF6" />
              </View>
              <View style={styles.aiTextContainer}>
                <Text style={styles.aiTitle}>AI Emotion Check</Text>
                <Text style={styles.aiSubtitle}>Scan your face to log your mood</Text>
              </View>
            </View>
            <View style={styles.aiAction}>
              <MaterialCommunityIcons name="camera-front-variant" size={24} color="#8B5CF6" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Primary Action: Upload Rx */}
        <TouchableOpacity style={styles.uploadCard} onPress={() => navigation.navigate('UploadRx')}>
          <View style={styles.uploadContent}>
            <MaterialCommunityIcons name="file-document-outline" size={40} color="#FFFFFF" />
            <View style={styles.uploadTextContainer}>
              <Text style={styles.uploadTitle}>Upload Rx</Text>
              <Text style={styles.uploadSubtitle}>Scan a new prescription</Text>
            </View>
          </View>
          <View style={styles.uploadAction}>
            <MaterialCommunityIcons name="camera-plus" size={28} color="#0EA5E9" />
          </View>
        </TouchableOpacity>

        {/* Modules Grid */}
        <View style={styles.modulesContainer}>
          <FeatureCard 
            title="Medications" 
            subtitle="View your daily pills" 
            icon="pill" 
            color="#10B981" 
            onPress={() => navigation.navigate('Medications')} 
          />
          <FeatureCard 
            title="Meal Suggestions" 
            subtitle="AI-curated dietary plan" 
            icon="silverware-fork-knife" 
            color="#F97316" 
            onPress={() => navigation.navigate('MealPlan')} 
          />
          <FeatureCard 
            title="Appointments" 
            subtitle="Upcoming doctor visits" 
            icon="calendar-clock" 
            color="#F59E0B" 
            onPress={() => navigation.navigate('Appointments')} 
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContainer: { padding: 24, paddingBottom: 40 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, marginTop: 10 },
  greeting: { fontSize: 16, color: '#64748B', fontWeight: '500' },
  userName: { fontSize: 28, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
  logoutBtn: { padding: 8, backgroundColor: '#FEE2E2', borderRadius: 12 },

  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 16 },

  summaryScroll: { paddingRight: 20 },
  summaryChip: { 
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16, 
    borderRadius: 20, marginRight: 12 
  },
  summaryText: { fontSize: 14, fontWeight: '700', marginLeft: 8 },
  
  aiEmotionCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, 
    borderRadius: 20, shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 4, borderWidth: 1, borderColor: '#F5F3FF'
  },
  aiEmotionContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  aiIconContainer: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#F5F3FF', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  aiTextContainer: { flex: 1 },
  aiTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  aiSubtitle: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  aiAction: { backgroundColor: '#F5F3FF', padding: 10, borderRadius: 12 },

  uploadCard: { 
    backgroundColor: '#0EA5E9', borderRadius: 24, padding: 20, flexDirection: 'row', 
    alignItems: 'center', justifyContent: 'space-between', marginBottom: 32,
    shadowColor: '#0EA5E9', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8
  },
  uploadContent: { flexDirection: 'row', alignItems: 'center' },
  uploadTextContainer: { marginLeft: 16 },
  uploadTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  uploadSubtitle: { fontSize: 14, color: '#E0F2FE', fontWeight: '500' },
  uploadAction: { backgroundColor: '#FFFFFF', padding: 12, borderRadius: 16 },

  modulesContainer: { gap: 16 },
  card: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, 
    borderRadius: 20, borderLeftWidth: 4, shadowColor: '#64748B', shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 
  },
  iconContainer: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  cardSubtitle: { fontSize: 14, color: '#64748B', fontWeight: '500' },
});

export default DashboardScreen;
