const fs = require('fs');
const path = require('path');

// ไฟล์ที่ต้องแก้ไข
const filesToFix = [
  'app/AddBill.tsx',
  'app/AddFriends.tsx', 
  'app/ConfirmPayments.tsx',
  'app/ConfirmSlip.tsx',
  'app/Debt.tsx',
  'app/PayDetail.tsx',
  'app/Payment.tsx',
  'app/ProfileEdit.tsx',
  'app/TripDebtDetail.tsx',
  'app/welcome.tsx'
];

function fixSingleErrors() {
  filesToFix.forEach(filePath => {
    const fullPath = path.join(__dirname, '..', filePath);
    
    if (fs.existsSync(fullPath)) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // แทนที่ .single() ด้วย .maybeSingle()
      const originalContent = content;
      content = content.replace(/\.single\(\)/g, '.maybeSingle()');
      
      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`✅ Fixed .single() errors in ${filePath}`);
      } else {
        console.log(`ℹ️  No .single() errors found in ${filePath}`);
      }
    } else {
      console.log(`❌ File not found: ${filePath}`);
    }
  });
}

// รันการแก้ไข
fixSingleErrors();
console.log('🎉 All .single() errors have been fixed!');
