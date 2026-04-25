import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const PatientListScreen = ({ navigation }) => {
  const [patients, setPatients] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  
  React.useEffect(() => {
    const fetchPatients = async () => {
      try {
        const { auth } = require('../firebase/config');
        const user = auth.currentUser;
        if (!user) return;
        
        const token = await user.getIdToken();
        const headers = { 'Authorization': `Bearer ${token}` };

        // 1. Fetch Caretaker Info
        const ctRes = await fetch(`https://api.careconnect.website/api/caretakers/${user.uid}`, { headers });
        if (!ctRes.ok) throw new Error('Failed to fetch caretaker info');
        const ctData = await ctRes.json();

        // 2. Fetch all residents and filter by assigned
        const resRes = await fetch('https://api.careconnect.website/api/residents', { headers });
        if (!resRes.ok) throw new Error('Failed to fetch residents');
        const allResidents = await resRes.json();

        const assignedIds = ctData.assigned_residents || [];
        const assignedResidents = allResidents.filter(r => assignedIds.includes(r.resident_id)).map(r => ({
          id: r.resident_id,
          name: r.name,
          room: r.room_number || 'TBD',
          age: r.age || 'N/A',
          status: 'stable',
          condition: r.medical_history || 'N/A',
          raw: r // store raw data to pass to profile
        }));

        setPatients(assignedResidents);
      } catch (err) {
        console.error('Error fetching patient list:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPatients();
  }, []);

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.room.toString().includes(searchQuery)
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#134E4A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>All Patients</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={20} color="#9CA3AF" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or room..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {filteredPatients.map(p => (
          <TouchableOpacity 
            key={p.id} 
            style={styles.patientCard}
            onPress={() => navigation.navigate('PatientProfile', { patient: p.raw || p })}
          >
            <View style={[styles.statusIndicator, 
              p.status === 'critical' ? { backgroundColor: '#E11D48' } : 
              p.status === 'warning' ? { backgroundColor: '#F59E0B' } : 
              { backgroundColor: '#10B981' }
            ]} />
            
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{p.name.charAt(0)}</Text>
            </View>

            <View style={styles.infoContainer}>
              <Text style={styles.name}>{p.name}</Text>
              <Text style={styles.details}>Room {p.room} • {p.age} yrs • {p.condition}</Text>
            </View>

            <MaterialCommunityIcons name="chevron-right" size={24} color="#94A3B8" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F0FDFA' },
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#CCFBF1'
  },
  backBtn: { padding: 8, backgroundColor: '#F0FDFA', borderRadius: 20 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#134E4A' },

  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    margin: 20, marginBottom: 10, paddingHorizontal: 16, borderRadius: 12,
    borderWidth: 1, borderColor: '#CCFBF1', height: 48
  },
  searchInput: { flex: 1, fontSize: 15, color: '#0F172A' },

  scrollContainer: { padding: 20, paddingBottom: 40 },

  patientCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    padding: 16, borderRadius: 16, marginBottom: 12,
    shadowColor: '#134E4A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2
  },
  statusIndicator: { width: 12, height: 12, borderRadius: 6, position: 'absolute', top: 16, left: 16, zIndex: 1, borderWidth: 2, borderColor: '#FFFFFF' },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#CCFBF1', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarText: { fontSize: 22, fontWeight: '800', color: '#0D9488' },
  
  infoContainer: { flex: 1 },
  name: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  details: { fontSize: 13, color: '#64748B', fontWeight: '500' }
});

export default PatientListScreen;
