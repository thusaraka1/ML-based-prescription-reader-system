import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const AppointmentsScreen = ({ navigation }) => {
  // Mock data for the UI
  const appointments = [
    { 
      id: 'apt-1', doctorName: 'Dr. Sarah Jenkins', specialization: 'Cardiologist', 
      date: 'Monday, Oct 24', time: '10:00 AM', reason: 'Routine Checkup', type: 'clinic' 
    },
    { 
      id: 'apt-2', doctorName: 'Dr. Michael Chen', specialization: 'General Physician', 
      date: 'Thursday, Nov 03', time: '02:30 PM', reason: 'Prescription Renewal', type: 'video' 
    }
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Appointments</Text>
        <TouchableOpacity style={styles.addBtn}>
          <MaterialCommunityIcons name="plus" size={24} color="#F59E0B" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Banner */}
        <View style={styles.bannerCard}>
          <View style={styles.bannerContent}>
            <View>
              <Text style={styles.bannerTitle}>Next Appointment</Text>
              <Text style={styles.bannerSubtitle}>in 3 days</Text>
            </View>
            <View style={styles.dateCircle}>
              <Text style={styles.dateNum}>24</Text>
              <Text style={styles.dateMonth}>OCT</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Upcoming Visits</Text>

        {/* Appointments List */}
        <View style={styles.listContainer}>
          {appointments.map((apt) => (
            <View key={apt.id} style={styles.aptCard}>
              <View style={styles.aptHeader}>
                <View style={styles.dateTimeBadge}>
                  <MaterialCommunityIcons name="calendar-clock" size={16} color="#B45309" style={{ marginRight: 6 }} />
                  <Text style={styles.dateTimeText}>{apt.date} at {apt.time}</Text>
                </View>
                <View style={[styles.typeBadge, apt.type === 'video' ? { backgroundColor: '#DBEAFE' } : { backgroundColor: '#F1F5F9' }]}>
                  <MaterialCommunityIcons 
                    name={apt.type === 'video' ? 'video' : 'hospital-building'} 
                    size={14} 
                    color={apt.type === 'video' ? '#2563EB' : '#475569'} 
                  />
                </View>
              </View>

              <View style={styles.aptBody}>
                <View style={styles.docAvatar}>
                  <Text style={styles.avatarText}>{apt.doctorName.replace('Dr. ', '').charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.docName}>{apt.doctorName}</Text>
                  <Text style={styles.docSpec}>{apt.specialization}</Text>
                </View>
              </View>

              <View style={styles.aptFooter}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="text-box-outline" size={16} color="#94A3B8" style={{ marginRight: 6 }} />
                  <Text style={styles.reasonText}>{apt.reason}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Book Button */}
        <TouchableOpacity style={styles.bookBtn}>
          <MaterialCommunityIcons name="calendar-plus" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.bookBtnText}>Book New Appointment</Text>
        </TouchableOpacity>

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

  listContainer: { gap: 16 },
  aptCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#F1F5F9',
    shadowColor: '#64748B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2
  },
  aptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  dateTimeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  dateTimeText: { fontSize: 12, fontWeight: '700', color: '#92400E' },
  typeBadge: { padding: 6, borderRadius: 10 },
  
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
  bookBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' }
});

export default AppointmentsScreen;
