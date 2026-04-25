import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch, getResidentId } from '../apiHelper';

const TAKEN_KEY = '@medications_taken_today';

const MedicationsScreen = ({ navigation }) => {
  const [medications, setMedications] = useState([]);
  const [takenIds, setTakenIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMedications = useCallback(async () => {
    try {
      const residentId = await getResidentId();
      const res = await apiFetch(`/residents/${residentId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();

      // Flatten all medications from all prescriptions
      const allMeds = [];
      for (const rx of (data.prescriptions || [])) {
        for (const med of (rx.medications || [])) {
          allMeds.push({
            id: med.id || `${rx.prescription_id}-${med.drug_name}`,
            prescriptionId: rx.prescription_id,
            drugName: med.drug_name,
            dosage: med.dosage || '',
            frequency: med.frequency || 'As directed',
            dateIssued: rx.date_issued,
          });
        }
      }
      setMedications(allMeds);

      // Load today's taken state
      const todayKey = `${TAKEN_KEY}_${new Date().toISOString().split('T')[0]}`;
      const stored = await AsyncStorage.getItem(todayKey);
      if (stored) setTakenIds(new Set(JSON.parse(stored)));
    } catch (err) {
      console.error('[Medications] Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchMedications(); }, [fetchMedications]);

  const toggleTaken = async (medId) => {
    const updated = new Set(takenIds);
    if (updated.has(medId)) {
      updated.delete(medId);
    } else {
      updated.add(medId);
    }
    setTakenIds(updated);
    const todayKey = `${TAKEN_KEY}_${new Date().toISOString().split('T')[0]}`;
    await AsyncStorage.setItem(todayKey, JSON.stringify([...updated]));
  };

  const handleFinishMed = (med) => {
    Alert.alert(
      'Finish Medication',
      `Mark "${med.drugName}" as permanently finished? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finish', style: 'destructive',
          onPress: async () => {
            try {
              const res = await apiFetch(`/prescriptions/${med.prescriptionId}/medications`, {
                method: 'DELETE',
                body: JSON.stringify({ drugName: med.drugName, dosage: med.dosage, frequency: med.frequency }),
              });
              if (!res.ok) throw new Error('Failed');
              Alert.alert('Done', `${med.drugName} marked as finished.`);
              fetchMedications();
            } catch (err) {
              Alert.alert('Error', 'Could not finish medication.');
            }
          }
        }
      ]
    );
  };

  const takenCount = medications.filter(m => takenIds.has(m.id)).length;
  const totalCount = medications.length;
  const progress = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}><ActivityIndicator size="large" color="#10B981" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Medications</Text>
        <TouchableOpacity onPress={fetchMedications} style={styles.refreshBtn}>
          <MaterialCommunityIcons name="refresh" size={22} color="#10B981" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchMedications(); }} colors={['#10B981']} />}
      >
        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryContent}>
            <View>
              <Text style={styles.summaryTitle}>Daily Progress</Text>
              <Text style={styles.summarySubtitle}>{takenCount} of {totalCount} taken today</Text>
            </View>
            <View style={styles.progressCircle}>
              <Text style={styles.progressText}>{progress}%</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Active Prescriptions</Text>

        {totalCount === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="pill-off" size={48} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Active Medications</Text>
            <Text style={styles.emptySubtitle}>Upload a prescription to get started.</Text>
            <TouchableOpacity style={styles.uploadBtn} onPress={() => navigation.navigate('UploadRx')}>
              <MaterialCommunityIcons name="camera-plus" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.uploadBtnText}>Upload Prescription</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.medList}>
            {medications.map((med) => {
              const taken = takenIds.has(med.id);
              return (
                <TouchableOpacity key={med.id} style={styles.medCard} onLongPress={() => handleFinishMed(med)} activeOpacity={0.7}>
                  <View style={[styles.iconContainer, taken ? { backgroundColor: '#D1FAE5' } : { backgroundColor: '#F1F5F9' }]}>
                    <MaterialCommunityIcons name="pill" size={28} color={taken ? '#059669' : '#94A3B8'} />
                  </View>
                  
                  <View style={styles.medInfo}>
                    <Text style={[styles.drugName, taken && styles.drugNameTaken]}>{med.drugName}</Text>
                    <Text style={styles.dosage}>{med.dosage || 'No dosage specified'}</Text>
                    <Text style={styles.frequency}>{med.frequency || 'As directed'}</Text>
                  </View>

                  <TouchableOpacity style={styles.actionBtn} onPress={() => toggleTaken(med.id)}>
                    <MaterialCommunityIcons 
                      name={taken ? "check-circle" : "circle-outline"} 
                      size={28} 
                      color={taken ? '#10B981' : '#CBD5E1'} 
                    />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
            <Text style={styles.hintText}>Long-press a medication to mark it as permanently finished.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9'
  },
  backBtn: { padding: 8, backgroundColor: '#F1F5F9', borderRadius: 20 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1E293B' },
  refreshBtn: { padding: 8, backgroundColor: '#ECFDF5', borderRadius: 20 },

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

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#64748B', marginTop: 16, marginBottom: 4 },
  emptySubtitle: { fontSize: 14, color: '#94A3B8', marginBottom: 20 },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#0EA5E9',
    paddingVertical: 12, paddingHorizontal: 24, borderRadius: 16,
  },
  uploadBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

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
  
  actionBtn: { padding: 8 },
  hintText: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 12, fontStyle: 'italic' },
});

export default MedicationsScreen;
