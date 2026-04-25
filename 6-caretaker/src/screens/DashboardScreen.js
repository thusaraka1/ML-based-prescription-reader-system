import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/config';

const DashboardScreen = ({ navigation }) => {
  // Mock data for popping alerts
  const alerts = [
    { id: 1, type: 'critical', message: 'Kalani reported severe pain.', time: 'Just now' },
    { id: 2, type: 'warning', message: 'David missed afternoon medication.', time: '10 mins ago' }
  ];

  const [caretakerName, setCaretakerName] = React.useState('Caretaker');
  const [patients, setPatients] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        
        const token = await user.getIdToken();
        const headers = { 'Authorization': `Bearer ${token}` };

        // 1. Fetch Caretaker Info (includes assigned_residents array)
        const ctRes = await fetch(`https://api.careconnect.website/api/caretakers/${user.uid}`, { headers });
        if (!ctRes.ok) throw new Error('Failed to fetch caretaker info');
        const ctData = await ctRes.json();
        setCaretakerName(ctData.name.split(' ')[0] || 'Caretaker'); // First name

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
          status: 'stable', // We can derive this later if needed
          raw: r // store raw data to pass to profile
        }));

        setPatients(assignedResidents);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleLeave = () => {
    navigation.navigate('LeaveRequest');
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigation.replace('Login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.name}>{caretakerName}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave}>
            <MaterialCommunityIcons name="calendar-clock" size={20} color="#B45309" />
            <Text style={styles.leaveText}>Request Leave</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <MaterialCommunityIcons name="logout" size={24} color="#64748B" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Popping Alerts Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="bell-ring-outline" size={20} color="#E11D48" />
            <Text style={styles.sectionTitle}>Active Alerts</Text>
            <View style={styles.badge}><Text style={styles.badgeText}>{alerts.length}</Text></View>
          </View>
          
          {alerts.map((alert) => (
            <TouchableOpacity 
              key={alert.id} 
              style={[styles.alertCard, alert.type === 'critical' ? styles.alertCritical : styles.alertWarning]}
            >
              <MaterialCommunityIcons 
                name={alert.type === 'critical' ? 'alert-decagram' : 'alert-circle'} 
                size={28} 
                color={alert.type === 'critical' ? '#9F1239' : '#B45309'} 
              />
              <View style={styles.alertInfo}>
                <Text style={[styles.alertText, alert.type === 'critical' ? { color: '#881337' } : { color: '#78350F' }]}>
                  {alert.message}
                </Text>
                <Text style={styles.alertTime}>{alert.time}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* View All Patients Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderBetween}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="account-group-outline" size={20} color="#0F766E" />
              <Text style={styles.sectionTitle}>Assigned Patients</Text>
            </View>
            <TouchableOpacity style={styles.viewAllBtn} onPress={() => navigation.navigate('PatientList')}>
              <Text style={styles.viewAllText}>View All</Text>
              <MaterialCommunityIcons name="arrow-right" size={16} color="#0D9488" />
            </TouchableOpacity>
          </View>

          <View style={styles.patientGrid}>
            {patients.map(p => (
              <TouchableOpacity 
                key={p.id} 
                style={styles.patientCard}
                onPress={() => navigation.navigate('PatientProfile', { patient: p.raw || p })}
              >
                <View style={[styles.statusIndicator, p.status === 'critical' ? { backgroundColor: '#E11D48' } : { backgroundColor: '#10B981' }]} />
                <View style={styles.patientAvatar}>
                  <Text style={styles.avatarText}>{p.name.charAt(0)}</Text>
                </View>
                <Text style={styles.patientName}>{p.name}</Text>
                <Text style={styles.patientRoom}>Room {p.room}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Emergency Button */}
        <View style={styles.sosContainer}>
          <TouchableOpacity style={styles.sosButton}>
            <MaterialCommunityIcons name="phone-alert" size={48} color="#FFFFFF" />
            <Text style={styles.sosText}>EMERGENCY SOS</Text>
            <Text style={styles.sosSubtext}>Tap to broadcast to all staff</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F0FDFA' }, // Light teal background
  
  header: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#CCFBF1'
  },
  greeting: { fontSize: 13, color: '#0F766E', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  name: { fontSize: 22, fontWeight: '800', color: '#134E4A' },
  leaveBtn: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', 
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginRight: 12
  },
  leaveText: { color: '#B45309', fontWeight: '700', marginLeft: 4, fontSize: 13 },
  logoutBtn: { padding: 8, backgroundColor: '#F1F5F9', borderRadius: 12 },

  scrollContainer: { padding: 20, paddingBottom: 40 },

  section: { marginBottom: 32 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionHeaderBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#134E4A', marginLeft: 8 },
  badge: { backgroundColor: '#E11D48', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginLeft: 8 },
  badgeText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },

  alertCard: { 
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 12,
    borderWidth: 1, elevation: 2, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4
  },
  alertCritical: { backgroundColor: '#FFE4E6', borderColor: '#FECDD3', shadowColor: '#E11D48' },
  alertWarning: { backgroundColor: '#FEF3C7', borderColor: '#FDE68A', shadowColor: '#D97706' },
  alertInfo: { flex: 1, marginLeft: 16 },
  alertText: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  alertTime: { fontSize: 12, color: '#64748B', fontWeight: '600' },

  viewAllBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#CCFBF1', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  viewAllText: { color: '#0D9488', fontWeight: '700', fontSize: 13, marginRight: 4 },

  patientGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  patientCard: { 
    width: '31%', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, alignItems: 'center', marginBottom: 12,
    shadowColor: '#134E4A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2
  },
  statusIndicator: { width: 10, height: 10, borderRadius: 5, position: 'absolute', top: 10, right: 10 },
  patientAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F0FDFA', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#0D9488' },
  patientName: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 2 },
  patientRoom: { fontSize: 11, color: '#64748B', fontWeight: '600' },

  sosContainer: { marginTop: 10 },
  sosButton: {
    backgroundColor: '#E11D48', borderRadius: 24, padding: 24, alignItems: 'center',
    shadowColor: '#E11D48', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
    borderWidth: 4, borderColor: '#FFE4E6'
  },
  sosText: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginTop: 12, letterSpacing: 1 },
  sosSubtext: { color: '#FECDD3', fontSize: 13, fontWeight: '600', marginTop: 4 }

});

export default DashboardScreen;
