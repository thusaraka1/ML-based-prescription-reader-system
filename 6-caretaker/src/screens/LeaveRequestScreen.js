import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const LeaveRequestScreen = ({ navigation }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = () => {
    if (!startDate || !endDate || !reason) {
      Alert.alert('Missing Fields', 'Please fill out all fields before submitting.');
      return;
    }
    
    // In a real app, this would hit caretakersApi.createLeaveRequest
    Alert.alert(
      'Leave Request Submitted', 
      'Your request has been sent to the system administrator for approval.',
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={24} color="#0F766E" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Request Leave</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.formSection}>
            <View style={styles.banner}>
              <MaterialCommunityIcons name="information" size={20} color="#0D9488" />
              <Text style={styles.bannerText}>
                Leave requests require at least 48 hours notice. Emergency leave requests must be called in directly to administration.
              </Text>
            </View>

            {/* Form Fields */}
            <Text style={styles.label}>Start Date</Text>
            <View style={styles.inputWrapper}>
              <MaterialCommunityIcons name="calendar-start" size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9CA3AF"
                value={startDate}
                onChangeText={setStartDate}
              />
            </View>

            <Text style={styles.label}>End Date</Text>
            <View style={styles.inputWrapper}>
              <MaterialCommunityIcons name="calendar-end" size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9CA3AF"
                value={endDate}
                onChangeText={setEndDate}
              />
            </View>

            <Text style={styles.label}>Reason for Leave</Text>
            <View style={[styles.inputWrapper, { alignItems: 'flex-start' }]}>
              <MaterialCommunityIcons name="text-box-outline" size={20} color="#9CA3AF" style={[styles.inputIcon, { marginTop: 14 }]} />
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Explain the reason for your leave request..."
                placeholderTextColor="#9CA3AF"
                value={reason}
                onChangeText={setReason}
                multiline
                textAlignVertical="top"
                numberOfLines={4}
              />
            </View>

          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.submitBtn, (!startDate || !endDate || !reason) && styles.submitBtnDisabled]} 
            onPress={handleSubmit}
            disabled={!startDate || !endDate || !reason}
          >
            <MaterialCommunityIcons name="send" size={20} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.submitBtnText}>Submit Request</Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F0FDFA' },
  scrollContainer: { paddingBottom: 40 },
  
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#CCFBF1'
  },
  closeBtn: { padding: 8, backgroundColor: '#CCFBF1', borderRadius: 20 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#134E4A' },

  formSection: { padding: 24 },
  
  banner: {
    flexDirection: 'row', backgroundColor: '#CCFBF1', padding: 16, borderRadius: 12, marginBottom: 24,
    alignItems: 'flex-start'
  },
  bannerText: { flex: 1, color: '#0F766E', marginLeft: 12, fontSize: 13, lineHeight: 20 },

  label: { fontSize: 14, fontWeight: '700', color: '#115E59', marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#CCFBF1', borderRadius: 12, marginBottom: 20, paddingHorizontal: 16
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: 50, color: '#0F172A', fontSize: 15 },
  textArea: { height: 100, paddingTop: 14 },

  footer: { 
    padding: 20, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#CCFBF1' 
  },
  submitBtn: {
    flexDirection: 'row', backgroundColor: '#0D9488', paddingVertical: 16,
    borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#0D9488', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4
  },
  submitBtnDisabled: { backgroundColor: '#9CA3AF', shadowOpacity: 0, elevation: 0 },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' }
});

export default LeaveRequestScreen;
