import { supabase } from '../constants/supabase';
import * as FileSystem from 'expo-file-system';
import { decode as decodeBase64 } from 'base64-arraybuffer';

/**
 * Image Storage Service สำหรับจัดการรูปภาพใน Supabase Storage
 * ตามโครงสร้างฐานข้อมูลจริง
 */
export class ImageStorageService {
  private static readonly BUCKET_NAME = 'payment-proofs';

  /**
   * อัปโหลดรูปภาพสลิปการชำระเงิน
   */
  static async uploadPaymentSlip(
    imageUri: string,
    userId: string,
    billId: string
  ): Promise<string | null> {
    try {
      const fileName = `slips/${userId}/${billId}-${Date.now()}.jpg`;
      return await this.uploadImage(imageUri, fileName);
    } catch (error) {
      console.error('Error uploading payment slip:', error);
      return null;
    }
  }

  /**
   * อัปโหลดรูปภาพโปรไฟล์
   */
  static async uploadProfileImage(
    imageUri: string,
    userId: string
  ): Promise<string | null> {
    try {
      const fileName = `profiles/${userId}/${Date.now()}.jpg`;
      return await this.uploadImage(imageUri, fileName);
    } catch (error) {
      console.error('Error uploading profile image:', error);
      return null;
    }
  }

  /**
   * อัปโหลดรูปภาพ QR Code
   */
  static async uploadQRCode(
    imageUri: string,
    userId: string
  ): Promise<string | null> {
    try {
      const fileName = `qr-codes/${userId}/${Date.now()}.jpg`;
      return await this.uploadImage(imageUri, fileName);
    } catch (error) {
      console.error('Error uploading QR code:', error);
      return null;
    }
  }

  /**
   * อัปโหลดรูปภาพทริป
   */
  static async uploadTripImage(
    imageUri: string,
    tripId: string
  ): Promise<string | null> {
    try {
      const fileName = `trips/${tripId}/${Date.now()}.jpg`;
      return await this.uploadImage(imageUri, fileName);
    } catch (error) {
      console.error('Error uploading trip image:', error);
      return null;
    }
  }

  /**
   * อัปโหลดรูปภาพทั่วไป
   */
  private static async uploadImage(
    imageUri: string,
    fileName: string
  ): Promise<string | null> {
    try {
      // อ่านรูปภาพเป็น base64
      const base64 = await FileSystem.readAsStringAsync(imageUri, { 
        encoding: 'base64'
      });
      
      if (!base64) {
        throw new Error('Failed to read image data');
      }
      
      // แปลงเป็น ArrayBuffer
      const arrayBuffer = decodeBase64(base64);
      
      // อัปโหลดไป Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(fileName, arrayBuffer, { 
          contentType: 'image/jpeg',
          upsert: true 
        });
        
      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }
      
      // ได้ public URL
      const { data } = await supabase.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(fileName);
      
      return data?.publicUrl || null;
    } catch (error) {
      console.error('Error in uploadImage:', error);
      return null;
    }
  }

  /**
   * ลบรูปภาพ
   */
  static async deleteImage(fileName: string): Promise<boolean> {
    try {
      const { error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .remove([fileName]);
      
      if (error) {
        console.error('Delete error:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting image:', error);
      return false;
    }
  }

  /**
   * ได้ public URL ของรูปภาพ
   */
  static getPublicUrl(fileName: string): string {
    const { data } = supabase.storage
      .from(this.BUCKET_NAME)
      .getPublicUrl(fileName);
    
    return data?.publicUrl || '';
  }

  /**
   * สร้าง signed URL (สำหรับรูปภาพ private)
   */
  static async getSignedUrl(
    fileName: string,
    expiresIn: number = 3600
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .createSignedUrl(fileName, expiresIn);
      
      if (error) {
        console.error('Signed URL error:', error);
        return null;
      }
      
      return data?.signedUrl || null;
    } catch (error) {
      console.error('Error creating signed URL:', error);
      return null;
    }
  }
}

