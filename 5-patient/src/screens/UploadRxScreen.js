import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const UploadRxScreen = ({ navigation }) => {
  const [doctorName, setDoctorName] = useState('');
  const [uploadMethod, setUploadMethod] = useState('file'); // 'file' or 'camera'

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
              <MaterialCommunityIcons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>Upload Prescription</Text>
              <Text style={styles.headerSubtitle}>For Patient</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          {/* Form */}
          <View style={styles.formSection}>
            <Text style={styles.label}>Prescribing Doctor's Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Dr. John Smith"
              placeholderTextColor="#9CA3AF"
              value={doctorName}
              onChangeText={setDoctorName}
            />

            <Text style={[styles.label, { marginTop: 24 }]}>Upload Method</Text>
            <View style={styles.methodRow}>
              <TouchableOpacity 
                style={[styles.methodBtn, uploadMethod === 'file' && styles.methodBtnActive]}
                onPress={() => setUploadMethod('file')}
              >
                <MaterialCommunityIcons 
                  name="tray-arrow-up" 
                  size={28} 
                  color={uploadMethod === 'file' ? '#3B82F6' : '#94A3B8'} 
                  style={{ marginBottom: 8 }}
                />
                <Text style={[styles.methodText, uploadMethod === 'file' && styles.methodTextActive]}>Upload File</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.methodBtn, uploadMethod === 'camera' && styles.methodBtnActive]}
                onPress={() => setUploadMethod('camera')}
              >
                <MaterialCommunityIcons 
                  name="camera-outline" 
                  size={28} 
                  color={uploadMethod === 'camera' ? '#3B82F6' : '#94A3B8'} 
                  style={{ marginBottom: 8 }}
                />
                <Text style={[styles.methodText, uploadMethod === 'camera' && styles.methodTextActive]}>Take Photo</Text>
              </TouchableOpacity>
            </View>

            {/* Upload Area */}
            <TouchableOpacity style={styles.uploadArea}>
              <MaterialCommunityIcons 
                name={uploadMethod === 'file' ? "file-document-outline" : "camera-plus"} 
                size={56} 
                color="#CBD5E1" 
                style={{ marginBottom: 12 }}
              />
              <Text style={styles.uploadMainText}>
                {uploadMethod === 'file' ? 'Click to upload' : 'Click to take photo'}
              </Text>
              <Text style={styles.uploadSubText}>PNG, JPG up to 10MB</Text>
            </TouchableOpacity>

            {/* Banner */}
            <View style={styles.banner}>
              <MaterialCommunityIcons name="lightning-bolt" size={16} color="#8B5CF6" />
              <Text style={styles.bannerText}>
                <Text style={{ fontWeight: '700' }}>Ensemble Mode Active</Text>
                <Text> — (Donut (cpu) + Regex + Gemini)</Text>
              </Text>
            </View>

            {/* Mock Extracted Text Display */}
            <View style={styles.extractedTextContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <MaterialCommunityIcons name="file-document-outline" size={18} color="#1E3A8A" />
                <Text style={styles.extractedTextTitle}> Extracted Text</Text>
              </View>
              <View style={styles.extractedTextBg}>
                <Text style={styles.extractedTextContent}>
                  Patient: Kalani{'\n'}
                  Rx: Amoxicillin 500mg, Take 1 tablet twice daily.{'\n'}
                  Ibuprofen 200mg, As needed for pain.
                </Text>
              </View>
            </View>

            {/* Mock Extracted Medications Display */}
            <View style={styles.medicationsContainer}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="pill" size={18} color="#065F46" />
                  <Text style={styles.medicationsTitle}> Extracted Medications</Text>
                </View>
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedBadgeText}>🧠 Ensemble Verified</Text>
                </View>
              </View>

              <View style={styles.medicationCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <MaterialCommunityIcons name="pill" size={20} color="#059669" style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.medDrugName}>Amoxicillin</Text>
                    <Text style={styles.medDosage}>500mg — Take 1 tablet twice daily</Text>
                  </View>
                  <Text style={styles.medConfidence}>98%</Text>
                </View>
              </View>

              <View style={styles.medicationCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <MaterialCommunityIcons name="pill" size={20} color="#059669" style={{ marginRight: 12 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.medDrugName}>Ibuprofen</Text>
                    <Text style={styles.medDosage}>200mg — As needed for pain</Text>
                  </View>
                  <Text style={styles.medConfidence}>95%</Text>
                </View>
              </View>
            </View>

          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.submitBtn}>
            <MaterialCommunityIcons name="check-circle-outline" size={24} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.submitBtnText}>Confirm & Save</Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContainer: { paddingBottom: 40 },
  
  header: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', 
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF',
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9'
  },
  closeBtn: { padding: 8, backgroundColor: '#F1F5F9', borderRadius: 20 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1E293B', textAlign: 'center' },
  headerSubtitle: { fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 2 },

  formSection: { padding: 24 },
  label: { fontSize: 15, fontWeight: '600', color: '#334155', marginBottom: 10 },
  input: { 
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', 
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, 
    fontSize: 16, color: '#0F172A' 
  },

  methodRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  methodBtn: {
    flex: 1, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#F1F5F9',
    borderRadius: 16, padding: 16, alignItems: 'center'
  },
  methodBtnActive: { borderColor: '#3B82F6', backgroundColor: '#EFF6FF' },
  methodText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  methodTextActive: { color: '#1D4ED8' },

  uploadArea: {
    backgroundColor: '#F8FAFC', borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed',
    borderRadius: 20, padding: 40, alignItems: 'center', marginBottom: 24
  },
  uploadMainText: { fontSize: 16, fontWeight: '600', color: '#475569', marginBottom: 4 },
  uploadSubText: { fontSize: 13, color: '#94A3B8' },

  banner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F3FF',
    borderWidth: 1, borderColor: '#EDE9FE', borderRadius: 12, padding: 12
  },
  bannerText: { fontSize: 12, color: '#7C3AED', marginLeft: 8 },

  extractedTextContainer: {
    marginTop: 24, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE',
    borderRadius: 16, padding: 16
  },
  extractedTextTitle: { fontSize: 14, fontWeight: '700', color: '#1E3A8A' },
  extractedTextBg: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#DBEAFE' },
  extractedTextContent: { fontSize: 13, color: '#1E40AF', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  medicationsContainer: {
    marginTop: 16, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0',
    borderRadius: 16, padding: 16
  },
  medicationsTitle: { fontSize: 14, fontWeight: '700', color: '#065F46' },
  verifiedBadge: { backgroundColor: '#EDE9FE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  verifiedBadgeText: { fontSize: 10, fontWeight: '700', color: '#5B21B6' },
  medicationCard: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1FAE5',
    borderRadius: 12, padding: 12, marginBottom: 8
  },
  medDrugName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  medDosage: { fontSize: 12, color: '#4B5563', marginTop: 2 },
  medConfidence: { fontSize: 12, fontWeight: '600', color: '#6B7280' },

  footer: { 
    padding: 20, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F1F5F9' 
  },
  submitBtn: {
    flexDirection: 'row', backgroundColor: '#10B981', paddingVertical: 16,
    borderRadius: 16, alignItems: 'center', justifyContent: 'center'
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' }
});

export default UploadRxScreen;
