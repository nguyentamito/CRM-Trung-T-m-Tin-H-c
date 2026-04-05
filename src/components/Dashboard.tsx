import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  UserCheck, 
  Clock, 
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Wallet
} from 'lucide-react';
import { Customer, Appointment, UserProfile, Receipt, StaffAttendance } from '../types';
import { formatNumber, cn } from '../lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { format } from 'date-fns';
import { Info } from 'lucide-react';

interface DashboardProps {
  profile: UserProfile | null;
}

export default function Dashboard({ profile }: DashboardProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [staffAttendance, setStaffAttendance] = useState<StaffAttendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    const safeJson = async (res: Response, label: string) => {
      if (!res.ok) return [];
      try {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return await res.json();
        }
        const text = await res.text();
        if (text.includes("<!doctype") || text.includes("<html")) {
          console.warn(`Received HTML instead of JSON for ${label} in Dashboard. Server might be starting up.`);
        } else {
          console.warn(`Expected JSON for ${label} but got ${contentType}: ${text.substring(0, 100)}`);
        }
        return [];
      } catch (e) {
        console.error(`JSON parse error ${label} in Dashboard:`, e);
        return [];
      }
    };

    const fetchData = async (retries = 3, delay = 1000) => {
      try {
        const staffIdParam = profile.role === 'admin' ? '' : `?staffId=${profile.uid}`;
        const ownerIdParam = profile.role === 'admin' ? '' : `?ownerId=${profile.uid}`;
        const today = format(new Date(), 'yyyy-MM-dd');

        const [appointmentsRes, customersRes, receiptsRes, attendanceRes] = await Promise.all([
          fetch(`/api/appointments${staffIdParam}`),
          fetch(`/api/customers${ownerIdParam}`),
          fetch(`/api/receipts${staffIdParam}`),
          profile.role === 'admin' ? fetch(`/api/staff_attendance?date=${today}`) : Promise.resolve({ ok: true, json: () => [] } as any)
        ]);

        const [appointmentsData, customersData, receiptsData, attendanceData] = await Promise.all([
          safeJson(appointmentsRes, "appointments"),
          safeJson(customersRes, "customers"),
          safeJson(receiptsRes, "receipts"),
          safeJson(attendanceRes, "staff_attendance")
        ]);

        setAppointments(Array.isArray(appointmentsData) ? appointmentsData : []);
        setCustomers(Array.isArray(customersData) ? customersData : []);
        setReceipts(Array.isArray(receiptsData) ? receiptsData : []);
        setStaffAttendance(Array.isArray(attendanceData) ? attendanceData : []);
        setLoading(false);
      } catch (error: any) {
        if (retries > 0 && (error.message === 'Failed to fetch' || error.name === 'TypeError')) {
          console.warn(`Fetch failed in Dashboard, retrying in ${delay}ms... (${retries} retries left)`);
          setTimeout(() => fetchData(retries - 1, delay * 2), delay);
        } else {
          console.error("Error fetching dashboard data:", error);
          setLoading(false);
        }
      }
    };

    fetchData();
  }, [profile]);

  const stats = [
    { label: 'Tổng khách hàng', value: customers.length, icon: Users, color: 'blue' },
    { label: 'Khách hàng mới', value: customers.filter(c => c.createdAt > Date.now() - 30 * 24 * 60 * 60 * 1000).length, icon: TrendingUp, color: 'green' },
    { label: 'Doanh thu tháng này', value: (
      <div className="space-y-1">
        <p className="text-2xl font-bold text-gray-900">
          {formatNumber(receipts.filter(r => {
            const date = new Date(r.date || r.createdAt);
            const now = new Date();
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear() && r.status === 'approved';
          }).reduce((sum, r) => sum + Number(r.amount || 0), 0))}
        </p>
        <div className="flex gap-3 text-[10px] font-bold uppercase text-gray-400">
          <span className="text-blue-500">HP: {formatNumber(receipts.filter(r => {
            const date = new Date(r.date || r.createdAt);
            const now = new Date();
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear() && r.status === 'approved' && r.type !== 'thu khác';
          }).reduce((sum, r) => sum + Number(r.amount || 0), 0))}</span>
          <span className="text-orange-500">Khác: {formatNumber(receipts.filter(r => {
            const date = new Date(r.date || r.createdAt);
            const now = new Date();
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear() && r.status === 'approved' && r.type === 'thu khác';
          }).reduce((sum, r) => sum + Number(r.amount || 0), 0))}</span>
        </div>
      </div>
    ), icon: ArrowUpRight, color: 'emerald' },
    { label: 'Đã chốt', value: customers.filter(c => ['Đã chốt', 'Đã đóng tiền', 'Đã cọc'].includes(c.status)).length, icon: UserCheck, color: 'purple' },
    { label: 'Tổng công nợ', value: (
      <div className="space-y-1">
        <p className="text-2xl font-bold text-red-600">
          {formatNumber(customers
            .filter(c => ['Đã chốt', 'Đã đóng tiền', 'Đã cọc'].includes(c.status))
            .reduce((sum, c) => {
              const total = parseInt(String(c.closedAmount || '0').replace(/\D/g, '')) || 0;
              const collected = receipts
                .filter(r => r.customerId === c.id && r.status === 'approved' && r.type !== 'thu khác')
                .reduce((s, r) => s + Number(r.amount || 0), 0);
              const debt = total - collected;
              // Only count as debt if they have paid something but not everything
              return sum + (debt > 0 && collected > 0 ? debt : 0);
            }, 0))}
        </p>
        <p className="text-[10px] font-bold uppercase text-gray-400">Học phí còn thiếu</p>
      </div>
    ), icon: Wallet, color: 'red' },
  ];

  const statusData = [
    { name: 'Đã đóng tiền', value: customers.filter(c => c.status === 'Đã đóng tiền').length },
    { name: 'Đã cọc', value: customers.filter(c => c.status === 'Đã cọc').length },
    { name: 'Đã chốt', value: customers.filter(c => c.status === 'Đã chốt').length },
    { name: 'Phân vân', value: customers.filter(c => c.status === 'Phân vân').length },
    { name: 'Hẹn lại', value: customers.filter(c => c.status === 'Hẹn lại').length },
    { name: 'Khác', value: customers.filter(c => c.status === 'Khác').length },
  ];

  const COLORS = ['#10b981', '#34d399', '#3b82f6', '#f59e0b', '#8b5cf6', '#94a3b8'];

  const monthlyData = useMemo(() => {
    const last6Months = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      return {
        name: `T${d.getMonth() + 1}`,
        month: d.getMonth(),
        year: d.getFullYear()
      };
    });

    return last6Months.map(m => {
      const count = customers.filter(c => {
        const date = new Date(c.createdAt);
        return date.getMonth() === m.month && date.getFullYear() === m.year;
      }).length;
      return { name: m.name, value: count };
    });
  }, [customers]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tổng quan hệ thống</h1>
        <p className="text-gray-500">Chào mừng trở lại, {profile?.displayName}!</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl bg-${stat.color}-50 flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-5 h-5 md:w-6 md:h-6 text-${stat.color}-600`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs md:text-sm text-gray-500 font-medium truncate">{stat.label}</p>
                {typeof stat.value === 'object' ? stat.value : (
                  <p className="text-xl md:text-2xl font-bold text-gray-900 truncate">{stat.value}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Tỷ lệ trạng thái khách hàng</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            {statusData.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx] }} />
                <span className="text-sm text-gray-600">{item.name}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Khách hàng mới theo tháng</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <Tooltip 
                  cursor={{ fill: '#f9fafb' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {profile?.role === 'admin' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              Chấm công nhân viên hôm nay
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Nhân viên</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Giờ vào</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Giờ ra</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staffAttendance.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500 italic">
                      Chưa có nhân viên nào chấm công hôm nay
                    </td>
                  </tr>
                ) : (
                  staffAttendance.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-bold text-xs">
                              {record.staffName && record.staffName !== '0' ? record.staffName.charAt(0) : '?'}
                            </span>
                          </div>
                          <div>
                            <span className="font-bold text-gray-900">
                              {record.staffName === '0' ? 'Chưa đặt tên' : record.staffName}
                            </span>
                            {record.isEdited && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Đã chỉnh sửa</span>
                                {record.adminNote && (
                                  <div className="group relative">
                                    <Info className="w-3 h-3 text-amber-500 cursor-help" />
                                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-[10px] rounded shadow-xl z-50">
                                      {record.adminNote}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {format(record.checkInTime, 'HH:mm')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {record.checkOutTime ? format(record.checkOutTime, 'HH:mm') : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          record.status === 'completed' ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                        )}>
                          {record.status === 'completed' ? 'Hoàn thành' : 'Đang làm'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
