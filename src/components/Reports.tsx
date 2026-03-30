import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  Calendar, Users, Target, CheckCircle, TrendingUp, Filter, Download,
  UserCheck, XCircle, Clock, DollarSign, ArrowUpRight, ArrowDownRight,
  GraduationCap, AlertCircle
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval, parseISO, startOfDay, endOfDay, eachMonthOfInterval, startOfYear, endOfYear } from 'date-fns';
import { Customer, Appointment, UserProfile, Receipt, PaymentVoucher, TeachingSession, Attendance } from '../types';
import { formatNumber, cn } from '../lib/utils';

interface ReportsProps {
  customers: Customer[];
  appointments: Appointment[];
  staff: UserProfile[];
  receipts: Receipt[];
  paymentVouchers: PaymentVoucher[];
  teachingSessions: TeachingSession[];
  attendance: Attendance[];
}

const COLORS = ['#2D5A4C', '#4ade80', '#fbbf24', '#f87171', '#818cf8'];

export default function Reports({ 
  customers, 
  appointments, 
  staff, 
  receipts, 
  paymentVouchers, 
  teachingSessions,
  attendance
}: ReportsProps) {
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');

  const filteredData = useMemo(() => {
    const start = startOfDay(parseISO(dateRange.start)).getTime();
    const end = endOfDay(parseISO(dateRange.end)).getTime();

    const filteredCustomers = customers.filter(c => {
      const inRange = c.createdAt >= start && c.createdAt <= end;
      const matchesStaff = selectedStaffId === 'all' || c.ownerId === selectedStaffId;
      return inRange && matchesStaff;
    });

    const filteredAppointments = appointments.filter(a => {
      const inRange = a.time >= start && a.time <= end;
      const matchesStaff = selectedStaffId === 'all' || a.staffId === selectedStaffId;
      return inRange && matchesStaff;
    });

    const filteredReceipts = receipts.filter(r => {
      const inRange = r.date >= start && r.date <= end;
      const matchesStaff = selectedStaffId === 'all' || r.staffId === selectedStaffId;
      const isApproved = r.status === 'approved';
      return inRange && matchesStaff && isApproved;
    });

    const filteredVouchers = paymentVouchers.filter(v => {
      const inRange = v.date >= start && v.date <= end;
      const matchesStaff = selectedStaffId === 'all' || v.staffId === selectedStaffId;
      const isApproved = v.status === 'approved';
      return inRange && matchesStaff && isApproved;
    });

    const filteredSessions = teachingSessions.filter(s => {
      const inRange = s.date >= start && s.date <= end;
      return inRange;
    });

    const filteredAttendance = attendance.filter(a => {
      const session = teachingSessions.find(s => String(s.id) === String(a.sessionId));
      if (!session) return false;
      return session.date >= start && session.date <= end;
    });

    return { 
      customers: filteredCustomers, 
      appointments: filteredAppointments,
      receipts: filteredReceipts,
      vouchers: filteredVouchers,
      sessions: filteredSessions,
      attendance: filteredAttendance
    };
  }, [customers, appointments, receipts, paymentVouchers, teachingSessions, attendance, dateRange, selectedStaffId]);

  // Financial Stats
  const financialStats = useMemo(() => {
    const income = Math.round(filteredData.receipts.reduce((sum, r) => sum + Number(r.amount || 0), 0));
    const expense = Math.round(filteredData.vouchers.reduce((sum, v) => sum + Number(v.amount || 0), 0));
    const profit = income - expense;

    // Income by Subject
    const incomeBySubjectMap: Record<string, number> = {};
    filteredData.receipts.forEach(r => {
      const amount = Number(r.amount || 0);
      incomeBySubjectMap[r.subject] = (incomeBySubjectMap[r.subject] || 0) + amount;
    });
    const incomeBySubject = Object.entries(incomeBySubjectMap).map(([name, value]) => ({ name, value }));

    // Expense by Category
    const expenseByCategoryMap: Record<string, number> = {};
    filteredData.vouchers.forEach(v => {
      const amount = Number(v.amount || 0);
      expenseByCategoryMap[v.category] = (expenseByCategoryMap[v.category] || 0) + amount;
    });
    const expenseByCategory = Object.entries(expenseByCategoryMap).map(([name, value]) => ({ name, value }));

    return { income, expense, profit, incomeBySubject, expenseByCategory };
  }, [filteredData.receipts, filteredData.vouchers]);

  // Financial Trend Data
  const financialTrendData = useMemo(() => {
    const days = eachDayOfInterval({
      start: parseISO(dateRange.start),
      end: parseISO(dateRange.end)
    });

    return days.map(day => {
      const dateStr = format(day, 'dd/MM');
      const dayStart = startOfDay(day).getTime();
      const dayEnd = endOfDay(day).getTime();

      const dayIncome = filteredData.receipts
        .filter(r => r.date >= dayStart && r.date <= dayEnd)
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);
      
      const dayExpense = filteredData.vouchers
        .filter(v => v.date >= dayStart && v.date <= dayEnd)
        .reduce((sum, v) => sum + Number(v.amount || 0), 0);

      return { name: dateStr, thu: dayIncome, chi: dayExpense };
    });
  }, [filteredData.receipts, filteredData.vouchers, dateRange]);

  // Acquisition Trend Data
  const acquisitionTrendData = useMemo(() => {
    const days = eachDayOfInterval({
      start: parseISO(dateRange.start),
      end: parseISO(dateRange.end)
    });

    return days.map(day => {
      const dateStr = format(day, 'dd/MM');
      const count = filteredData.customers.filter(c => 
        format(new Date(c.createdAt), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
      ).length;
      return { name: dateStr, count };
    });
  }, [filteredData.customers, dateRange]);

  // Conversion Stats
  const conversionStats = useMemo(() => {
    const total = filteredData.customers.length;
    const closedStatuses = ['Đã chốt', 'Đã đóng tiền', 'Đã cọc'];
    const closed = filteredData.customers.filter(c => closedStatuses.includes(c.status));
    const closedCount = closed.length;
    const rate = total > 0 ? (closedCount / total) * 100 : 0;
    const totalValue = closed.reduce((sum, c) => {
      const val = parseInt(String(c.closedAmount || '0').replace(/\D/g, '')) || 0;
      return sum + val;
    }, 0);

    const statusData = [
      { name: 'Đã chốt/Đóng tiền', value: closedCount },
      { name: 'Khác', value: total - closedCount }
    ];

    return { total, closedCount, rate, statusData, totalValue };
  }, [filteredData.customers]);

  // Appointment Stats
  const appointmentStats = useMemo(() => {
    const total = filteredData.appointments.length;
    const completed = filteredData.appointments.filter(a => a.status === 'đã diễn ra').length;
    const rate = total > 0 ? (completed / total) * 100 : 0;

    const statusData = [
      { name: 'Đã diễn ra', value: completed },
      { name: 'Hoãn/Hủy/Chưa', value: total - completed }
    ];

    return { total, completed, rate, statusData };
  }, [filteredData.appointments]);

  // Attendance Stats (Teachers & TAs)
  const attendanceStats = useMemo(() => {
    const teacherClassPairs = Array.from(new Set(filteredData.sessions.map(s => `${s.teacherId}|${s.classId}`).filter(p => !p.startsWith('|'))));
    const taClassPairs = Array.from(new Set(filteredData.sessions.map(s => `${s.taId}|${s.classId}`).filter(p => !p.startsWith('|'))));

    const isSessionMarked = (sessionId: string) => {
      return filteredData.attendance.some(a => String(a.sessionId) === String(sessionId));
    };

    const teachers = teacherClassPairs.map(pair => {
      const [tid, cid] = pair.split('|');
      const sessions = filteredData.sessions.filter(s => s.teacherId === tid && s.classId === cid);
      const name = sessions[0]?.teacherName || 'Unknown';
      const className = sessions[0]?.className || 'Unknown';
      
      const completed = sessions.filter(s => {
        const isStatusCompleted = s.status === 'hoàn thành' || s.status === 'đang học' || s.status === 'kết thúc';
        return isStatusCompleted && isSessionMarked(s.id);
      }).length;

      const cancelled = sessions.filter(s => s.status === 'hủy').length;
      const pending = sessions.filter(s => s.status === 'chưa diễn ra' || (s.status === 'hoàn thành' && !isSessionMarked(s.id))).length;
      
      return { id: `${tid}-${cid}`, name, className, role: 'Giáo viên', completed, cancelled, pending, total: sessions.length };
    });

    const tas = taClassPairs.map(pair => {
      const [taid, cid] = pair.split('|');
      const sessions = filteredData.sessions.filter(s => s.taId === taid && s.classId === cid);
      const name = sessions[0]?.taName || 'Unknown';
      const className = sessions[0]?.className || 'Unknown';
      
      const completed = sessions.filter(s => {
        const isStatusCompleted = s.status === 'hoàn thành' || s.status === 'đang học' || s.status === 'kết thúc';
        return isStatusCompleted && isSessionMarked(s.id);
      }).length;

      const cancelled = sessions.filter(s => s.status === 'hủy').length;
      const pending = sessions.filter(s => s.status === 'chưa diễn ra' || (s.status === 'hoàn thành' && !isSessionMarked(s.id))).length;
      
      return { id: `${taid}-${cid}`, name, className, role: 'Trợ giảng', completed, cancelled, pending, total: sessions.length };
    });

    return [...teachers, ...tas].sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredData.sessions, filteredData.attendance]);

  // Student Learning Stats
  const studentStats = useMemo(() => {
    const studentMap: Record<string, { 
      id: string; 
      name: string; 
      total: number; 
      present: number; 
      absent: number; 
      late: number; 
      excused: number;
      classes: string[];
    }> = {};

    filteredData.attendance.forEach(a => {
      if (!studentMap[a.studentId]) {
        studentMap[a.studentId] = {
          id: a.studentId,
          name: a.studentName,
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          classes: []
        };
      }

      const stats = studentMap[a.studentId];
      stats.total++;
      if (a.status === 'có mặt') stats.present++;
      else if (a.status === 'vắng mặt') stats.absent++;
      else if (a.status === 'muộn') stats.late++;
      else if (a.status === 'phép') stats.excused++;

      const session = teachingSessions.find(s => String(s.id) === String(a.sessionId));
      if (session && !stats.classes.includes(session.className)) {
        stats.classes.push(session.className);
      }
    });

    return Object.values(studentMap).map(s => {
      const attendanceRate = s.total > 0 ? ((s.present + s.late) / s.total) * 100 : 0;
      const missedCount = s.absent + s.excused;
      const isWarning = attendanceRate < 80 || missedCount >= 3;
      return { ...s, attendanceRate, missedCount, isWarning };
    }).sort((a, b) => a.attendanceRate - b.attendanceRate);
  }, [filteredData.attendance, teachingSessions]);

  return (
    <div className="space-y-8 pb-20">
      {/* Filters */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-2">
            <Calendar className="w-3 h-3" /> Từ ngày
          </label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-2">
            <Calendar className="w-3 h-3" /> Đến ngày
          </label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-2">
            <Users className="w-3 h-3" /> Nhân viên kinh doanh
          </label>
          <select
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
            className="w-full px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20"
          >
            <option value="all">Tất cả nhân viên</option>
            {staff.map(s => (
              <option key={s.uid} value={s.uid}>{s.displayName}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-50 text-green-600 rounded-xl">
              <ArrowUpRight className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Tổng Thu</p>
              <h4 className="text-2xl font-bold text-green-600">{formatNumber(financialStats.income)} VNĐ</h4>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-50 text-red-600 rounded-xl">
              <ArrowDownRight className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Tổng Chi</p>
              <h4 className="text-2xl font-bold text-red-600">{formatNumber(financialStats.expense)} VNĐ</h4>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Lợi nhuận</p>
              <h4 className={cn("text-2xl font-bold", financialStats.profit >= 0 ? "text-blue-600" : "text-red-600")}>
                {formatNumber(financialStats.profit)} VNĐ
              </h4>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Trend Chart */}
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Biểu đồ Thu - Chi</h3>
              <p className="text-sm text-gray-500">So sánh dòng tiền theo thời gian</p>
            </div>
            <DollarSign className="w-6 h-6 text-blue-600" />
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={financialTrendData}>
                <defs>
                  <linearGradient id="colorThu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorChi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <Tooltip 
                  formatter={(value: number) => formatNumber(value) + ' VNĐ'}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend verticalAlign="top" align="right" height={36}/>
                <Area 
                  type="monotone" 
                  dataKey="thu" 
                  name="Thu"
                  stroke="#10b981" 
                  fillOpacity={1} 
                  fill="url(#colorThu)" 
                  strokeWidth={3}
                />
                <Area 
                  type="monotone" 
                  dataKey="chi" 
                  name="Chi"
                  stroke="#ef4444" 
                  fillOpacity={1} 
                  fill="url(#colorChi)" 
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Financial Pie Charts */}
        <div className="space-y-8">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Cơ cấu doanh thu</h3>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={financialStats.incomeBySubject}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {financialStats.incomeBySubject.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatNumber(value) + ' VNĐ'} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {financialStats.incomeBySubject.slice(0, 3).map((item, index) => (
                <div key={item.name} className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-gray-500 truncate max-w-[120px]">{item.name}</span>
                  </div>
                  <span className="font-bold text-gray-900">{((item.value / financialStats.income) * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Cơ cấu chi phí</h3>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={financialStats.expenseByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {financialStats.expenseByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatNumber(value) + ' VNĐ'} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {financialStats.expenseByCategory.slice(0, 3).map((item, index) => (
                <div key={item.name} className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[(index + 2) % COLORS.length] }} />
                    <span className="text-gray-500 truncate max-w-[120px]">{item.name}</span>
                  </div>
                  <span className="font-bold text-gray-900">{((item.value / financialStats.expense) * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CRM Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Khách hàng mới</p>
              <h4 className="text-2xl font-bold text-gray-900">{conversionStats.total}</h4>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-50 text-green-600 rounded-xl">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Doanh số (Chốt)</p>
              <h4 className="text-2xl font-bold text-green-600">{formatNumber(conversionStats.totalValue)}</h4>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Tổng lịch hẹn</p>
              <h4 className="text-2xl font-bold text-gray-900">{appointmentStats.total}</h4>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-50 text-yellow-600 rounded-xl">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Tỉ lệ thành công</p>
              <h4 className="text-2xl font-bold text-gray-900">{appointmentStats.rate.toFixed(1)}%</h4>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Acquisition Trend */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Xu hướng khách hàng mới</h3>
              <p className="text-sm text-gray-500">Số lượng khách hàng đăng ký theo thời gian</p>
            </div>
            <TrendingUp className="w-6 h-6 text-[#2D5A4C]" />
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={acquisitionTrendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#2D5A4C" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#2D5A4C', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Conversion & Appointment Pie Charts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
            <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">Tỉ lệ chốt đơn</h3>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={conversionStats.statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {conversionStats.statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 text-center">
              <span className="text-3xl font-bold text-[#2D5A4C]">{conversionStats.rate.toFixed(1)}%</span>
              <p className="text-xs text-gray-400 uppercase font-bold mt-1">Conversion Rate</p>
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
            <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">Tỉ lệ lịch hẹn</h3>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={appointmentStats.statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {appointmentStats.statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 text-center">
              <span className="text-3xl font-bold text-yellow-600">{appointmentStats.rate.toFixed(1)}%</span>
              <p className="text-xs text-gray-400 uppercase font-bold mt-1">Success Rate</p>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Báo cáo điểm danh Giáo viên & Trợ giảng</h3>
            <p className="text-sm text-gray-500">Thống kê số buổi dạy chi tiết theo từng lớp</p>
          </div>
          <GraduationCap className="w-6 h-6 text-red-600" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Họ tên</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Vai trò</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Lớp học</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Tổng buổi</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Hoàn thành</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Chưa diễn ra</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Hủy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {attendanceStats.map(t => (
                <tr key={t.id} className="hover:bg-gray-50/30 transition-colors">
                  <td className="px-8 py-4 font-bold text-gray-900">{t.name}</td>
                  <td className="px-8 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                      t.role === 'Giáo viên' ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
                    )}>
                      {t.role}
                    </span>
                  </td>
                  <td className="px-8 py-4 font-medium text-gray-600">{t.className}</td>
                  <td className="px-8 py-4 text-center font-medium text-gray-600">{t.total}</td>
                  <td className="px-8 py-4 text-center font-bold text-green-600">{t.completed}</td>
                  <td className="px-8 py-4 text-center font-medium text-blue-600">{t.pending}</td>
                  <td className="px-8 py-4 text-center font-medium text-red-600">{t.cancelled}</td>
                </tr>
              ))}
              {attendanceStats.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-8 py-12 text-center text-gray-500">
                    Không có dữ liệu giảng dạy trong khoảng thời gian này
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>


      {/* Student Learning Report */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Báo cáo tình hình học tập học viên</h3>
            <p className="text-sm text-gray-500">Thống kê chuyên cần và cảnh báo nghỉ học nhiều</p>
          </div>
          <UserCheck className="w-6 h-6 text-orange-500" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Học viên</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Lớp học</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Tổng buổi</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Có mặt</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Vắng/Phép</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Tỉ lệ chuyên cần</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {studentStats.map(s => (
                <tr key={s.id} className={cn("hover:bg-gray-50/30 transition-colors", s.isWarning ? "bg-red-50/30" : "")}>
                  <td className="px-8 py-4">
                    <div className="font-bold text-gray-900">{s.name}</div>
                  </td>
                  <td className="px-8 py-4">
                    <div className="text-xs text-gray-500 max-w-[200px] truncate">
                      {s.classes.join(', ')}
                    </div>
                  </td>
                  <td className="px-8 py-4 text-center font-medium text-gray-600">{s.total}</td>
                  <td className="px-8 py-4 text-center font-bold text-green-600">{s.present + s.late}</td>
                  <td className="px-8 py-4 text-center font-bold text-red-600">{s.missedCount}</td>
                  <td className="px-8 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full", s.attendanceRate >= 80 ? "bg-green-500" : "bg-red-500")}
                          style={{ width: `${s.attendanceRate}%` }}
                        />
                      </div>
                      <span className={cn("text-sm font-bold", s.attendanceRate >= 80 ? "text-green-600" : "text-red-600")}>
                        {s.attendanceRate.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-4 text-center">
                    {s.isWarning ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-600 text-[10px] font-bold uppercase">
                        <AlertCircle className="w-3 h-3" /> Cảnh báo nghỉ nhiều
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-600 text-[10px] font-bold uppercase">
                        <CheckCircle className="w-3 h-3" /> Ổn định
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {studentStats.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-8 py-12 text-center text-gray-500">
                    Không có dữ liệu điểm danh học viên trong khoảng thời gian này
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Staff Performance Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-8 border-b border-gray-50 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Hiệu suất nhân viên kinh doanh</h3>
            <p className="text-sm text-gray-500">Thống kê hiệu suất làm việc của đội ngũ</p>
          </div>
          <button className="p-2 text-gray-400 hover:text-[#2D5A4C] transition-colors">
            <Download className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Nhân viên</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Khách mới</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Đã chốt</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Doanh số</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Thực thu</th>
                <th className="px-8 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Lịch hẹn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {staff.map(s => {
                const start = startOfDay(parseISO(dateRange.start)).getTime();
                const end = endOfDay(parseISO(dateRange.end)).getTime();

                // Leads created in period
                const staffCustomers = customers.filter(c => c.ownerId === s.uid && c.createdAt >= start && c.createdAt <= end);
                
                // Revenue collected in period
                const staffReceiptsInPeriod = receipts.filter(r => r.staffId === s.uid && r.date >= start && r.date <= end && r.status === 'approved');
                const staffIncome = staffReceiptsInPeriod.reduce((sum, r) => sum + Number(r.amount || 0), 0);

                // Deals closed in period (based on first receipt date)
                // A deal is "closed" in this period if the customer's FIRST receipt for a subject was in this period
                const staffClosedDeals = receipts.filter(r => {
                  if (r.staffId !== s.uid || r.status === 'rejected') return false;
                  if (r.date < start || r.date > end) return false;
                  
                  // Check if this is the first receipt for this customer + subject
                  const previousReceipts = receipts.filter(prev => 
                    prev.customerId === r.customerId && 
                    prev.subject === r.subject && 
                    prev.date < r.date &&
                    prev.status !== 'rejected'
                  );
                  return previousReceipts.length === 0;
                });

                const staffClosedCount = staffClosedDeals.length;
                const staffSales = staffClosedDeals.reduce((sum, r) => sum + Number(r.totalAmount || 0), 0);
                const staffRate = staffCustomers.length > 0 ? (staffClosedCount / staffCustomers.length) * 100 : 0;

                const staffAppointments = appointments.filter(a => a.staffId === s.uid && a.time >= start && a.time <= end).length;

                return (
                  <tr key={s.uid} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#2D5A4C]/10 flex items-center justify-center text-[#2D5A4C] font-bold text-xs">
                          {s.displayName.charAt(0)}
                        </div>
                        <span className="font-bold text-gray-900">{s.displayName}</span>
                      </div>
                    </td>
                    <td className="px-8 py-4 text-center font-medium text-gray-600">{staffCustomers.length}</td>
                    <td className="px-8 py-4 text-center font-medium text-green-600">
                      {staffClosedCount}
                      <span className="ml-1 text-[10px] text-gray-400">({staffRate.toFixed(0)}%)</span>
                    </td>
                    <td className="px-8 py-4 text-center font-bold text-gray-900">{formatNumber(staffSales)}</td>
                    <td className="px-8 py-4 text-center font-bold text-green-600">{formatNumber(staffIncome)}</td>
                    <td className="px-8 py-4 text-center font-medium text-blue-600">{staffAppointments}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
