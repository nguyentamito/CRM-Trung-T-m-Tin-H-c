import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  LogOut, 
  User as UserIcon,
  ShieldCheck,
  ChevronRight,
  MessageSquare,
  BookOpen,
  CheckCircle2,
  Receipt as ReceiptIcon,
  Settings as SettingsIcon,
  BarChart3,
  CreditCard,
  Wallet,
  ClipboardCheck,
  Clock
} from 'lucide-react';
import { UserProfile, StaffAttendance } from '../types';
import { cn } from '../lib/utils';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  profile: UserProfile | null;
  onLogout: () => void;
  onAttendanceClick?: () => void;
  currentAttendance?: StaffAttendance | null;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function Sidebar({ activeTab, setActiveTab, profile, onLogout, onAttendanceClick, currentAttendance, isOpen, setIsOpen }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'customers', label: 'Khách hàng', icon: Users },
    { id: 'appointments', label: 'Lịch hẹn', icon: Calendar },
    { id: 'attendance', label: 'Điểm danh', icon: CheckCircle2 },
    { id: 'receipts', label: 'Phiếu thu', icon: ReceiptIcon },
    { id: 'payments', label: 'Phiếu chi', icon: CreditCard },
    { id: 'debt', label: 'Công nợ', icon: Wallet },
    { id: 'reports', label: 'Báo cáo', icon: BarChart3 },
    { id: 'settings', label: 'Cài đặt', icon: SettingsIcon },
  ];

  if (profile?.role === 'admin') {
    menuItems.push(
      { id: 'users', label: 'Người dùng', icon: ShieldCheck },
      { id: 'staff_attendance_report', label: 'Chấm công NV', icon: Clock },
      { id: 'subjects', label: 'Môn học', icon: BookOpen },
      { id: 'teachers', label: 'Giáo viên', icon: UserIcon },
      { id: 'tas', label: 'Trợ giảng', icon: UserIcon },
      { id: 'rooms', label: 'Phòng học', icon: ShieldCheck },
      { id: 'classes', label: 'Lớp học', icon: Users }
    );
  }

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col h-full transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
      isOpen ? "translate-x-0" : "-translate-x-full"
    )}>
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-xl">C</span>
          </div>
          <span className="font-bold text-xl text-gray-900 truncate">CRM Pro</span>
        </div>
        <button 
          onClick={() => setIsOpen(false)}
          className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-gray-400 rotate-180" />
        </button>
      </div>

      <nav className="flex-1 px-3 space-y-1 mt-4 overflow-y-auto custom-scrollbar max-h-[calc(100vh-200px)]">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group",
                isActive 
                  ? "bg-blue-50 text-blue-600 shadow-sm" 
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon className={cn("w-5 h-5", isActive ? "text-blue-600" : "text-gray-400 group-hover:text-gray-600")} />
              <span className="font-medium">{item.label}</span>
              {isActive && <ChevronRight className="ml-auto w-4 h-4" />}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-2 py-3">
          {profile?.photoURL ? (
            <img src={profile.photoURL} alt="Avatar" className="w-10 h-10 rounded-full border border-gray-200" />
          ) : (
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center border border-gray-200">
              <UserIcon className="w-5 h-5 text-gray-400" />
            </div>
          )}
          <div className="overflow-hidden">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {profile?.displayName === '0' || !profile?.displayName ? 'Chưa đặt tên' : profile.displayName}
            </p>
            <p className="text-xs text-gray-500">
              {profile?.role === 'admin' ? 'Quản trị viên' : 
               profile?.role === 'teacher' ? 'Giáo viên' : 
               profile?.role === 'ta' ? 'Trợ giảng' : 
               profile?.role === 'collaborator' ? 'Cộng tác viên' : 'Nhân viên'}
            </p>
          </div>
        </div>
        
        {onAttendanceClick && (
          <button
            onClick={onAttendanceClick}
            className={cn(
              "w-full mt-2 flex items-center gap-3 px-3 py-3 rounded-xl transition-all font-medium",
              currentAttendance?.status === 'active' 
                ? "bg-green-50 text-green-600 hover:bg-green-100" 
                : "bg-blue-50 text-blue-600 hover:bg-blue-100"
            )}
          >
            <ClipboardCheck className="w-5 h-5" />
            <span>{currentAttendance?.status === 'active' ? 'Kết thúc công' : 'Chấm công'}</span>
          </button>
        )}

        <button
          onClick={onLogout}
          className="w-full mt-2 flex items-center gap-3 px-3 py-3 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Đăng xuất</span>
        </button>
      </div>
    </aside>
  );
}
