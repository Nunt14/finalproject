/**
 * Cache Usage Calculator
 * คำนวณการใช้งาน cache สำหรับการส่งและรับข้อมูลแต่ละครั้ง
 */

interface CacheUsageStats {
  operation: string;
  withoutCache: number; // bytes
  withCache: number; // bytes
  savings: number; // bytes
  savingsPercentage: number;
}

interface ImageSize {
  width: number;
  height: number;
  quality: number;
  estimatedSizeKB: number;
}

/**
 * คำนวณขนาดไฟล์รูปภาพตามคุณภาพและขนาด
 */
export class CacheCalculator {
  // ขนาดรูปภาพทั่วไปในแอป
  private static readonly IMAGE_SIZES: Record<string, ImageSize> = {
    profile: { width: 200, height: 200, quality: 0.8, estimatedSizeKB: 25 },
    qr: { width: 200, height: 200, quality: 0.8, estimatedSizeKB: 15 },
    payment_slip: { width: 800, height: 600, quality: 0.8, estimatedSizeKB: 150 },
    trip_photo: { width: 400, height: 300, quality: 0.8, estimatedSizeKB: 80 },
  };

  // ขนาดข้อมูล API responses
  private static readonly API_RESPONSE_SIZES = {
    user_profile: 500, // bytes
    user_debts: 2000, // bytes
    user_trips: 1500, // bytes
    payment_proofs: 1000, // bytes
    bill_details: 800, // bytes
    auth_response: 300, // bytes
  };

  // ขนาด HTTP headers และ metadata
  private static readonly HTTP_OVERHEAD = {
    request_headers: 200, // bytes
    response_headers: 300, // bytes
    supabase_metadata: 150, // bytes
    total_overhead: 650, // bytes
  };

  /**
   * คำนวณการใช้งาน cache สำหรับการอัปโหลดรูปภาพ
   */
  static calculateImageUploadCache(imageType: keyof typeof CacheCalculator.IMAGE_SIZES): CacheUsageStats {
    const imageSize = this.IMAGE_SIZES[imageType];
    const imageSizeBytes = imageSize.estimatedSizeKB * 1024;
    
    // ไม่มี cache: อัปโหลดทุกครั้ง
    const withoutCache = imageSizeBytes + this.HTTP_OVERHEAD.total_overhead;
    
    // มี cache: อัปโหลดครั้งเดียว, ใช้ cache 24 ชั่วโมง
    const withCache = imageSizeBytes + this.HTTP_OVERHEAD.total_overhead; // ครั้งแรกเท่านั้น
    
    return {
      operation: `Upload ${imageType} image`,
      withoutCache,
      withCache,
      savings: 0, // ไม่ประหยัดในการอัปโหลด
      savingsPercentage: 0,
    };
  }

  /**
   * คำนวณการใช้งาน cache สำหรับการแสดงรูปภาพ
   */
  static calculateImageDisplayCache(imageType: keyof typeof CacheCalculator.IMAGE_SIZES, displayCount: number = 10): CacheUsageStats {
    const imageSize = this.IMAGE_SIZES[imageType];
    const imageSizeBytes = imageSize.estimatedSizeKB * 1024;
    
    // ไม่มี cache: ดาวน์โหลดทุกครั้งที่แสดง
    const withoutCache = (imageSizeBytes + this.HTTP_OVERHEAD.total_overhead) * displayCount;
    
    // มี cache: ดาวน์โหลดครั้งเดียว, ใช้ cache 24 ชั่วโมง
    const withCache = imageSizeBytes + this.HTTP_OVERHEAD.total_overhead; // ครั้งแรกเท่านั้น
    
    const savings = withoutCache - withCache;
    
    return {
      operation: `Display ${imageType} image (${displayCount} times)`,
      withoutCache,
      withCache,
      savings,
      savingsPercentage: Math.round((savings / withoutCache) * 100),
    };
  }

  /**
   * คำนวณการใช้งาน cache สำหรับ API calls
   */
  static calculateAPICache(apiType: keyof typeof CacheCalculator.API_RESPONSE_SIZES, callCount: number = 5): CacheUsageStats {
    const responseSize = this.API_RESPONSE_SIZES[apiType];
    
    // ไม่มี cache: เรียก API ทุกครั้ง
    const withoutCache = (responseSize + this.HTTP_OVERHEAD.total_overhead) * callCount;
    
    // มี cache: เรียก API ครั้งเดียว, ใช้ cache 5-10 นาที
    const withCache = responseSize + this.HTTP_OVERHEAD.total_overhead; // ครั้งแรกเท่านั้น
    
    const savings = withoutCache - withCache;
    
    return {
      operation: `${apiType} API call (${callCount} times)`,
      withoutCache,
      withCache,
      savings,
      savingsPercentage: Math.round((savings / withoutCache) * 100),
    };
  }

  /**
   * คำนวณการใช้งาน cache สำหรับ getPublicUrl
   */
  static calculatePublicUrlCache(urlCount: number = 20): CacheUsageStats {
    const urlResponseSize = 200; // bytes สำหรับ URL response
    
    // ไม่มี cache: เรียก getPublicUrl ทุกครั้ง
    const withoutCache = (urlResponseSize + this.HTTP_OVERHEAD.total_overhead) * urlCount;
    
    // มี cache: เรียก getPublicUrl ครั้งเดียว, ใช้ cache 24 ชั่วโมง
    const withCache = urlResponseSize + this.HTTP_OVERHEAD.total_overhead; // ครั้งแรกเท่านั้น
    
    const savings = withoutCache - withCache;
    
    return {
      operation: `getPublicUrl calls (${urlCount} times)`,
      withoutCache,
      withCache,
      savings,
      savingsPercentage: Math.round((savings / withoutCache) * 100),
    };
  }

  /**
   * คำนวณการใช้งาน cache รวมสำหรับ user session หนึ่งวัน
   */
  static calculateDailyCacheUsage(): {
    totalWithoutCache: number;
    totalWithCache: number;
    totalSavings: number;
    savingsPercentage: number;
    breakdown: CacheUsageStats[];
  } {
    const breakdown: CacheUsageStats[] = [
      // รูปภาพ
      this.calculateImageDisplayCache('profile', 5),
      this.calculateImageDisplayCache('qr', 3),
      this.calculateImageDisplayCache('payment_slip', 8),
      this.calculateImageDisplayCache('trip_photo', 4),
      
      // API calls
      this.calculateAPICache('user_profile', 10),
      this.calculateAPICache('user_debts', 8),
      this.calculateAPICache('user_trips', 6),
      this.calculateAPICache('payment_proofs', 12),
      this.calculateAPICache('bill_details', 15),
      
      // getPublicUrl calls
      this.calculatePublicUrlCache(25),
    ];

    const totalWithoutCache = breakdown.reduce((sum, item) => sum + item.withoutCache, 0);
    const totalWithCache = breakdown.reduce((sum, item) => sum + item.withCache, 0);
    const totalSavings = totalWithoutCache - totalWithCache;
    const savingsPercentage = Math.round((totalSavings / totalWithoutCache) * 100);

    return {
      totalWithoutCache,
      totalWithCache,
      totalSavings,
      savingsPercentage,
      breakdown,
    };
  }

  /**
   * แปลง bytes เป็นหน่วยที่อ่านง่าย
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * สร้างรายงานการใช้งาน cache
   */
  static generateCacheReport(): string {
    const dailyUsage = this.calculateDailyCacheUsage();
    
    let report = '📊 CACHE USAGE REPORT\n';
    report += '='.repeat(50) + '\n\n';
    
    report += '📈 DAILY USAGE SUMMARY:\n';
    report += `Without Cache: ${this.formatBytes(dailyUsage.totalWithoutCache)}\n`;
    report += `With Cache: ${this.formatBytes(dailyUsage.totalWithCache)}\n`;
    report += `Savings: ${this.formatBytes(dailyUsage.totalSavings)} (${dailyUsage.savingsPercentage}%)\n\n`;
    
    report += '📋 BREAKDOWN BY OPERATION:\n';
    report += '-'.repeat(50) + '\n';
    
    dailyUsage.breakdown.forEach(item => {
      report += `${item.operation}:\n`;
      report += `  Without: ${this.formatBytes(item.withoutCache)}\n`;
      report += `  With: ${this.formatBytes(item.withCache)}\n`;
      report += `  Savings: ${this.formatBytes(item.savings)} (${item.savingsPercentage}%)\n\n`;
    });
    
    report += '💰 COST IMPACT:\n';
    report += `- Reduced bandwidth usage: ${this.formatBytes(dailyUsage.totalSavings)}/day\n`;
    report += `- Reduced Supabase Cached Egress: ~${dailyUsage.savingsPercentage}%\n`;
    report += `- Faster app performance: ${dailyUsage.savingsPercentage}% less network requests\n`;
    
    return report;
  }
}
