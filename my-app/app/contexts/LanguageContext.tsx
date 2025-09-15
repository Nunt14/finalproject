import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Locale = 'TH' | 'EN';

type Dictionary = Record<string, { TH: string; EN: string }>; 

const translations: Dictionary = {
  // Common
  'common.save': { TH: 'บันทึก', EN: 'Save' },
  'common.close': { TH: 'ปิด', EN: 'Close' },
  'common.logout': { TH: 'ออกจากระบบ', EN: 'Log out' },
  'common.select_language': { TH: 'เลือกภาษา', EN: 'Select Language' },
  'common.select_currency': { TH: 'เลือกสกุลเงิน', EN: 'Select currency' },

  // Profile screen
  'profile.title': { TH: 'บัญชีผู้ใช้', EN: 'Account' },
  'profile.phone': { TH: 'เบอร์โทร', EN: 'Phone number' },
  'profile.password': { TH: 'รหัสผ่าน', EN: 'Password' },
  'profile.payment': { TH: 'การชำระเงินของคุณ', EN: 'Your Payment' },
  'profile.currency': { TH: 'สกุลเงินเริ่มต้น', EN: 'Default currency' },
  'profile.language': { TH: 'ภาษา', EN: 'Language' },
  'profile.new_password_placeholder': { TH: 'กรอกรหัสผ่านใหม่', EN: 'Enter new password' },
  'profile.default_phone_placeholder': { TH: '089-xxx-xxxx', EN: '089-xxx-xxxx' },
  'profile.qr_text': { TH: 'QR ของคุณได้ถูกสร้างขึ้นแล้ว\nผู้ใช้งานสามารถสแกนเพื่อชำระเงินได้', EN: 'Your QR has been created.\nUsers can scan it to pay.' },

  // Login screen
  'login.title': { TH: 'เข้าสู่ระบบ', EN: 'Log in' },
  'login.email_placeholder': { TH: 'อีเมล', EN: 'Email address' },
  'login.password_placeholder': { TH: 'รหัสผ่าน', EN: 'Password' },
  'login.forgot_password': { TH: 'ลืมรหัสผ่าน', EN: 'Forgot password' },
  'login.min_chars_hint': { TH: 'อย่างน้อย 8 ตัวอักษร', EN: 'Minimum 8 characters' },
  'login.next': { TH: 'ถัดไป', EN: 'Next' },

  // Welcome screen
  'welcome.title': { TH: 'ยินดีต้อนรับสู่ Harnty,', EN: 'Welcome to Harnty,' },
  'welcome.all_trips': { TH: 'ทริปทั้งหมดของคุณ!', EN: 'All Your Trips!' },
  'welcome.no_results': { TH: 'ไม่พบทริปที่ค้นหา', EN: 'No trips found' },
  'welcome.delete_trip.title': { TH: 'ยืนยันการลบทริป', EN: 'Confirm Trip Deletion' },
  'welcome.delete_trip.message': { TH: 'คุณแน่ใจหรือไม่ว่าต้องการลบทริป "{name}"?', EN: 'Are you sure you want to delete the trip "{name}"?' },
  'welcome.delete_trip.cancel': { TH: 'ยกเลิก', EN: 'Cancel' },
  'welcome.delete_trip.ok': { TH: 'ลบทริป', EN: 'Delete' },
  'welcome.delete_trip.success_title': { TH: 'สำเร็จ', EN: 'Success' },
  'welcome.delete_trip.success_msg': { TH: 'ลบทริปสำเร็จ', EN: 'Trip deleted successfully' },
  'welcome.delete_trip.error_title': { TH: 'ข้อผิดพลาด', EN: 'Error' },
  'welcome.delete_trip.error_msg': { TH: 'ไม่สามารถลบทริปได้ในขณะนี้', EN: 'Unable to delete trip at this time' },

  // AddTrip screen
  'addtrip.header': { TH: 'สร้างทริปใหม่', EN: 'Add new trip' },
  'addtrip.title_label': { TH: 'ชื่อเรื่อง :', EN: 'Title :' },
  'addtrip.title_placeholder': { TH: 'กรอกชื่อทริป', EN: 'Enter trip title' },
  'addtrip.member_label': { TH: 'สมาชิก :', EN: 'Member :' },
  'addtrip.everyone': { TH: 'ทุกคน', EN: 'everyone' },
  'addtrip.confirm': { TH: 'ยืนยัน', EN: 'Confirm' },
  'addtrip.saving': { TH: 'กำลังบันทึก...', EN: 'Saving...' },
  'addtrip.back': { TH: 'ย้อนกลับ', EN: 'Back' },

  // Debt screen
  'debt.title': { TH: 'หนี้', EN: 'Debt' },
  'debt.waiting_for_pay': { TH: 'รอการชำระ', EN: 'Waiting for pay' },
  'debt.no_debts': { TH: 'ไม่พบหนี้ที่ต้องชำระ', EN: 'No debts to pay' },
  'debt.already_paid': { TH: 'ชำระแล้ว', EN: 'Already Paid' },
  'debt.waiting_for_confirm': { TH: 'รอการยืนยัน', EN: 'Waiting for confirm' },
  'debt.confirmed': { TH: 'ยืนยันแล้ว', EN: 'Confirmed' },
  'debt.total_list': { TH: 'รวม', EN: 'Total' },
  'debt.tab_debt': { TH: 'หนี้', EN: 'Debt' },
  'debt.tab_payment': { TH: 'การชำระเงิน', EN: 'Payment' },
  'debt.payment_confirmations': { TH: 'การยืนยันการชำระเงิน', EN: 'Payment Confirmations' },
  'debt.no_pending_payments': { TH: 'ไม่มีการชำระเงินที่รอดำเนินการ', EN: 'No pending payments' },
  'debt.payment_confirmed': { TH: 'ยืนยันการชำระเงินสำเร็จ', EN: 'Payment confirmed successfully' },
  'debt.payment_rejected': { TH: 'ปฏิเสธการชำระเงิน', EN: 'Payment rejected' },
  'debt.error_confirm_payment': { TH: 'ไม่สามารถยืนยันการชำระเงินได้', EN: 'Unable to confirm payment' },
  'debt.error_reject_payment': { TH: 'ไม่สามารถปฏิเสธการชำระเงินได้', EN: 'Unable to reject payment' },
  'debt.user': { TH: 'ผู้ใช้', EN: 'User' },

  // Trip screen
  'trip.header': { TH: 'ทริปกลุ่ม', EN: 'Group Trip' },
  'trip.trip_fallback': { TH: 'ทริป', EN: 'Trip' },
  'trip.total': { TH: 'รวม', EN: 'Total' },
  'trip.empty': { TH: 'ยังไม่มีบิลในทริปนี้', EN: 'No bills in this trip yet' },
  'trip.payer': { TH: 'ผู้จ่าย', EN: 'Payer' },
  'trip.user': { TH: 'ผู้ใช้', EN: 'User' },
  'trip.note_label': { TH: 'หมายเหตุ :', EN: 'Note :' },
  'trip.pay': { TH: 'ชำระ', EN: 'Pay' },
  'trip.who_paid_button': { TH: 'ใครเป็นผู้จ่าย!', EN: 'Who paid!' },
  'trip.modal.title_who_paid': { TH: 'ใครเป็นผู้จ่าย', EN: 'Who paid' },
  'trip.section.paid': { TH: 'ชำระแล้ว', EN: 'Paid' },
  'trip.section.unpaid': { TH: 'ยังไม่ชำระ', EN: 'Unpaid' },
  'trip.owner': { TH: 'เจ้าของบิล', EN: 'Owner' },
  'trip.edit_bill': { TH: 'แก้ไขบิล', EN: 'Edit Bill' },
  'trip.delete_bill': { TH: 'ลบบิล', EN: 'Delete Bill' },
  'trip.back': { TH: 'ย้อนกลับ', EN: 'Back' },
  'trip.debt_button': { TH: 'หนี้', EN: 'DEBT' },
  'trip.confirm_delete_title': { TH: 'ยืนยันการลบบิล', EN: 'Confirm delete bill' },
  'trip.confirm_delete_message': { TH: 'คุณต้องการลบบิลนี้ใช่หรือไม่? การดำเนินการนี้ไม่สามารถยกเลิกได้', EN: 'Are you sure you want to delete this bill? This action cannot be undone.' },
  'trip.confirm_delete_cancel': { TH: 'ยกเลิก', EN: 'Cancel' },
  'trip.confirm_delete_ok': { TH: 'ลบบิล', EN: 'Delete Bill' },

  // AddBill screen
  'addbill.header': { TH: 'เพิ่มบิลใหม่', EN: 'Add new Bill' },
  'addbill.how_much': { TH: 'จำนวนเงิน?', EN: 'How much?' },
  'addbill.note_label': { TH: 'หมายเหตุ :', EN: 'Note :' },
  'addbill.note_placeholder': { TH: '...', EN: '...' },
  'addbill.split_per_person': { TH: 'หารต่อคน :', EN: 'Split per person :' },
  'addbill.who_divide': { TH: 'ใครต้องหาร?', EN: 'Who has to divide?' },
  'addbill.per_person': { TH: 'ต่อคน', EN: 'per person' },
  'addbill.extra': { TH: 'พิเศษ', EN: 'Extra' },
  'addbill.everyone': { TH: 'ทุกคน', EN: 'everyone' },
  'addbill.category': { TH: 'หมวดหมู่', EN: 'category' },
  'addbill.placeholder_amount': { TH: '0.00', EN: '0.00' },
  'addbill.confirm': { TH: 'ยืนยัน', EN: 'Confirm' },
  'addbill.saving': { TH: 'กำลังบันทึก...', EN: 'Saving...' },
  'addbill.back': { TH: 'ย้อนกลับ', EN: 'Back' },

  // Notification screen
  'notify.title': { TH: 'การแจ้งเตือน', EN: 'Notification' },
  'notify.loading': { TH: 'กำลังโหลดการแจ้งเตือน...', EN: 'Loading notifications...' },
  'notify.empty.title': { TH: 'ไม่มีการแจ้งเตือน', EN: 'No notifications' },
  'notify.empty.subtitle': { TH: 'คุณจะเห็นการแจ้งเตือนที่นี่เมื่อมีกิจกรรมใหม่', EN: 'You will see notifications here when new activity occurs.' },
  'notify.group.today': { TH: 'วันนี้', EN: 'Today' },
  'notify.group.yesterday': { TH: 'เมื่อวาน', EN: 'Yesterday' },
  'notify.group.earlier': { TH: 'ก่อนหน้านี้', EN: 'Earlier' },

  // PayDetail screen
  'paydetail.header': { TH: 'รอการชำระ', EN: 'Waiting for pay' },
  'paydetail.unpaid': { TH: 'ยังไม่ชำระ', EN: 'Unpaid' },
  'paydetail.all_list': { TH: 'รายการทั้งหมด', EN: 'All List' },
  'paydetail.pay': { TH: 'ชำระ', EN: 'Pay' },
  'paydetail.pay_all': { TH: 'ชำระทั้งหมด', EN: 'Pay All' },

  // Payment screen
  'payment.title': { TH: 'ชำระเงิน', EN: 'Payment' },
  'payment.unpaid': { TH: 'ยังไม่ชำระ', EN: 'Unpaid' },
  'payment.method': { TH: 'วิธีการชำระเงิน', EN: 'Payment Method' },
  'payment.scan_to_pay': { TH: 'สแกนเพื่อชำระเงิน', EN: 'Scan to pay' },
  'payment.upload_photo': { TH: 'อัปโหลดรูป', EN: 'Upload Photo' },
  'payment.back': { TH: 'ย้อนกลับ', EN: 'Back' },

  // PaymentUpload screen
  'paymentupload.title': { TH: 'อัปโหลดสลิปการชำระเงิน', EN: 'Upload Payment Slip' },
  'paymentupload.section.title': { TH: 'อัปโหลดสลิปการชำระเงิน', EN: 'Upload Payment Slip' },
  'paymentupload.section.subtitle': { TH: 'โปรดอัปโหลดรูปสลิปที่ชัดเจน', EN: 'Please upload a clear photo of your payment slip' },
  'paymentupload.tap_to_change': { TH: 'แตะเพื่อเปลี่ยนรูป', EN: 'Tap to change photo' },
  'paymentupload.upload_slip': { TH: 'อัปโหลดสลิป', EN: 'Upload Slip' },
  'paymentupload.tap_or_longpress': { TH: 'แตะเพื่อเลือกจากแกลเลอรี หรือกดค้างเพื่อถ่ายรูป', EN: 'Tap to select from gallery or long press to take a photo' },
  'paymentupload.payment_details': { TH: 'รายละเอียดการชำระเงิน', EN: 'Payment Details' },
  'paymentupload.amount_in_slip': { TH: 'ยอดในสลิป:', EN: 'Amount in Slip:' },
  'paymentupload.scanning': { TH: 'กำลังสแกน...', EN: 'Scanning...' },
  'paymentupload.expected_amount': { TH: 'ยอดที่ต้องชำระ:', EN: 'Expected Amount:' },
  'paymentupload.scan_again': { TH: 'สแกนอีกครั้ง', EN: 'Scan Again' },
  'paymentupload.mismatch_warning': { TH: "ยอดเงินไม่ตรง", EN: "Amount doesn't match" },
  'paymentupload.mismatch_detail': { TH: 'ยอดในสลิป: {slip} ฿\nยอดที่ต้องจ่าย: {expected} ฿', EN: 'Slip amount: {slip} ฿\nExpected: {expected} ฿' },
  'paymentupload.warning_box': { TH: 'ยอดเงินในสลิปไม่ตรงกับยอดที่ต้องจ่าย', EN: "Amount doesn't match the expected payment" },
  'paymentupload.confirm_payment': { TH: 'ยืนยันการชำระเงิน', EN: 'Confirm Payment' },
  'paymentupload.upload_cta': { TH: 'อัปโหลดสลิป', EN: 'Upload Slip' },
  'paymentupload.success': { TH: 'สำเร็จ', EN: 'Success' },
  'paymentupload.success_msg': { TH: 'ส่งการชำระเงินเพื่อรอการตรวจสอบแล้ว', EN: 'Payment submitted for review.' },
  'paymentupload.error': { TH: 'ข้อผิดพลาด', EN: 'Error' },
  'paymentupload.error_msg': { TH: 'ไม่สามารถส่งการชำระเงินได้', EN: 'Unable to submit payment.' },
  'paymentupload.require_ocr': { TH: 'ต้องการยอดจากสลิป', EN: 'Amount from slip required' },
  'paymentupload.require_ocr_msg': { TH: 'กรุณาให้ระบบอ่านยอดจากสลิปให้สำเร็จก่อน', EN: 'Please let the system read the amount from the slip first.' },
  'paymentupload.mismatch_title': { TH: 'ยอดไม่ตรง', EN: 'Amount mismatch' },
  'paymentupload.ok': { TH: 'ตกลง', EN: 'OK' },

  // ConfirmPayments screen
  'confirm.title': { TH: 'ยืนยันการชำระเงิน', EN: 'Confirm Payment' },
  'confirm.total_owed_label': { TH: 'ยอดที่ผู้อื่นค้างชำระให้คุณ', EN: 'Total Amount Owed to You' },
  'confirm.total_note': { TH: 'ยอดนี้จะลดลงเมื่อการชำระเงินได้รับการอนุมัติ', EN: 'This amount will decrease as payments are approved' },
  'confirm.empty': { TH: 'ยังไม่มีคำขอยืนยันการชำระเงิน', EN: 'No payment confirmations yet' },
  'confirm.ocr.loading': { TH: 'OCR: กำลังตรวจ…', EN: 'OCR: Checking…' },
  'confirm.ocr.matched': { TH: 'OCR: ตรงกัน', EN: 'OCR: Matched' },
  'confirm.ocr.mismatch': { TH: 'OCR: ไม่ตรง', EN: 'OCR: Mismatch' },
  'confirm.ocr.error': { TH: 'OCR: ผิดพลาด', EN: 'OCR: Error' },

  // ConfirmSlip screen
  'confirmslip.title': { TH: 'ยืนยันการชำระเงิน', EN: 'Confirm Payment' },
  'confirmslip.no_image': { TH: 'ไม่มีรูปภาพ', EN: 'No image available' },

  // TripDebtDetail screen
  'tripdebt.header': { TH: 'บิล', EN: 'Bill' },
  'tripdebt.unpaid': { TH: 'ยังไม่ชำระ', EN: 'Unpaid' },
  'tripdebt.pay_method': { TH: 'ชำระแบบการ ชำระเงินออนไลน์ :', EN: 'Payment Method: Online Payment' },
  'tripdebt.detail': { TH: 'รายละเอียด', EN: 'Detail' },
  'tripdebt.price': { TH: 'ราคา', EN: 'Price' },
  'tripdebt.total': { TH: 'รวม', EN: 'Total' },
  'tripdebt.pay_scan': { TH: 'สแกนจ่าย', EN: 'Pay Scan' },

  // AddFriends screen
  'friends.title': { TH: 'เพิ่มเพื่อน', EN: 'Add Friends' },
  'friends.tab.friends': { TH: 'เพื่อน', EN: 'Friends' },
  'friends.tab.group': { TH: 'กลุ่ม', EN: 'Group' },
  'friends.search_placeholder': { TH: 'ค้นหาจากชื่อเต็ม', EN: 'Search by full name' },
  'friends.action.delete': { TH: 'ลบ', EN: 'Delete' },
  'friends.action.pending': { TH: 'รอดำเนินการ', EN: 'Pending' },
  'friends.action.accept': { TH: 'ยอมรับ', EN: 'Accept' },
  'friends.action.decline': { TH: 'ปฏิเสธ', EN: 'Decline' },
  'friends.action.add': { TH: 'เพิ่ม', EN: 'Add' },
  'friends.header.received': { TH: 'คำขอเป็นเพื่อนที่ได้รับ', EN: 'Received Friend Requests' },
  'friends.header.sent': { TH: 'คำขอที่ส่งออกไป', EN: 'Sent Requests' },
  'friends.header.my': { TH: 'เพื่อนของฉัน', EN: 'My Friends' },
  'friends.empty.users': { TH: 'ไม่พบผู้ใช้', EN: 'No users found' },
  'friends.empty.none': { TH: 'คุณยังไม่มีเพื่อนหรือคำขอเป็นเพื่อน', EN: "You don't have friends or requests yet" },
  'friends.group.empty.title': { TH: 'ไม่พบทริป', EN: 'No trips found' },
  'friends.group.empty.subtitle': { TH: 'สร้างทริปใหม่เพื่อเริ่มต้น', EN: 'Create a new trip to get started' },

  // Register screen
  'register.signup': { TH: 'สมัครสมาชิก', EN: 'Sign up' },
  'register.login': { TH: 'เข้าสู่ระบบ', EN: 'Log in' },

  // Signup screen (step 1)
  'signup.title': { TH: 'สมัครสมาชิก', EN: 'Sign up' },
  'signup.email': { TH: 'อีเมล', EN: 'Email address' },
  'signup.password': { TH: 'รหัสผ่าน', EN: 'Password' },
  'signup.min_hint': { TH: 'อย่างน้อย 8 ตัวอักษร', EN: 'Minimum 8 characters' },
  'signup.next': { TH: 'ถัดไป', EN: 'Next' },
  'signup.alert_fill': { TH: 'กรุณากรอกอีเมลและรหัสผ่าน', EN: 'Please enter both email and password' },

  // Signup step 2
  'signup2.title': { TH: 'สมัครสมาชิก', EN: 'Sign up' },
  'signup2.fullname': { TH: 'ชื่อ-นามสกุล', EN: 'Full name' },
  'signup2.phone': { TH: 'เบอร์โทร', EN: 'Phone number' },
  'signup2.currency_hint': { TH: 'ฉันใช้', EN: 'I use' },
  'signup2.currency_change': { TH: 'เปลี่ยน', EN: 'Change' },
  'signup2.next': { TH: 'ถัดไป', EN: 'Next' },

  // Forgot Password screen
  'forgot.title': { TH: 'ตั้งรหัสผ่านใหม่', EN: 'Reset Password' },
  'forgot.subtitle': { TH: 'กรอกอีเมลที่ลงทะเบียนและตั้งรหัสผ่านใหม่', EN: 'Enter your registered email and set a new password.' },
  'forgot.email': { TH: 'อีเมล', EN: 'Email address' },
  'forgot.new_password': { TH: 'รหัสผ่านใหม่', EN: 'New password' },
  'forgot.confirm_password': { TH: 'ยืนยันรหัสผ่านใหม่', EN: 'Confirm new password' },
  'forgot.updating': { TH: 'กำลังอัปเดต...', EN: 'Updating...' },
  'forgot.reset': { TH: 'รีเซ็ตรหัสผ่าน', EN: 'Reset Password' },
  'forgot.back_to_login': { TH: 'กลับไปหน้าเข้าสู่ระบบ', EN: 'Back to Login' },

  // Not Found screen
  'notfound.title': { TH: 'อุ๊ปส์!', EN: 'Oops!' },
  'notfound.body': { TH: 'หน้านี้ไม่มีอยู่จริง', EN: 'This screen does not exist.' },
  'notfound.go_home': { TH: 'กลับหน้าแรก', EN: 'Go to home screen!' },

  // Debttrip screen
  'debttrip.title': { TH: 'หนี้', EN: 'Debt' },
  'debttrip.total_to_pay': { TH: 'ยอดรวมที่ต้องชำระ', EN: 'Total Amount to Pay' },
  'debttrip.waiting_for_pay': { TH: 'รอการชำระ', EN: 'Waiting for pay' },
  'debttrip.no_debts': { TH: 'ไม่พบหนี้ที่ต้องชำระ', EN: 'No debts to pay' },
  'debttrip.travel_expenses': { TH: 'ค่าใช้จ่ายท่องเที่ยว', EN: 'Travel expenses' },
  'debttrip.pay': { TH: 'ชำระ', EN: 'Pay' },
  'debttrip.already_paid': { TH: 'ชำระแล้ว', EN: 'Already Paid' },
  'debttrip.confirmed': { TH: 'ยืนยันแล้ว', EN: 'Confirmed' },
  'debttrip.waiting_confirm': { TH: 'รอการยืนยัน', EN: 'Waiting for confirm' },

  // Profile Edit
  'profileedit.title': { TH: 'แก้ไขโปรไฟล์', EN: 'Edit Profile' },
  'profileedit.fullname': { TH: 'ชื่อ-นามสกุล', EN: 'Full Name' },
  'profileedit.phone': { TH: 'เบอร์โทร', EN: 'Phone Number' },
  'profileedit.currency': { TH: 'สกุลเงิน (เช่น THB)', EN: 'Currency (e.g. THB)' },
  'profileedit.language': { TH: 'ภาษา (เช่น TH)', EN: 'Language (e.g. TH)' },
  'profileedit.change_qr': { TH: 'เปลี่ยนรูป QR', EN: 'Change QR Image' },
  'profileedit.save': { TH: 'บันทึก', EN: 'Save' },
  'profileedit.upload_failed': { TH: 'อัปโหลดล้มเหลว', EN: 'Upload Failed' },
  'profileedit.upload_profile_fail': { TH: 'ไม่สามารถอัปโหลดรูปโปรไฟล์ได้', EN: 'Unable to upload profile image' },
  'profileedit.upload_qr_fail': { TH: 'ไม่สามารถอัปโหลดรูป QR ได้', EN: 'Unable to upload QR image' },
  'profileedit.updated': { TH: 'อัปเดตโปรไฟล์แล้ว', EN: 'Profile Updated' },

  // Profile View
  'profileview.title': { TH: 'บัญชีผู้ใช้', EN: 'Account' },
  'profileview.user_fallback': { TH: 'ผู้ใช้', EN: 'User' },
  'profileview.phone': { TH: 'เบอร์โทร', EN: 'Phone number' },
  'profileview.currency': { TH: 'สกุลเงิน', EN: 'Currency' },
  'profileview.language': { TH: 'ภาษา', EN: 'Language' },
  'profileview.edit': { TH: 'แก้ไข', EN: 'Edit' },
  'profileview.logout': { TH: 'ออกจากระบบ', EN: 'Log out' },

  // Headers / Buttons that appear in multiple screens can be added over time
};

function translate(locale: Locale, key: string): string {
  const entry = translations[key];
  if (!entry) return key; // fallback to key if missing
  return entry[locale];
}

interface LanguageContextValue {
  language: Locale;
  setLanguage: (l: Locale) => Promise<void>;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const STORAGE_KEY = 'app_language';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Locale>('TH');

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved === 'TH' || saved === 'EN') {
          setLanguageState(saved);
        }
      } catch {}
    })();
  }, []);

  const setLanguage = async (l: Locale) => {
    setLanguageState(l);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, l);
    } catch {}
  };

  const value = useMemo(() => ({
    language,
    setLanguage,
    t: (key: string) => translate(language, key),
  }), [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
