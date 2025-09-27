import { supabase } from '../constants/supabase';

/**
 * Safe Supabase query utilities to avoid .single() errors
 */
export class SafeSupabase {
  /**
   * Safe single query - returns null if no result or error
   */
  static async safeSingle<T>(
    query: any
  ): Promise<{ data: T | null; error: any }> {
    try {
      const { data, error } = await query.maybeSingle();
      return { data, error };
    } catch (error) {
      console.error('Safe single query error:', error);
      return { data: null, error };
    }
  }

  /**
   * Safe select query - returns empty array if no result
   */
  static async safeSelect<T>(
    query: any
  ): Promise<{ data: T[]; error: any }> {
    try {
      const { data, error } = await query;
      return { data: data || [], error };
    } catch (error) {
      console.error('Safe select query error:', error);
      return { data: [], error };
    }
  }

  /**
   * Check if user exists safely
   */
  static async checkUserExists(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('user')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();
      
      return !error && data !== null;
    } catch (error) {
      console.error('Check user exists error:', error);
      return false;
    }
  }

  /**
   * Get user profile safely
   */
  static async getUserProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (error) {
        console.error('Get user profile error:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Get user profile error:', error);
      return null;
    }
  }

  /**
   * Insert user safely with upsert to handle duplicates
   */
  static async insertUser(userData: any) {
    try {
      const { data, error } = await supabase
        .from('user')
        .upsert([userData], { 
          onConflict: 'email',
          ignoreDuplicates: false 
        })
        .select()
        .single();
      
      if (error) {
        console.error('Insert user error:', error);
        return { data: null, error };
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('Insert user error:', error);
      return { data: null, error };
    }
  }

  /**
   * Update user safely
   */
  static async updateUser(userId: string, updateData: any) {
    try {
      const { data, error } = await supabase
        .from('user')
        .update(updateData)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) {
        console.error('Update user error:', error);
        return { data: null, error };
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('Update user error:', error);
      return { data: null, error };
    }
  }

  /**
   * Upsert user safely (insert or update)
   */
  static async upsertUser(userData: any) {
    try {
      // ลองหาผู้ใช้ที่มี email นี้อยู่แล้ว
      const { data: existingUser } = await supabase
        .from('user')
        .select('*')
        .eq('email', userData.email)
        .maybeSingle();
      
      if (existingUser) {
        // ถ้ามีอยู่แล้ว ให้ update
        const { data, error } = await supabase
          .from('user')
          .update(userData)
          .eq('user_id', existingUser.user_id)
          .select()
          .single();
        
        if (error) {
          console.error('Update user error:', error);
          return { data: null, error };
        }
        
        return { data, error: null };
      } else {
        // ถ้าไม่มี ให้ insert
        const { data, error } = await supabase
          .from('user')
          .insert([userData])
          .select()
          .single();
        
        if (error) {
          console.error('Insert user error:', error);
          return { data: null, error };
        }
        
        return { data, error: null };
      }
    } catch (error) {
      console.error('Upsert user error:', error);
      return { data: null, error };
    }
  }

  /**
   * Get or create user safely
   */
  static async getOrCreateUser(userData: any) {
    try {
      // ลองหาผู้ใช้ที่มี email นี้อยู่แล้ว
      const { data: existingUser } = await supabase
        .from('user')
        .select('*')
        .eq('email', userData.email)
        .maybeSingle();
      
      if (existingUser) {
        return { data: existingUser, error: null };
      }
      
      // ถ้าไม่มี ให้สร้างใหม่
      return await this.upsertUser(userData);
    } catch (error) {
      console.error('Get or create user error:', error);
      return { data: null, error };
    }
  }

  /**
   * Insert user safely with duplicate handling
   */
  static async insertUserSafely(userData: any) {
    try {
      // ลองหาผู้ใช้ที่มี email นี้อยู่แล้ว
      const { data: existingUser } = await supabase
        .from('user')
        .select('*')
        .eq('email', userData.email)
        .maybeSingle();
      
      if (existingUser) {
        // ถ้ามีอยู่แล้ว ให้ return ข้อมูลที่มีอยู่
        return { data: existingUser, error: null };
      }
      
      // ถ้าไม่มี ให้ insert อย่างง่าย
      const { data, error } = await supabase
        .from('user')
        .insert([userData])
        .select()
        .single();
      
      if (error) {
        console.error('Insert user error:', error);
        return { data: null, error };
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('Insert user safely error:', error);
      return { data: null, error };
    }
  }

  /**
   * Simple insert user without duplicate checking
   */
  static async insertUserSimple(userData: any) {
    try {
      const { data, error } = await supabase
        .from('user')
        .insert([userData])
        .select()
        .single();
      
      if (error) {
        console.error('Insert user simple error:', error);
        return { data: null, error };
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('Insert user simple error:', error);
      return { data: null, error };
    }
  }

  /**
   * Insert user with upsert to handle duplicates
   */
  static async insertUserWithUpsert(userData: any) {
    try {
      const { data, error } = await supabase
        .from('user')
        .upsert([userData], { 
          onConflict: 'email',
          ignoreDuplicates: false 
        })
        .select()
        .single();
      
      if (error) {
        console.error('Insert user with upsert error:', error);
        return { data: null, error };
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('Insert user with upsert error:', error);
      return { data: null, error };
    }
  }

  /**
   * Insert user with duplicate checking
   */
  static async insertUserWithCheck(userData: any) {
    try {
      // ตรวจสอบว่ามี email นี้อยู่แล้วหรือไม่
      const { data: existingUser } = await supabase
        .from('user')
        .select('*')
        .eq('email', userData.email)
        .maybeSingle();
      
      if (existingUser) {
        // ถ้ามีอยู่แล้ว ให้ return ข้อมูลที่มีอยู่
        return { data: existingUser, error: null };
      }
      
      // ถ้าไม่มี ให้ insert
      const { data, error } = await supabase
        .from('user')
        .insert([userData])
        .select()
        .single();
      
      if (error) {
        console.error('Insert user with check error:', error);
        return { data: null, error };
      }
      
      return { data, error: null };
    } catch (error) {
      console.error('Insert user with check error:', error);
      return { data: null, error };
    }
  }
}
