import React, { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { auth, db, signInWithGoogle, logout } from './firebase';
import { UserProfile, Customer, Appointment, Receipt, PaymentVoucher, TeachingSession, Attendance, StaffAttendance } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import CustomerList from './components/CustomerList';
import AppointmentCalendar from './components/AppointmentCalendar';
import SubjectManagement from './components/SubjectManagement';
import { LogIn, Loader2, AlertCircle, Clock, LogOut, Menu, X as CloseIcon, ClipboardCheck } from 'lucide-react';

import TeacherList from './components/TeacherList';
import TAList from './components/TAList';
import RoomList from './components/RoomList';
import ClassList from './components/ClassList';
import AttendanceManager from './components/AttendanceManager';
import ReceiptManager from './components/ReceiptManager';
import PaymentVoucherManager from './components/PaymentVoucherManager';
import DebtManager from './components/DebtManager';
import UserManagement from './components/UserManagement';
import Reports from './components/Reports';
import Settings from './components/Settings';
import StaffAttendanceModal from './components/StaffAttendanceModal';
import StaffAttendanceList from './components/StaffAttendanceList';

import ErrorBoundary from './components/ErrorBoundary';
import { format } from 'date-fns';
import { cn } from './lib/utils';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTodayAppointments, setShowTodayAppointments] = useState(false);
  const hasShownTodayAppointmentsRef = useRef(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [currentAttendance, setCurrentAttendance] = useState<StaffAttendance | null>(null);
  const hasCheckedAttendanceRef = useRef(false);

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
          
          // Try to fetch profile from MySQL
          const res = await fetch(`/api/users?uid=${user.uid}`);
          if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Server error: ${res.status} - ${errorText.substring(0, 100)}`);
          }
          const users = await res.json();
          const existingProfile = Array.isArray(users) ? users.find((u: any) => u.uid === user.uid) : null;
          
          if (existingProfile) {
            // Ensure admin is always approved and has correct role
            if (isAdmin && (!existingProfile.isApproved || existingProfile.role !== 'admin')) {
              const updatedProfile = { 
                ...existingProfile, 
                role: 'admin' as const, 
                isApproved: true,
                updatedAt: Date.now()
              };
              await fetch(`/api/users/${user.uid}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedProfile)
              });
              setProfile(updatedProfile);
            } else {
              setProfile(existingProfile);
            }
          } else {
            // Create default profile for new user in MySQL
            const newProfile: UserProfile = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || 'Người dùng',
              role: isAdmin ? 'admin' : 'staff',
              photoURL: user.photoURL || undefined,
              isApproved: isAdmin, // Admin is auto-approved
              createdAt: Date.now(),
              updatedAt: Date.now()
            };
            await fetch('/api/users', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newProfile)
            });
            setProfile(newProfile);
          }
        } catch (err) {
          console.error("Error fetching profile:", err);
          setError("Không thể tải thông tin người dùng từ máy chủ. Vui lòng kiểm tra cấu hình cơ sở dữ liệu.");
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const isSystemAdmin = user?.email?.toLowerCase() === 'nguyentamito@gmail.com';

  const handleSaveStaffAttendance = async (data: Partial<StaffAttendance>) => {
    try {
      const method = data.id ? 'PUT' : 'POST';
      const url = data.id ? `/api/staff_attendance/${data.id}` : '/api/staff_attendance';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (res.ok) {
        const saved = await res.json();
        setCurrentAttendance(saved);
      }
    } catch (error) {
      console.error("Error saving staff attendance:", error);
    }
  };

  useEffect(() => {
    if (!profile) return;

    const safeJson = async (res: Response, label: string) => {
      if (!res.ok) return [];
      try {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return await res.json();
        }
        // If not JSON, it might be the SPA fallback or an error page
        const text = await res.text();
        if (text.includes("<!doctype") || text.includes("<html")) {
          console.warn(`Received HTML instead of JSON for ${label}. Server might be starting up or route not found.`);
        } else {
          console.warn(`Expected JSON for ${label} but got ${contentType}: ${text.substring(0, 100)}`);
        }
        return [];
      } catch (e) {
        console.error(`JSON parse error ${label}:`, e);
        return [];
      }
    };

    const fetchData = async (retries = 3, delay = 1000) => {
      try {
        // If not approved, poll for profile update
        if (!profile.isApproved && profile.role !== 'admin' && !isSystemAdmin) {
          const res = await fetch(`/api/users?uid=${profile.uid}`);
          if (res.ok) {
            const users = await safeJson(res, "profile-poll");
            const currentProfile = Array.isArray(users) ? users.find((u: any) => u.uid === profile.uid) : null;
            if (currentProfile && currentProfile.isApproved) {
              setProfile(currentProfile);
            }
          }
        }

        const ownerIdParam = profile.role === 'admin' ? '' : `?ownerId=${profile.uid}`;
        const staffIdParam = profile.role === 'admin' ? '' : `?staffId=${profile.uid}`;

        const [
          customersRes,
          appointmentsRes,
          receiptsRes,
          paymentsRes,
          sessionsRes,
          attendanceRes,
          staffRes,
          staffAttendanceRes
        ] = await Promise.all([
          fetch(`/api/customers${ownerIdParam}`),
          fetch(`/api/appointments${staffIdParam}`),
          fetch(`/api/receipts`),
          fetch(`/api/payment_vouchers`),
          fetch(`/api/teaching_sessions`),
          fetch(`/api/attendance`),
          fetch(`/api/users`),
          fetch(`/api/staff_attendance?staffId=${profile.uid}&date=${format(new Date(), 'yyyy-MM-dd')}`)
        ]);

        const [
          customersData,
          appointmentsData,
          receiptsData,
          paymentsData,
          sessionsData,
          attendanceData,
          staffData,
          staffAttendanceData
        ] = await Promise.all([
          safeJson(customersRes, "customers"),
          safeJson(appointmentsRes, "appointments"),
          safeJson(receiptsRes, "receipts"),
          safeJson(paymentsRes, "payments"),
          safeJson(sessionsRes, "sessions"),
          safeJson(attendanceRes, "attendance"),
          safeJson(staffRes, "staff"),
          safeJson(staffAttendanceRes, "staff_attendance")
        ]);

        setCustomers(Array.isArray(customersData) ? customersData : []);
        setAppointments(Array.isArray(appointmentsData) ? appointmentsData : []);
        setReceipts(Array.isArray(receiptsData) ? receiptsData : []);
        setPaymentVouchers(Array.isArray(paymentsData) ? paymentsData : []);
        setTeachingSessions(Array.isArray(sessionsData) ? sessionsData : []);
        setAttendance(Array.isArray(attendanceData) ? attendanceData : []);
        setStaff(Array.isArray(staffData) ? staffData : []);

        // Staff Attendance Logic
        if (Array.isArray(staffAttendanceData)) {
          const activeRecord = staffAttendanceData.find(a => a.status === 'active');
          const todayRecords = staffAttendanceData.filter(a => a.date === format(new Date(), 'yyyy-MM-dd'));
          
          // If there's an active record, use it. Otherwise use the most recent today record.
          setCurrentAttendance(activeRecord || (todayRecords.length > 0 ? todayRecords[todayRecords.length - 1] : null));
          
          if (!hasCheckedAttendanceRef.current) {
            if (!activeRecord) {
              // No active record, check if we should prompt for a new one
              // If no records at all for today, prompt.
              if (todayRecords.length === 0) {
                setShowAttendanceModal(true);
              }
            } else {
              // Has an active record, prompt to check out
              setShowAttendanceModal(true);
            }
            hasCheckedAttendanceRef.current = true;
          }
        }

        // Check for today's appointments after data is loaded
        if (!hasShownTodayAppointmentsRef.current && Array.isArray(appointmentsData) && appointmentsData.length > 0) {
          const today = new Date();
          const todayApps = appointmentsData.filter(app => {
            const appDate = new Date(app.time);
            return appDate.getDate() === today.getDate() &&
                   appDate.getMonth() === today.getMonth() &&
                   appDate.getFullYear() === today.getFullYear() &&
                   app.status === 'chưa diễn ra';
          });

          if (todayApps.length > 0) {
            setShowTodayAppointments(true);
            hasShownTodayAppointmentsRef.current = true;
          }
        }
      } catch (err: any) {
        if (retries > 0 && (err.message === 'Failed to fetch' || err.name === 'TypeError')) {
          console.warn(`Fetch failed, retrying in ${delay}ms... (${retries} retries left)`);
          setTimeout(() => fetchData(retries - 1, delay * 2), delay);
        } else {
          console.error("Error fetching app data:", err);
          if (err.message === 'Failed to fetch') {
            console.error("This usually means the server is still starting up or there's a network issue. Please refresh the page in a few seconds.");
          }
        }
      }
    };

    // Add a small initial delay to ensure server is ready
    const timeoutId = setTimeout(() => fetchData(), 500);
    const intervalId = setInterval(() => fetchData(), 60000); // Poll every minute
    
    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [profile]);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

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
      <div className="flex h-screen bg-gray-50 overflow-hidden relative">
        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setIsSidebarOpen(false);
          }} 
          profile={profile}
          onLogout={logout}
          onAttendanceClick={() => setShowAttendanceModal(true)}
          currentAttendance={currentAttendance}
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
        />
        
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">C</span>
              </div>
              <span className="font-bold text-lg text-gray-900">CRM Pro</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAttendanceModal(true)}
              className={cn(
                "p-2 rounded-lg transition-colors",
                currentAttendance?.status === 'active' ? "bg-green-100 text-green-600" : "bg-blue-100 text-blue-600"
              )}
            >
              <ClipboardCheck className="w-5 h-5" />
            </button>
            {profile?.photoURL ? (
              <img src={profile.photoURL} alt="Avatar" className="w-8 h-8 rounded-full border border-gray-200" />
            ) : (
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center border border-gray-200">
                <Loader2 className="w-4 h-4 text-gray-400" />
              </div>
            )}
          </div>
        </header>

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
              {activeTab === 'debt' && <DebtManager profile={profile} />}
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
                  profile={profile}
                />
              )}
              {activeTab === 'staff_attendance_report' && (
                <StaffAttendanceList staff={staff} profile={profile} />
              )}
              {activeTab === 'settings' && <Settings profile={profile} />}
            </div>
          </main>
        </div>
      </div>

      {/* Staff Attendance Modal */}
      {showAttendanceModal && profile && (
        <StaffAttendanceModal
          profile={profile}
          currentAttendance={currentAttendance}
          onSave={handleSaveStaffAttendance}
          onClose={() => setShowAttendanceModal(false)}
        />
      )}

      {/* Today's Appointments Notification Modal */}
      {showTodayAppointments && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-blue-600 text-white">
              <div className="flex items-center gap-2">
                <Clock className="w-6 h-6" />
                <h2 className="text-xl font-bold">Lịch hẹn hôm nay</h2>
              </div>
              <button onClick={() => setShowTodayAppointments(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors">
                <LogOut className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
              <p className="text-gray-600 font-medium">Bạn có {appointments.filter(app => {
                const today = new Date();
                const appDate = new Date(app.time);
                return appDate.getDate() === today.getDate() &&
                       appDate.getMonth() === today.getMonth() &&
                       appDate.getFullYear() === today.getFullYear() &&
                       app.status === 'chưa diễn ra';
              }).length} lịch hẹn trong ngày hôm nay:</p>
              <div className="space-y-3">
                {appointments
                  .filter(app => {
                    const today = new Date();
                    const appDate = new Date(app.time);
                    return appDate.getDate() === today.getDate() &&
                           appDate.getMonth() === today.getMonth() &&
                           appDate.getFullYear() === today.getFullYear() &&
                           app.status === 'chưa diễn ra';
                  })
                  .sort((a, b) => a.time - b.time)
                  .map(app => (
                    <div key={app.id} className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-blue-600">
                          {new Date(app.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-gray-900">{app.customerName}</p>
                      <p className="text-xs text-gray-600 line-clamp-2 mt-1">{app.content}</p>
                    </div>
                  ))}
              </div>
            </div>
            <div className="p-6 pt-0">
              <button
                onClick={() => {
                  setShowTodayAppointments(false);
                  setActiveTab('appointments');
                }}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg"
              >
                Xem tất cả lịch hẹn
              </button>
            </div>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
}
