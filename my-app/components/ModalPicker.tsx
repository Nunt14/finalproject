import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, Text, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Option {
  value: string;
  label: string;
}

interface ModalPickerProps {
  visible: boolean;
  title: string;
  options: Option[];
  selectedValue?: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}

export default function ModalPicker({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose
}: ModalPickerProps) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.optionsContainer}>
            {options.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.option,
                  selectedValue === option.value && styles.selectedOption
                ]}
                onPress={() => {
                  onSelect(option.value);
                  onClose();
                }}
              >
                <Text style={[
                  styles.optionText,
                  selectedValue === option.value && styles.selectedOptionText
                ]}>
                  {option.label}
                </Text>
                {selectedValue === option.value && (
                  <Ionicons name="checkmark" size={20} color="#1A3C6B" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#fff',
    width: '85%',
    maxHeight: '70%',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Prompt-Medium',
    fontWeight: '600',
    color: '#1A3C6B',
  },
  closeButton: {
    padding: 4,
  },
  optionsContainer: {
    maxHeight: 300,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  selectedOption: {
    backgroundColor: '#f8f9fa',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'Prompt-Medium',
  },
  selectedOptionText: {
    color: '#1A3C6B',
    fontWeight: '600',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#1A3C6B',
    fontWeight: '600',
    fontFamily: 'Prompt-Medium',
  },
});
