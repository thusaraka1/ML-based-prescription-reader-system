import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const PatientProfileScreen = ({ route, navigation }) => {
  // Get patient data from navigation parameters
  const { patient } = route.params || { patient: { name: 'Kalani', room: '101', age: 72 } };

  const [activeTab, setActiveTab] = useState('meds');

  // State variables for real data
  const [residentDetails, setResidentDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const fetchResidentDetails = async () => {
      try {
        const { auth } = require('../firebase/config');
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch(`https://api.careconnect.website/api/residents/${patient.resident_id || patient.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch details');
        const data = await res.json();
        setResidentDetails(data);
      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchResidentDetails();
  }, [patient]);

  // Extract medications from prescriptions
  const medications = [];
  if (residentDetails?.prescriptions) {
    residentDetails.prescriptions.forEach(rx => {
      if (rx.medications) {
        rx.medications.forEach(med => {
          medications.push({ ...med, prescription_id: rx.prescription_id });
        });
      }
    });
  }

  const handleFinishMedication = async (med) => {
    try {
      const { auth } = require('../firebase/config');
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`https://api.careconnect.website/api/prescriptions/${med.prescription_id}/medications`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ medicationId: med.id })
      });
      if (!res.ok) throw new Error('Failed to finish medication');
      
      // Optimistically update UI by refetching
      const refreshRes = await fetch(`https://api.careconnect.website/api/residents/${patient.resident_id || patient.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await refreshRes.json();
      setResidentDetails(data);
    } catch (err) {
      console.error(err);
      alert('Error marking medication as finished');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#134E4A" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{patient.name}</Text>
          <Text style={styles.headerSubtitle}>Room {patient.room} • {patient.age} yrs</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Quick Actions (Rx, Appt, Meals) */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: '#3B82F6' }]}
            onPress={() => navigation.navigate('UploadRx', { patient })}
          >
            <MaterialCommunityIcons name="file-document-outline" size={20} color="#FFF" />
            <Text style={styles.actionText}>Rx</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#10B981' }]}>
            <MaterialCommunityIcons name="calendar-clock" size={20} color="#FFF" />
            <Text style={styles.actionText}>Appt</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#F97316' }]}>
            <MaterialCommunityIcons name="silverware-fork-knife" size={20} color="#FFF" />
            <Text style={styles.actionText}>Meals</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'meds' && styles.tabActive]}
            onPress={() => setActiveTab('meds')}
          >
            <Text style={[styles.tabText, activeTab === 'meds' && styles.tabTextActive]}>Meds ({medications.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'history' && styles.tabActive]}
            onPress={() => setActiveTab('history')}
          >
            <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>History ({residentDetails?.finishedMedications?.length || 0})</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'diet' && styles.tabActive]}
            onPress={() => setActiveTab('diet')}
          >
            <Text style={[styles.tabText, activeTab === 'diet' && styles.tabTextActive]}>Diet Plan</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'meds' && (
            <View>
              {medications.length === 0 && <Text style={styles.emptyText}>No active medications.</Text>}
              {medications.map((med) => (
                <View key={med.id} style={styles.medCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.medName}>{med.drug_name}</Text>
                    <Text style={styles.medDetails}>{med.dosage} • {med.frequency}</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.finishBtn}
                    onPress={() => handleFinishMedication(med)}
                  >
                    <Text style={styles.finishText}>Finish</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {activeTab === 'history' && (
            <View>
              {(!residentDetails?.finishedMedications || residentDetails.finishedMedications.length === 0) ? (
                <View style={styles.emptyState}>
                  <MaterialCommunityIcons name="history" size={48} color="#CBD5E1" />
                  <Text style={styles.emptyText}>No history available.</Text>
                </View>
              ) : (
                residentDetails.finishedMedications.map((historyItem) => (
                  <View key={historyItem.id} style={styles.medCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.medName}>{historyItem.drug_name}</Text>
                      <Text style={styles.medDetails}>Finished: {new Date(historyItem.finished_at).toLocaleString()}</Text>
                    </View>
                    <MaterialCommunityIcons name="check-circle" size={24} color="#10B981" />
                  </View>
                ))
              )}
            </View>
          )}

          {activeTab === 'diet' && (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="food-apple-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyText}>Diet plan loading...</Text>
            </View>
          )}
        </View>

        {/* Emotional Wellness Section */}
        <View style={styles.wellnessSection}>
          <Text style={styles.sectionTitle}>Emotional Wellness</Text>
          
          {residentDetails?.emotionalStates && residentDetails.emotionalStates.length > 0 ? (
            <View style={styles.wellnessCard}>
              <View style={styles.emotionIcon}>
                <MaterialCommunityIcons 
                  name={residentDetails.emotionalStates[0].emotion_label === 'Happy' ? 'emoticon-happy-outline' : 
                        residentDetails.emotionalStates[0].emotion_label === 'Sad' ? 'emoticon-sad-outline' : 
                        'emoticon-neutral-outline'} 
                  size={32} 
                  color={residentDetails.emotionalStates[0].emotion_label === 'Happy' ? '#10B981' : '#F59E0B'} 
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.wellnessStatus}>Feeling {residentDetails.emotionalStates[0].emotion_label}</Text>
                <Text style={styles.wellnessTime}>{new Date(residentDetails.emotionalStates[0].recorded_at).toLocaleString()}</Text>
              </View>
              <TouchableOpacity style={styles.viewLogBtn}>
                <Text style={styles.viewLogText}>View Log</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.emptyText}>No wellness logs recorded.</Text>
          )}
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
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0'
  },
  backBtn: { padding: 8, backgroundColor: '#F0FDFA', borderRadius: 20 },
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
  headerSubtitle: { fontSize: 13, color: '#64748B', fontWeight: '500' },

  scrollContainer: { padding: 16, paddingBottom: 40 },

  quickActionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  actionBtn: { 
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', 
    paddingVertical: 12, borderRadius: 12, marginHorizontal: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2
  },
  actionText: { color: '#FFF', fontWeight: '700', marginLeft: 8, fontSize: 15 },

  tabsContainer: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#F0FDFA' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  tabTextActive: { color: '#0D9488' },

  tabContent: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#E2E8F0' },
  
  medCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  medName: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 2 },
  medDetails: { fontSize: 13, color: '#64748B' },
  
  finishBtn: { 
    borderWidth: 1, borderColor: '#10B981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: '#ECFDF5'
  },
  finishBtnDone: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
  finishText: { color: '#059669', fontSize: 12, fontWeight: '700' },
  finishTextDone: { color: '#94A3B8' },

  emptyState: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { color: '#94A3B8', marginTop: 8, fontWeight: '500' },

  wellnessSection: { marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 12, marginLeft: 4 },
  wellnessCard: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: '#E2E8F0'
  },
  emotionIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  wellnessStatus: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 2 },
  wellnessTime: { fontSize: 13, color: '#64748B' },
  viewLogBtn: { padding: 8 },
  viewLogText: { color: '#3B82F6', fontWeight: '700', fontSize: 13 }
});

export default PatientProfileScreen;
