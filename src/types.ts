export type CustomerStatus = 'Chưa phản hồi' | 'Phân vân' | 'Đã chốt' | 'Khác';

export interface Customer {
  id: string;
  consultationDate: number;
  fbLink: string;
  fbAccount: string;
  name: string;
  phone: string;
  subject: string;
  status: CustomerStatus;
  notes: string;
  closedAmount: string;
  source: string;
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
  role: 'admin' | 'staff';
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
  status: ClassStatus;
  createdAt: number;
}
