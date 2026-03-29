import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { auth, db, signInWithGoogle, logout } from './firebase';
import { UserProfile, Customer, Appointment, Receipt, PaymentVoucher, TeachingSession, Attendance } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import CustomerList from './components/CustomerList';
import AppointmentCalendar from './components/AppointmentCalendar';
import SubjectManagement from './components/SubjectManagement';
import { LogIn, Loader2, AlertCircle, Clock, LogOut } from 'lucide-react';

import TeacherList from './components/TeacherList';
import TAList from './components/TAList';
import RoomList from './components/RoomList';
import ClassList from './components/ClassList';
import AttendanceManager from './components/AttendanceManager';
import ReceiptManager from './components/ReceiptManager';
import PaymentVoucherManager from './components/PaymentVoucherManager';
import UserManagement from './components/UserManagement';
import Reports from './components/Reports';
import Settings from './components/Settings';

import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [error, setError] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [paymentVouchers, setPaymentVouchers] = useState<PaymentVoucher[]>([]);
  const [teachingSessions, setTeachingSessions] = useState<TeachingSession[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [staff, setStaff] = useState<UserProfile[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        try {
          const isAdmin = user.email?.toLowerCase() === 'nguyentamito@gmail.com';
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          
          if (userDoc.exists()) {
            const existingProfile = userDoc.data() as UserProfile;
            // Ensure admin is always approved and has correct role
            if (isAdmin && (!existingProfile.isApproved || existingProfile.role !== 'admin')) {
              const updatedProfile = { 
                ...existingProfile, 
                role: 'admin' as const, 
                isApproved: true 
              };
              await setDoc(doc(db, 'users', user.uid), updatedProfile);
              setProfile(updatedProfile);
            } else {
              setProfile(existingProfile);
            }
          } else {
            // Create default profile for new user
            const newProfile: UserProfile = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || 'Người dùng',
              role: isAdmin ? 'admin' : 'staff',
              photoURL: user.photoURL || undefined,
              isApproved: isAdmin // Admin is auto-approved
            };
            await setDoc(doc(db, 'users', user.uid), newProfile);
            setProfile(newProfile);
          }
        } catch (err) {
          console.error("Error fetching profile:", err);
          setError("Không thể tải thông tin người dùng.");
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!profile) return;

    const qCustomers = profile.role === 'admin'
      ? query(collection(db, 'customers'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'customers'), where('ownerId', '==', profile.uid), orderBy('createdAt', 'desc'));
    
    const unsubscribeCustomers = onSnapshot(qCustomers, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    });

    const qAppointments = profile.role === 'admin'
      ? query(collection(db, 'appointments'), orderBy('time', 'asc'))
      : query(collection(db, 'appointments'), where('staffId', '==', profile.uid), orderBy('time', 'asc'));

    const unsubscribeAppointments = onSnapshot(qAppointments, (snapshot) => {
      setAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment)));
    });

    const qReceipts = query(collection(db, 'receipts'), orderBy('createdAt', 'desc'));
    const unsubscribeReceipts = onSnapshot(qReceipts, (snapshot) => {
      setReceipts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Receipt)));
    });

    const qPayments = query(collection(db, 'payment_vouchers'), orderBy('createdAt', 'desc'));
    const unsubscribePayments = onSnapshot(qPayments, (snapshot) => {
      setPaymentVouchers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentVoucher)));
    });

    const qSessions = query(collection(db, 'teaching_sessions'), orderBy('date', 'desc'));
    const unsubscribeSessions = onSnapshot(qSessions, (snapshot) => {
      setTeachingSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeachingSession)));
    });

    const qAttendance = query(collection(db, 'attendance'));
    const unsubscribeAttendance = onSnapshot(qAttendance, (snapshot) => {
      setAttendance(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Attendance)));
    });

    const qStaff = query(collection(db, 'users'));
    const unsubscribeStaff = onSnapshot(qStaff, (snapshot) => {
      setStaff(snapshot.docs.map(doc => doc.data() as UserProfile));
    });

    return () => {
      unsubscribeCustomers();
      unsubscribeAppointments();
      unsubscribeReceipts();
      unsubscribePayments();
      unsubscribeSessions();
      unsubscribeAttendance();
      unsubscribeStaff();
    };
  }, [profile]);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const isSystemAdmin = user?.email?.toLowerCase() === 'nguyentamito@gmail.com';

  if (user && profile && !profile.isApproved && profile.role !== 'admin' && !isSystemAdmin) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-100">
          <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Clock className="w-8 h-8 text-orange-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Đang chờ phê duyệt</h1>
          <p className="text-gray-600 mb-8">
            Tài khoản của bạn đã được đăng ký thành công. Vui lòng liên hệ quản trị viên để được phê duyệt truy cập vào hệ thống.
          </p>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-xl text-left">
              <p className="text-xs text-gray-500 uppercase font-bold mb-1">Thông tin tài khoản</p>
              <p className="text-sm font-semibold text-gray-900">{profile.displayName}</p>
              <p className="text-sm text-gray-600">{profile.email}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white hover:bg-blue-700 py-3 rounded-xl transition-all font-bold shadow-lg"
            >
              <Loader2 className="w-5 h-5 animate-spin" />
              Làm mới trang
            </button>
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 text-gray-500 hover:text-red-600 hover:bg-red-50 py-3 rounded-xl transition-all font-medium"
            >
              <LogOut className="w-5 h-5" />
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-gray-100">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">CRM Pro</h1>
          <p className="text-gray-600 mb-8">Vui lòng đăng nhập để quản lý khách hàng của bạn.</p>
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-xl hover:bg-gray-50 transition-all shadow-sm"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            Đăng nhập với Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          profile={profile}
          onLogout={logout}
        />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5" />
                {error}
              </div>
            )}

            {activeTab === 'dashboard' && <Dashboard profile={profile} />}
            {activeTab === 'customers' && <CustomerList profile={profile} />}
            {activeTab === 'appointments' && <AppointmentCalendar profile={profile} />}
            {activeTab === 'subjects' && <SubjectManagement profile={profile} />}
            {activeTab === 'teachers' && <TeacherList profile={profile} />}
            {activeTab === 'tas' && <TAList profile={profile} />}
            {activeTab === 'rooms' && <RoomList profile={profile} />}
            {activeTab === 'classes' && <ClassList profile={profile} />}
            {activeTab === 'attendance' && <AttendanceManager profile={profile} />}
            {activeTab === 'receipts' && <ReceiptManager profile={profile} />}
            {activeTab === 'payments' && <PaymentVoucherManager profile={profile} />}
            {activeTab === 'users' && profile?.role === 'admin' && <UserManagement profile={profile} />}
            {activeTab === 'reports' && (
              <Reports 
                customers={customers} 
                appointments={appointments} 
                staff={staff} 
                receipts={receipts}
                paymentVouchers={paymentVouchers}
                teachingSessions={teachingSessions}
                attendance={attendance}
              />
            )}
            {activeTab === 'settings' && <Settings profile={profile} />}
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}
