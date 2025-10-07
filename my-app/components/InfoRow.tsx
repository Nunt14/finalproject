import React from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface InfoRowProps {
  icon: string;
  label: string;
  value?: string;
  placeholder?: string;
  editable?: boolean;
  onValueChange?: (value: string) => void;
  onPress?: () => void;
  keyboardType?: 'default' | 'phone-pad' | 'email-address' | 'numeric';
  secureTextEntry?: boolean;
  rightComponent?: React.ReactNode;
}

export default function InfoRow({
  icon,
  label,
  value = '',
  placeholder,
  editable = false,
  onValueChange,
  onPress,
  keyboardType = 'default',
  secureTextEntry = false,
  rightComponent
}: InfoRowProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name={icon as any} size={20} color="#1A3C6B" />
      </View>
      
      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        {editable ? (
          <TextInput
            style={styles.textInput}
            value={value}
            onChangeText={onValueChange}
            placeholder={placeholder}
            keyboardType={keyboardType}
            secureTextEntry={secureTextEntry}
            placeholderTextColor="#999"
          />
        ) : (
          <TouchableOpacity 
            style={styles.valueContainer}
            onPress={onPress}
            disabled={!onPress}
          >
            <Text style={[styles.value, !value && styles.placeholderText]}>
              {value || placeholder || 'Not set'}
            </Text>
            {onPress && (
              <Ionicons name="chevron-forward" size={16} color="#ccc" />
            )}
          </TouchableOpacity>
        )}
      </View>
      
      {rightComponent && (
        <View style={styles.rightComponent}>
          {rightComponent}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
    fontFamily: 'Prompt-Medium',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  value: {
    fontSize: 16,
    color: '#1A3C6B',
    fontFamily: 'Prompt-Medium',
    fontWeight: '500',
  },
  placeholderText: {
    color: '#999',
    fontWeight: 'normal',
  },
  textInput: {
    fontSize: 16,
    borderBottomWidth: 2,
    borderColor: '#1A3C6B',
    paddingVertical: 6,
    color: '#1A3C6B',
    fontFamily: 'Prompt-Medium',
  },
  rightComponent: {
    marginLeft: 10,
  },
});

