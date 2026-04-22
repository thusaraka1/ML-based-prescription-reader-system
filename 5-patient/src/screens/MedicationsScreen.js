import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const MedicationsScreen = ({ navigation }) => {
  // Mock data for the UI
  const medications = [
    { id: 1, drugName: 'Amoxicillin', dosage: '500mg', frequency: 'Take 1 tablet twice daily', taken: true },
    { id: 2, drugName: 'Ibuprofen', dosage: '200mg', frequency: 'As needed for pain', taken: false },
    { id: 3, drugName: 'Lisinopril', dosage: '10mg', frequency: 'Take 1 tablet daily in the morning', taken: false }
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Medications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryContent}>
            <View>
              <Text style={styles.summaryTitle}>Daily Progress</Text>
              <Text style={styles.summarySubtitle}>1 of 3 taken today</Text>
            </View>
            <View style={styles.progressCircle}>
              <Text style={styles.progressText}>33%</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Active Prescriptions</Text>

        {/* Medication List */}
        <View style={styles.medList}>
          {medications.map((med) => (
            <View key={med.id} style={styles.medCard}>
              <View style={[styles.iconContainer, med.taken ? { backgroundColor: '#D1FAE5' } : { backgroundColor: '#F1F5F9' }]}>
                <MaterialCommunityIcons 
                  name="pill" 
                  size={28} 
                  color={med.taken ? '#059669' : '#94A3B8'} 
                />
              </View>
              
              <View style={styles.medInfo}>
                <Text style={[styles.drugName, med.taken && styles.drugNameTaken]}>{med.drugName}</Text>
                <Text style={styles.dosage}>{med.dosage}</Text>
                <Text style={styles.frequency}>{med.frequency}</Text>
              </View>

              <TouchableOpacity style={styles.actionBtn}>
                <MaterialCommunityIcons 
                  name={med.taken ? "check-circle" : "circle-outline"} 
                  size={28} 
                  color={med.taken ? '#10B981' : '#CBD5E1'} 
                />
              </TouchableOpacity>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9'
  },
  backBtn: { padding: 8, backgroundColor: '#F1F5F9', borderRadius: 20 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1E293B' },

  scrollContainer: { padding: 24, paddingBottom: 40 },

  summaryCard: {
    backgroundColor: '#10B981', borderRadius: 24, padding: 20, marginBottom: 32,
    shadowColor: '#10B981', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8
  },
  summaryContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  summarySubtitle: { fontSize: 14, color: '#D1FAE5', fontWeight: '500' },
  progressCircle: {
    width: 60, height: 60, borderRadius: 30, borderWidth: 4, borderColor: '#34D399',
    justifyContent: 'center', alignItems: 'center', backgroundColor: '#059669'
  },
  progressText: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 16 },

  medList: { gap: 16 },
  medCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    padding: 16, borderRadius: 20, borderWidth: 1, borderColor: '#F1F5F9',
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2
  },
  iconContainer: {
    width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 16
  },
  medInfo: { flex: 1 },
  drugName: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  drugNameTaken: { color: '#64748B', textDecorationLine: 'line-through' },
  dosage: { fontSize: 14, fontWeight: '600', color: '#3B82F6', marginBottom: 4 },
  frequency: { fontSize: 13, color: '#64748B' },
  
  actionBtn: { padding: 8 }
});

export default MedicationsScreen;
