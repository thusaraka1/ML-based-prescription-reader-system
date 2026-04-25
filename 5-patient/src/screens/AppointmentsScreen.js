import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { apiFetch, getResidentId } from '../apiHelper';
import { auth } from '../firebase/config';

const AppointmentsScreen = ({ navigation }) => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showBookModal, setShowBookModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Booking form state
  const [doctorName, setDoctorName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [reason, setReason] = useState('');

  const fetchAppointments = useCallback(async () => {
    try {
      const residentId = await getResidentId();
      const res = await apiFetch(`/residents/${residentId}/appointments`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      // Sort by date ascending (upcoming first)
      data.sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date));
      setAppointments(data);
    } catch (err) {
      console.error('[Appointments] Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  const handleBookAppointment = async () => {
    if (!doctorName.trim() || !appointmentDate.trim()) {
      Alert.alert('Required', 'Doctor name and date are required.');
      return;
    }

    // Validate date format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate.trim())) {
      Alert.alert('Invalid Date', 'Please enter date in YYYY-MM-DD format (e.g. 2026-05-01).');
      return;
    }

    setSubmitting(true);
    try {
      const residentId = await getResidentId();
      const user = auth.currentUser;
      const res = await apiFetch('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          residentId,
          residentName: user?.displayName || 'Patient',
          doctorName: doctorName.trim(),
          specialization: specialization.trim(),
          appointmentDate: appointmentDate.trim(),
          appointmentTime: appointmentTime.trim() || '09:00 AM',
          reason: reason.trim() || 'General Checkup',
        }),
      });

      if (!res.ok) throw new Error('Failed to book');
      Alert.alert('Booked!', 'Your appointment has been scheduled.');
      setShowBookModal(false);
      resetForm();
      fetchAppointments();
    } catch (err) {
      console.error('[Appointments] Book error:', err);
      Alert.alert('Error', 'Could not book the appointment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelAppointment = (apt) => {
    Alert.alert(
      'Cancel Appointment',
      `Cancel your appointment with ${apt.doctor_name || 'the doctor'}?`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel It', style: 'destructive',
          onPress: async () => {
            try {
              const res = await apiFetch(`/appointments/${apt.appointment_id}`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'cancelled' }),
              });
              if (!res.ok) throw new Error('Failed');
              fetchAppointments();
            } catch (err) {
              Alert.alert('Error', 'Could not cancel the appointment.');
            }
          }
        }
      ]
    );
  };

  const resetForm = () => {
    setDoctorName('');
    setSpecialization('');
    setAppointmentDate('');
    setAppointmentTime('');
    setReason('');
  };

  // Find next upcoming appointment
  const today = new Date().toISOString().split('T')[0];
  const upcoming = appointments.filter(a => a.appointment_date >= today && a.status !== 'cancelled');
  const nextApt = upcoming[0];

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const getDaysUntil = (dateStr) => {
    if (!dateStr) return '';
    const target = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff < 0) return `${Math.abs(diff)} days ago`;
    return `in ${diff} days`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}><ActivityIndicator size="large" color="#F59E0B" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Appointments</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowBookModal(true)}>
          <MaterialCommunityIcons name="plus" size={24} color="#F59E0B" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAppointments(); }} colors={['#F59E0B']} />}
      >
        {/* Banner */}
        <View style={styles.bannerCard}>
          <View style={styles.bannerContent}>
            <View>
              <Text style={styles.bannerTitle}>{nextApt ? 'Next Appointment' : 'No Upcoming'}</Text>
              <Text style={styles.bannerSubtitle}>
                {nextApt ? getDaysUntil(nextApt.appointment_date) : 'Book one below'}
              </Text>
            </View>
            {nextApt && (
              <View style={styles.dateCircle}>
                <Text style={styles.dateNum}>{new Date(nextApt.appointment_date + 'T00:00:00').getDate()}</Text>
                <Text style={styles.dateMonth}>{new Date(nextApt.appointment_date + 'T00:00:00').toLocaleString('en', { month: 'short' }).toUpperCase()}</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          {upcoming.length > 0 ? 'Upcoming Visits' : 'All Appointments'}
        </Text>

        {appointments.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="calendar-blank" size={48} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Appointments</Text>
            <Text style={styles.emptySubtitle}>Book your first appointment with a doctor.</Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {appointments.map((apt) => {
              const isCancelled = apt.status === 'cancelled';
              const isPast = apt.appointment_date < today;
              return (
                <View key={apt.appointment_id} style={[styles.aptCard, isCancelled && styles.aptCardCancelled]}>
                  <View style={styles.aptHeader}>
                    <View style={styles.dateTimeBadge}>
                      <MaterialCommunityIcons name="calendar-clock" size={16} color="#B45309" style={{ marginRight: 6 }} />
                      <Text style={styles.dateTimeText}>
                        {formatDate(apt.appointment_date)}{apt.appointment_time ? ` at ${apt.appointment_time}` : ''}
                      </Text>
                    </View>
                    {isCancelled ? (
                      <View style={[styles.typeBadge, { backgroundColor: '#FEE2E2' }]}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#DC2626' }}>CANCELLED</Text>
                      </View>
                    ) : (
                      <View style={[styles.typeBadge, { backgroundColor: isPast ? '#F1F5F9' : '#DCFCE7' }]}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: isPast ? '#64748B' : '#16A34A' }}>
                          {isPast ? 'PAST' : 'UPCOMING'}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.aptBody}>
                    <View style={styles.docAvatar}>
                      <Text style={styles.avatarText}>
                        {(apt.doctor_name || 'D').replace('Dr. ', '').charAt(0)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.docName, isCancelled && { textDecorationLine: 'line-through', color: '#94A3B8' }]}>
                        {apt.doctor_name || 'Doctor'}
                      </Text>
                      <Text style={styles.docSpec}>{apt.specialization || 'General'}</Text>
                    </View>
                  </View>

                  <View style={styles.aptFooter}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <MaterialCommunityIcons name="text-box-outline" size={16} color="#94A3B8" style={{ marginRight: 6 }} />
                      <Text style={styles.reasonText}>{apt.reason || 'General Checkup'}</Text>
                    </View>
                    {!isCancelled && !isPast && (
                      <TouchableOpacity onPress={() => handleCancelAppointment(apt)}>
                        <MaterialCommunityIcons name="close-circle-outline" size={22} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Book Button */}
        <TouchableOpacity style={styles.bookBtn} onPress={() => setShowBookModal(true)}>
          <MaterialCommunityIcons name="calendar-plus" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.bookBtnText}>Book New Appointment</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Booking Modal */}
      <Modal visible={showBookModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Book Appointment</Text>
              <TouchableOpacity onPress={() => { setShowBookModal(false); resetForm(); }}>
                <MaterialCommunityIcons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>Doctor Name *</Text>
              <TextInput style={styles.input} placeholder="Dr. Jane Smith" value={doctorName} onChangeText={setDoctorName} placeholderTextColor="#9CA3AF" />

              <Text style={styles.inputLabel}>Specialization</Text>
              <TextInput style={styles.input} placeholder="Cardiologist, General, etc." value={specialization} onChangeText={setSpecialization} placeholderTextColor="#9CA3AF" />

              <Text style={styles.inputLabel}>Date * (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} placeholder="2026-05-01" value={appointmentDate} onChangeText={setAppointmentDate} placeholderTextColor="#9CA3AF" />

              <Text style={styles.inputLabel}>Time</Text>
              <TextInput style={styles.input} placeholder="10:00 AM" value={appointmentTime} onChangeText={setAppointmentTime} placeholderTextColor="#9CA3AF" />

              <Text style={styles.inputLabel}>Reason</Text>
              <TextInput style={styles.input} placeholder="Routine Checkup" value={reason} onChangeText={setReason} placeholderTextColor="#9CA3AF" />

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleBookAppointment}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="check-circle" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.submitBtnText}>Confirm Booking</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  addBtn: { padding: 8, backgroundColor: '#FEF3C7', borderRadius: 20 },

  scrollContainer: { padding: 24, paddingBottom: 40 },

  bannerCard: {
    backgroundColor: '#F59E0B', borderRadius: 24, padding: 24, marginBottom: 32,
    shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8
  },
  bannerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bannerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  bannerSubtitle: { fontSize: 14, color: '#FEF3C7', fontWeight: '500' },
  dateCircle: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center'
  },
  dateNum: { color: '#B45309', fontWeight: '800', fontSize: 22, lineHeight: 26 },
  dateMonth: { color: '#D97706', fontWeight: '700', fontSize: 12 },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 16 },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#64748B', marginTop: 16, marginBottom: 4 },
  emptySubtitle: { fontSize: 14, color: '#94A3B8' },

  listContainer: { gap: 16 },
  aptCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#F1F5F9',
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2
  },
  aptCardCancelled: { opacity: 0.6 },
  aptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  dateTimeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  dateTimeText: { fontSize: 12, fontWeight: '700', color: '#92400E' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  
  aptBody: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  docAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarText: { fontSize: 20, fontWeight: '700', color: '#64748B' },
  docName: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 2 },
  docSpec: { fontSize: 13, color: '#64748B' },

  aptFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12 },
  reasonText: { fontSize: 13, color: '#475569', fontWeight: '500' },

  bookBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F59E0B', paddingVertical: 16, borderRadius: 16, marginTop: 32,
    shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4
  },
  bookBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, maxHeight: '85%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#1E293B' },

  inputLabel: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    padding: 14, fontSize: 15, color: '#1E293B',
  },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F59E0B', paddingVertical: 16, borderRadius: 16, marginTop: 24, marginBottom: 16,
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

export default AppointmentsScreen;
