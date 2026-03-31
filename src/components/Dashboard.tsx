import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  UserCheck, 
  Clock, 
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { Customer, Appointment, UserProfile, Receipt } from '../types';
import { formatNumber } from '../lib/utils';
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

interface DashboardProps {
  profile: UserProfile | null;
}

export default function Dashboard({ profile }: DashboardProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    const fetchData = async () => {
      try {
        const staffIdParam = profile.role === 'admin' ? '' : `?staffId=${profile.uid}`;
        const ownerIdParam = profile.role === 'admin' ? '' : `?ownerId=${profile.uid}`;

        const [appointmentsRes, customersRes, receiptsRes] = await Promise.all([
          fetch(`/api/appointments${staffIdParam}`),
          fetch(`/api/customers${ownerIdParam}`),
          fetch(`/api/receipts${staffIdParam}`)
        ]);

        const [appointmentsData, customersData, receiptsData] = await Promise.all([
          appointmentsRes.ok ? appointmentsRes.json() : Promise.resolve([]),
          customersRes.ok ? customersRes.json() : Promise.resolve([]),
          receiptsRes.ok ? receiptsRes.json() : Promise.resolve([])
        ]);

        setAppointments(Array.isArray(appointmentsData) ? appointmentsData : []);
        setCustomers(Array.isArray(customersData) ? customersData : []);
        setReceipts(Array.isArray(receiptsData) ? receiptsData : []);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, [profile]);

  const stats = [
    { label: 'Tổng khách hàng', value: customers.length, icon: Users, color: 'blue' },
    { label: 'Khách hàng mới', value: customers.filter(c => c.createdAt > Date.now() - 30 * 24 * 60 * 60 * 1000).length, icon: TrendingUp, color: 'green' },
    { label: 'Doanh thu tháng này', value: formatNumber(receipts.filter(r => {
      const date = new Date(r.date || r.createdAt);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear() && r.status === 'approved';
    }).reduce((sum, r) => sum + Number(r.amount || 0), 0)), icon: ArrowUpRight, color: 'emerald' },
    { label: 'Đã chốt', value: customers.filter(c => ['Đã chốt', 'Đã đóng tiền', 'Đã cọc'].includes(c.status)).length, icon: UserCheck, color: 'purple' },
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl bg-${stat.color}-50 flex items-center justify-center`}>
                <Icon className={`w-6 h-6 text-${stat.color}-600`} />
              </div>
              <div>
                <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
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
    </div>
  );
}
