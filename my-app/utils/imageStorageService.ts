import { supabase } from '../constants/supabase';

/**
 * Image Storage Service สำหรับจัดการรูปภาพใน Supabase Storage
 * แก้ไขให้ใช้ buckets ที่ถูกต้องตามโครงสร้างจริง
 */
export class ImageStorageService {
  private static readonly BUCKETS = {
    paymentProofs: 'payment-proofs',
    profiles: 'profiles',
    trips: 'trips',
    qrCodes: 'qr-codes'
  };

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
      return await this.uploadImage(imageUri, fileName, this.BUCKETS.paymentProofs);
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
      return await this.uploadImage(imageUri, fileName, this.BUCKETS.profiles);
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
      return await this.uploadImage(imageUri, fileName, this.BUCKETS.qrCodes);
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
      return await this.uploadImage(imageUri, fileName, this.BUCKETS.trips);
    } catch (error) {
      console.error('Error uploading trip image:', error);
      return null;
    }
  }

  /**
   * อัปโหลดรูปภาพทั่วไปไปยัง bucket ที่กำหนด
   */
  private static async uploadImage(
    imageUri: string,
    fileName: string,
    bucketName: string
  ): Promise<string | null> {
    try {
      console.log(`Uploading to bucket: ${bucketName}, file: ${fileName}`);
      
      // อ่านไฟล์เป็น Blob ผ่าน fetch
      const resp = await fetch(imageUri);
      const blob = await resp.blob();
      if (!blob) throw new Error('Failed to read image blob');

      // เดา contentType จากนามสกุล
      const m = imageUri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
      const ext = (m?.[1] || 'jpg').toLowerCase();
      const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

      // อัปโหลดไป Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, blob, {
          contentType,
          upsert: true
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      // ได้ public URL
      const { data } = await supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      console.log('Upload successful, URL:', data?.publicUrl);
      return data?.publicUrl || null;
    } catch (error) {
      console.error('Error in uploadImage:', error);
      return null;
    }
  }

  /**
   * ลบรูปภาพ
   */
  static async deleteImage(fileName: string, bucketName: string = this.BUCKETS.paymentProofs): Promise<boolean> {
    try {
      const { error } = await supabase.storage
        .from(bucketName)
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
  static getPublicUrl(fileName: string, bucketName: string = this.BUCKETS.paymentProofs): string {
    const { data } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    return data?.publicUrl || '';
  }

  /**
   * สร้าง signed URL (สำหรับรูปภาพ private)
   */
  static async getSignedUrl(
    fileName: string,
    bucketName: string = this.BUCKETS.paymentProofs,
    expiresIn: number = 3600
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
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

