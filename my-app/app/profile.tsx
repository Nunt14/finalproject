import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { Text, ProfileImage, QRCodeDisplay, InfoRow, ModalPicker } from '@/components';
import { supabase } from '../constants/supabase';
import { router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from './contexts/LanguageContext';
import { useCurrency } from './contexts/CurrencyContext';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView } from 'react-native-safe-area-context';
export default function ProfileScreen() {
  const [user, setUser] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const { language, setLanguage, t } = useLanguage();
  const { currency, setCurrency } = useCurrency();
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [qrImage, setQRImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const languageOptions = ['TH', 'EN'];
  const languageNames = {
    'TH': 'ไทย',
    'EN': 'English'
  };
  const currencyOptions = ['THB', 'USD', 'EUR', 'JPY', 'GBP'];

  const fetchUser = async () => {
    try {
      setIsLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      
      if (!userId) {
        router.replace('/login');
        return;
      }

      const { data, error } = await supabase
        .from('user')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.log('Error fetching user:', error);
        return;
      }

      if (data) {
        setUser(data);
        setFullName(data.full_name || '');
        setPhone(data.phone_number || '');
        setEmail(data.email || '');
        setCurrency(data.currency_preference || 'THB');
        setProfileImage(data.profile_image_url || null);
        setQRImage(data.qr_code_img || null);
        // Do not override the app language from DB here to preserve the
        // user's last selection saved in AsyncStorage via LanguageProvider.
      }
    } catch (error) {
      console.error('Error in fetchUser:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchUser();
    }, [])
  );

  const uploadImage = async (imageUri: string, type: 'profile' | 'qr'): Promise<string | null> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) {
        return null;
      }

      // Generate unique filename
      const timestamp = Date.now();
      const fileExtension = imageUri.split('.').pop() || 'jpg';
      const fileName = `${userId}/${type}_${timestamp}.${fileExtension}`;
      
      // Determine content type
      const contentType = fileExtension === 'png' ? 'image/png' : 'image/jpeg';
      
      // Read file using fetch API (more reliable)
      const response = await fetch(imageUri);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      // Upload to storage using ArrayBuffer
      const bucketName = type === 'profile' ? 'profiles' : 'qr-codes';
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, arrayBuffer, { 
          contentType,
          upsert: true 
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        return null;
      }

      // Get public URL
      const { data } = await supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      return data?.publicUrl || null;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  const handleImagePick = async (type: 'profile' | 'qr') => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('common.permission_required'), t('profile2.grant_photo_permission'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'profile' ? [1, 1] : [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.length > 0) {
        const imageUri = result.assets[0].uri;
        
        // Show loading
        if (type === 'profile') {
          setProfileImage(imageUri); // Show preview immediately
        } else {
          setQRImage(imageUri);
        }

        // Upload image
        const publicUrl = await uploadImage(imageUri, type);
        
        if (publicUrl) {
          if (type === 'profile') {
            setProfileImage(publicUrl);
          } else {
            setQRImage(publicUrl);
          }
          
          // Update database
          if (user?.user_id) {
            const updateData = type === 'profile' 
              ? { profile_image_url: publicUrl }
              : { qr_code_img: publicUrl };
              
            const { error: updateError } = await supabase
              .from('user')
              .update(updateData)
              .eq('user_id', user.user_id);
              
            if (updateError) {
              console.error('Database update error:', updateError);
              Alert.alert(t('profile2.update_failed'), t('profile2.db_update_failed'));
            }
          }
          
          Alert.alert(
            t('common.success_title'),
            type === 'profile' ? t('profile2.image_updated_profile') : t('profile2.image_updated_qr')
          );
        } else {
          console.error('Upload failed - no public URL returned');
          Alert.alert(t('profile2.upload_failed'), t('profile2.upload_failed_msg'));
        }
      }
    } catch (error) {
      console.error('Image picker error:', error);
      let errorMessage = 'An error occurred while selecting the image.';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      Alert.alert(t('common.error_title'), errorMessage);
    }
  };

  const handleSave = async () => {
    if (!user?.user_id) return;

    try {
      const { error } = await supabase
        .from('user')
        .update({
          full_name: fullName,
          phone_number: phone,
          currency_preference: currency,
          language_preference: language,
        })
        .eq('user_id', user.user_id);

      if (error) {
        Alert.alert(t('profile2.update_failed'), error.message);
        return;
      }

      Alert.alert(t('common.success_title'), t('profile2.updated_success'));
      setEditMode(false);
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert(t('common.error_title'), t('profile2.update_profile_failed'));
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      t('common.logout'),
      t('profile2.logout_confirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.logout'),
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/login');
          }
        }
      ]
    );
  };

  const handleLanguageChange = async (newLanguage: string) => {
    setLanguage(newLanguage as 'TH' | 'EN');
    setShowLanguagePicker(false);

    if (user?.user_id) {
      await supabase
        .from('user')
        .update({ language_preference: newLanguage })
        .eq('user_id', user.user_id);
    }
  };

  const handleCurrencyChange = async (newCurrency: string) => {
    await setCurrency(newCurrency as any);
    setShowCurrencyPicker(false);

    if (user?.user_id) {
      await supabase
        .from('user')
        .update({ currency_preference: newCurrency })
        .eq('user_id', user.user_id);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={['#1A3C6B', '#45647C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('profile2.header')}</Text>
          <TouchableOpacity 
            onPress={() => setEditMode(!editMode)} 
            style={styles.editHeaderButton}
          >
            <Ionicons name={editMode ? "checkmark" : "create"} size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <ProfileImage
            imageUri={profileImage}
            onPress={() => handleImagePick('profile')}
            size={120}
            showEditButton={true}
          />
          
          <Text style={styles.userName}>{fullName || t('profile2.no_name')}</Text>
          <Text style={styles.userEmail}>{email || t('profile2.no_email')}</Text>
          
        </View>

        {/* Info Cards */}
        <View style={styles.infoCard}>
          <InfoRow
            icon="person-outline"
            label={t('profile2.full_name')}
            value={fullName}
            placeholder={t('profile2.full_name_placeholder')}
            editable={editMode}
            onValueChange={setFullName}
          />

          <InfoRow
            icon="call-outline"
            label={t('profile2.phone')}
            value={phone}
            placeholder={t('profile2.phone_placeholder')}
            editable={editMode}
            onValueChange={setPhone}
            keyboardType="phone-pad"
          />

          <InfoRow
            icon="cash-outline"
            label={t('profile2.currency')}
            value={currency}
            onPress={() => setShowCurrencyPicker(true)}
            rightComponent={
              <TouchableOpacity 
                style={styles.currencyButton}
                onPress={() => setShowCurrencyPicker(true)}
              >
                <Text style={styles.currencyButtonText}>{currency}</Text>
                <Ionicons name="chevron-down" size={16} color="#fff" />
              </TouchableOpacity>
            }
          />

          <InfoRow
            icon="language-outline"
            label={t('profile2.language')}
            value={languageNames[language as keyof typeof languageNames]}
            onPress={() => setShowLanguagePicker(true)}
            rightComponent={
              <TouchableOpacity 
                style={styles.currencyButton}
                onPress={() => setShowLanguagePicker(true)}
              >
                <Text style={styles.currencyButtonText}>
                  {languageNames[language as keyof typeof languageNames]}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#fff" />
              </TouchableOpacity>
            }
          />
        </View>

        {/* QR Code Section */}
        <QRCodeDisplay
          qrImageUri={qrImage}
          onEdit={() => handleImagePick('qr')}
          title={t('profile2.qr_title')}
          placeholder={t('profile2.qr_placeholder')}
        />

        {/* Action Buttons */}
        {editMode && (
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>{t('profile2.save_changes')}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>{t('common.logout')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Language Picker Modal */}
      <ModalPicker
        visible={showLanguagePicker}
        title={t('common.select_language')}
        options={languageOptions.map(lang => ({
          value: lang,
          label: languageNames[lang as keyof typeof languageNames]
        }))}
        selectedValue={language}
        onSelect={handleLanguageChange}
        onClose={() => setShowLanguagePicker(false)}
      />

      {/* Currency Picker Modal */}
      <ModalPicker
        visible={showCurrencyPicker}
        title={t('common.select_currency')}
        options={currencyOptions.map(curr => ({
          value: curr,
          label: curr
        }))}
        selectedValue={currency}
        onSelect={handleCurrencyChange}
        onClose={() => setShowCurrencyPicker(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    fontFamily: 'Prompt-Medium',
  },
  headerGradient: {
    paddingTop: 40,
    paddingBottom: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Prompt-Medium',
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  editHeaderButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  profileSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
    paddingVertical: 20,
  },
  userName: {
    fontSize: 24,
    fontFamily: 'Prompt-Medium',
    fontWeight: '600',
    color: '#1A3C6B',
    textAlign: 'center',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    fontFamily: 'Prompt-Medium',
    color: '#666',
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  currencyButton: {
    backgroundColor: '#1A3C6B',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencyButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    fontFamily: 'Prompt-Medium',
  },
  saveButton: {
    backgroundColor: '#1A3C6B',
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#1A3C6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    fontFamily: 'Prompt-Medium',
  },
  logoutButton: {
    backgroundColor: '#dc3545',
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#dc3545',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  logoutButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    fontFamily: 'Prompt-Medium',
  },
});