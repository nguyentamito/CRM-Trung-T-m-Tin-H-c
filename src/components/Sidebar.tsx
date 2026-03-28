import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  LogOut, 
  User as UserIcon,
  ChevronRight,
  MessageSquare,
  BookOpen,
  CheckCircle2,
  Receipt as ReceiptIcon,
  Settings as SettingsIcon,
  BarChart3,
  CreditCard
} from 'lucide-react';
import { UserProfile } from '../types';
import { cn } from '../lib/utils';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  profile: UserProfile | null;
  onLogout: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, profile, onLogout }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'customers', label: 'Khách hàng', icon: Users },
    { id: 'appointments', label: 'Lịch hẹn', icon: Calendar },
    { id: 'attendance', label: 'Điểm danh', icon: CheckCircle2 },
    { id: 'receipts', label: 'Phiếu thu', icon: ReceiptIcon },
    { id: 'payments', label: 'Phiếu chi', icon: CreditCard },
    { id: 'reports', label: 'Báo cáo', icon: BarChart3 },
    { id: 'settings', label: 'Cài đặt', icon: SettingsIcon },
  ];

  if (profile?.role === 'admin') {
    menuItems.push(
      { id: 'subjects', label: 'Môn học', icon: BookOpen },
      { id: 'teachers', label: 'Giáo viên', icon: UserIcon },
      { id: 'tas', label: 'Trợ giảng', icon: UserIcon },
      { id: 'classes', label: 'Lớp học', icon: Users }
    );
  }

  return (
    <aside className="w-20 md:w-64 bg-white border-r border-gray-200 flex flex-col h-full transition-all duration-300">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-xl">C</span>
        </div>
        <span className="hidden md:block font-bold text-xl text-gray-900 truncate">CRM Pro</span>
      </div>

      <nav className="flex-1 px-3 space-y-1 mt-4">
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
              <span className="hidden md:block font-medium">{item.label}</span>
              {isActive && <ChevronRight className="hidden md:block ml-auto w-4 h-4" />}
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
          <div className="hidden md:block overflow-hidden">
            <p className="text-sm font-semibold text-gray-900 truncate">{profile?.displayName}</p>
            <p className="text-xs text-gray-500 capitalize">{profile?.role}</p>
          </div>
        </div>
        
        <button
          onClick={onLogout}
          className="w-full mt-2 flex items-center gap-3 px-3 py-3 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="hidden md:block font-medium">Đăng xuất</span>
        </button>
      </div>
    </aside>
  );
}
