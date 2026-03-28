export type CustomerStatus = 'Đã đóng tiền' | 'Đã cọc' | 'Đã chốt' | 'Phân vân' | 'Hẹn lại' | 'Khác';
export type CustomerSource = 'Facebook' | 'Tiktok' | 'CTV Online' | 'Được giới thiệu' | 'Học viên tự đến' | 'Khác';

export interface Customer {
  id: string;
  consultationDate: number;
  fbLink: string;
  name: string;
  phone: string;
  subject: string;
  status: CustomerStatus;
  notes: string;
  closedAmount: string;
  source: CustomerSource;
  ownerId: string;
  ownerName: string;
  createdAt: number;
  updatedAt: number;
}

export type InteractionStatus = 'đã liên hệ' | 'chưa phản hồi' | 'quan tâm' | 'từ chối';

export interface Interaction {
  id: string;
  customerId: string;
  content: string;
  notes: string;
  status: InteractionStatus;
  staffId: string;
  createdAt: number;
}

export type AppointmentStatus = 'đã diễn ra' | 'hoãn' | 'hủy' | 'chưa diễn ra';

export interface Appointment {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  time: number;
  content: string;
  staffId: string;
  status: AppointmentStatus;
  createdAt: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'staff' | 'teacher';
  photoURL?: string;
}

export interface Subject {
  id: string;
  name: string;
  createdAt: number;
}

export interface Teacher {
  id: string;
  name: string;
  phone: string;
  email: string;
  subjects: string[];
  createdAt: number;
}

export interface TeachingAssistant {
  id: string;
  name: string;
  phone: string;
  email: string;
  createdAt: number;
}

export type ClassStatus = 'đang học' | 'kết thúc' | 'tạm dừng';

export interface Session {
  dayOfWeek: number; // 0: Sunday, 1: Monday, ..., 6: Saturday
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
}

export interface Class {
  id: string;
  name: string;
  studentIds: string[];
  studentNames: string[];
  subject: string;
  teacherId: string;
  teacherName: string;
  taId: string;
  taName: string;
  schedule: string;
  sessions: Session[];
  startDate: number;
  status: ClassStatus;
  createdAt: number;
  updatedAt: number;
}

export type SessionStatus = 'chưa diễn ra' | 'hoàn thành' | 'hủy' | 'đang học' | 'kết thúc';

export interface TeachingSession {
  id: string;
  classId: string;
  className: string;
  subject: string;
  teacherId: string;
  teacherName: string;
  taId: string;
  taName: string;
  date: number; // timestamp for the specific day
  startTime: string;
  endTime: string;
  status: SessionStatus;
  createdAt: number;
}

export type AttendanceStatus = 'có mặt' | 'vắng mặt' | 'muộn' | 'phép';

export interface Attendance {
  id: string;
  sessionId: string;
  classId: string;
  studentId: string;
  studentName: string;
  status: AttendanceStatus;
  note?: string;
  takenById: string;
  takenByName: string;
  updatedAt: number;
}

export type ReceiptType = 'cọc' | 'đóng tất' | 'đóng 100%';
export type PaymentMethod = 'tiền mặt' | 'chuyển khoản' | 'khác';

export interface Receipt {
  id: string;
  receiptNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  subject: string;
  amount: number;
  totalAmount: number; // The closedAmount from customer
  remainingAmount: number; // Amount left after this payment
  type: ReceiptType;
  paymentMethod: PaymentMethod;
  note?: string;
  staffId: string;
  staffName: string;
  createdAt: number;
}

export interface CenterInfo {
  id: string;
  name: string;
  address: string;
  website: string;
  updatedAt: number;
}

export type PaymentCategory = 'lương nhân viên' | 'lương giáo viên' | 'lương trợ giảng' | 'tiền nhà' | 'tiền điện' | 'tiền nước' | 'văn phòng phẩm' | 'marketing' | 'khác';

export interface PaymentVoucher {
  id: string;
  voucherNumber: string;
  category: PaymentCategory;
  recipientName: string;
  recipientId?: string; // Optional ID if it's a system user/teacher/TA
  amount: number;
  description: string;
  paymentMethod: PaymentMethod;
  staffId: string;
  staffName: string;
  createdAt: number;
  updatedAt: number;
}
