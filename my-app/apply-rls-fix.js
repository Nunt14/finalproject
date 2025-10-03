// Read environment variables properly for Windows
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// Read .env file manually since process.env might not work properly
function loadEnvFile() {
  try {
    const envPath = new URL('.env', import.meta.url).pathname;
    const envContent = readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');

    for (const line of lines) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').replace(/['"]/g, '');
        process.env[key.trim()] = value.trim();
      }
    }
  } catch (error) {
    console.log('Could not load .env file:', error.message);
  }
}

// Load environment variables
loadEnvFile();

// อ่าน environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ ไม่พบ SUPABASE_URL หรือ SUPABASE_SERVICE_ROLE_KEY');
  console.log('ตรวจสอบไฟล์ .env และลองใหม่อีกครั้ง');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyFix() {
  try {
    console.log('🔧 กำลังแก้ไข RLS policies...\n');

    // อ่านไฟล์ SQL
    const fs = await import('fs');
    const path = await import('path');
    const __dirname = new URL('.', import.meta.url).pathname;

    const sqlPath = new URL('../sql/fix_trip_member_rls_recursion_final.sql', import.meta.url).pathname;
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('📄 รันสคริปต์แก้ไข...');

    // แบ่ง SQL statements
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && !s.startsWith('SELECT'));

    // รันแต่ละ statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (!statement) continue;

      console.log(`📝 รัน statement ${i + 1}/${statements.length}...`);

      try {
        const { data, error } = await supabase.rpc('exec_sql', {
          sql_query: statement + ';'
        });

        if (error) {
          console.error(`❌ Error ที่ statement ${i + 1}:`, error.message);
        } else {
          console.log(`✅ Statement ${i + 1} สำเร็จ`);
        }
      } catch (err) {
        console.error(`❌ Error รัน statement ${i + 1}:`, err.message);
      }
    }

    console.log('\n✅ แก้ไข RLS policies เสร็จสิ้น!');
    console.log('กรุณารีสตาร์ทแอปพลิเคชันของคุณ');

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
    process.exit(1);
  }
}

applyFix();
