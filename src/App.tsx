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
import { LogIn, Loader2, AlertCircle } from 'lucide-react';

import TeacherList from './components/TeacherList';
import TAList from './components/TAList';
import ClassList from './components/ClassList';
import AttendanceManager from './components/AttendanceManager';
import ReceiptManager from './components/ReceiptManager';
import PaymentVoucherManager from './components/PaymentVoucherManager';
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
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setProfile(userDoc.data() as UserProfile);
          } else {
            // Create default profile for new user
            const newProfile: UserProfile = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || 'Người dùng',
              role: user.email === 'nguyentamito@gmail.com' ? 'admin' : 'staff',
              photoURL: user.photoURL || undefined
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
            {activeTab === 'classes' && <ClassList profile={profile} />}
            {activeTab === 'attendance' && <AttendanceManager profile={profile} />}
            {activeTab === 'receipts' && <ReceiptManager profile={profile} />}
            {activeTab === 'payments' && <PaymentVoucherManager profile={profile} />}
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
