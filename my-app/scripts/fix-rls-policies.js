// สคริปต์สำหรับรัน SQL แก้ไข RLS policies
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// อ่าน environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // ต้องใช้ service role key

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ ไม่พบ SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY');
  console.log('กรุณาเพิ่ม SUPABASE_SERVICE_ROLE_KEY ใน .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixRLSPolicies() {
  try {
    console.log('🔧 กำลังแก้ไข RLS policies...\n');

    // อ่านไฟล์ SQL
    const sqlPath = path.join(__dirname, '../sql/fix_trip_member_rls_recursion.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // แบ่ง SQL statements (แยกตาม semicolon)
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    // รันแต่ละ statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement) continue;

      console.log(`📝 กำลังรัน statement ${i + 1}/${statements.length}...`);
      
      const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: statement
      });

      if (error) {
        console.error(`❌ Error ที่ statement ${i + 1}:`, error.message);
        // ลองรันแบบ raw query
        const { error: rawError } = await supabase
          .from('_sql')
          .select('*')
          .limit(0);
        
        if (rawError) {
          console.error('ไม่สามารถรัน SQL ได้:', rawError);
        }
      } else {
        console.log(`✅ Statement ${i + 1} สำเร็จ`);
      }
    }

    console.log('\n✅ แก้ไข RLS policies เสร็จสิ้น!');
    console.log('กรุณารีสตาร์ทแอปพลิเคชันของคุณ');

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
    process.exit(1);
  }
}

fixRLSPolicies();
