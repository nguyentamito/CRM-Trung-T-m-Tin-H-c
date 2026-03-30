import React, { useState, useEffect, useCallback } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  User, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Calendar as CalendarIcon,
  LayoutGrid,
  List,
  Search,
  Filter,
  Edit2,
  Trash2
} from 'lucide-react';
import { collection, query, onSnapshot, where, addDoc, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Appointment, Customer, UserProfile, AppointmentStatus } from '../types';
import { cn, formatDate } from '../lib/utils';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday
} from 'date-fns';
import { vi } from 'date-fns/locale';

interface AppointmentCalendarProps {
  profile: UserProfile | null;
}

export default function AppointmentCalendar({ profile }: AppointmentCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [viewMode, setViewMode] = useState<'calendar' | 'table'>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    customerId: '',
    time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    content: '',
    status: 'chưa diễn ra' as AppointmentStatus
  });

  const fetchData = useCallback(async () => {
    if (!profile) return;
    try {
      const staffIdParam = profile.role === 'admin' ? '' : `?staffId=${profile.uid}`;
      const ownerIdParam = profile.role === 'admin' ? '' : `?ownerId=${profile.uid}`;

      const [appointmentsRes, customersRes] = await Promise.all([
        fetch(`/api/appointments${staffIdParam}`),
        fetch(`/api/customers${ownerIdParam}`)
      ]);

      const [appointmentsData, customersData] = await Promise.all([
        appointmentsRes.json(),
        customersRes.json()
      ]);

      setAppointments(Array.isArray(appointmentsData) ? appointmentsData : []);
      setCustomers(Array.isArray(customersData) ? customersData : []);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }, [profile]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Effect to automatically update status for past appointments
  useEffect(() => {
    const checkPastAppointments = async () => {
      const now = Date.now();
      const pastAppointments = appointments.filter(app => 
        app.time < now && app.status === 'chưa diễn ra'
      );

      for (const app of pastAppointments) {
        try {
          await fetch(`/api/appointments/${app.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'khách không đến',
              updatedAt: Date.now()
            })
          });
        } catch (err) {
          console.error('Error updating past appointment status:', err);
        }
      }
    };

    const intervalId = setInterval(checkPastAppointments, 60000);
    checkPastAppointments();

    return () => clearInterval(intervalId);
  }, [appointments]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    const customer = customers.find(c => String(c.id) === String(formData.customerId));
    if (!customer) return;

    const data = {
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      time: new Date(formData.time).getTime(),
      content: formData.content,
      status: formData.status,
      staffId: profile.uid,
      updatedAt: Date.now()
    };

    try {
      if (selectedAppointment) {
        await fetch(`/api/appointments/${selectedAppointment.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } else {
        await fetch('/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            createdAt: Date.now()
          })
        });
      }
      setIsModalOpen(false);
      setSelectedAppointment(null);
      fetchData();
    } catch (err) {
      console.error("Error submitting appointment:", err);
    }
  };

  const updateStatus = async (id: string, status: AppointmentStatus) => {
    try {
      await fetch(`/api/appointments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, updatedAt: Date.now() })
      });
      fetchData();
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa lịch hẹn này?')) return;
    try {
      await fetch(`/api/appointments/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      console.error("Error deleting appointment:", err);
    }
  };

  const filteredAppointments = appointments
    .filter(app => {
      const matchesSearch = app.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           app.content.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || app.status === filterStatus;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const now = Date.now();
      const diffA = Math.abs(a.time - now);
      const diffB = Math.abs(b.time - now);
      return diffA - diffB;
    });

  const getStatusBadge = (status: AppointmentStatus) => {
    const base = "px-3 py-1 rounded-full text-xs font-medium inline-flex items-center justify-center min-w-[100px]";
    switch (status) {
      case 'chưa diễn ra': return <span className={cn(base, "bg-blue-100 text-blue-700 border border-blue-200")}>Chưa diễn ra</span>;
      case 'đã diễn ra': return <span className={cn(base, "bg-green-100 text-green-700 border border-green-200")}>Đã diễn ra</span>;
      case 'khách không đến': return <span className={cn(base, "bg-gray-100 text-gray-700 border border-gray-200")}>Khách không đến</span>;
      case 'hoãn': return <span className={cn(base, "bg-orange-100 text-orange-700 border border-orange-200")}>Hoãn</span>;
      case 'hủy': return <span className={cn(base, "bg-red-100 text-red-700 border border-red-200")}>Hủy</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lịch hẹn khách hàng</h1>
          <p className="text-gray-500">Theo dõi và quản lý các cuộc hẹn sắp tới</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded-xl border border-gray-200 flex shadow-sm">
            <button
              onClick={() => setViewMode('calendar')}
              className={cn(
                "p-2 rounded-lg transition-all flex items-center gap-2 text-sm font-medium",
                viewMode === 'calendar' ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-50"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
              Lịch
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                "p-2 rounded-lg transition-all flex items-center gap-2 text-sm font-medium",
                viewMode === 'table' ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:bg-gray-50"
              )}
            >
              <List className="w-4 h-4" />
              Danh sách
            </button>
          </div>
          <button
            onClick={() => {
              setSelectedAppointment(null);
              setFormData({
                customerId: '',
                time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
                content: '',
                status: 'chưa diễn ra'
              });
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-sm font-medium"
          >
            <Plus className="w-5 h-5" />
            Tạo lịch hẹn mới
          </button>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 capitalize">
                {format(currentDate, 'MMMM yyyy', { locale: vi })}
              </h2>
              <div className="flex gap-2">
                <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-2 hover:bg-gray-100 rounded-lg transition-all">
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <button onClick={() => setCurrentDate(new Date())} className="px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                  Hôm nay
                </button>
                <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-2 hover:bg-gray-100 rounded-lg transition-all">
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 border-b border-gray-100">
              {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(day => (
                <div key={day} className="py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {calendarDays.map((day, idx) => {
                const dayAppointments = appointments.filter(a => isSameDay(new Date(a.time), day));
                const isCurrentMonth = isSameMonth(day, monthStart);
                
                return (
                  <div 
                    key={idx} 
                    className={cn(
                      "min-h-[100px] p-2 border-b border-r border-gray-50 transition-all",
                      !isCurrentMonth && "bg-gray-50/50 opacity-40"
                    )}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={cn(
                        "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                        isToday(day) ? "bg-blue-600 text-white" : "text-gray-700"
                      )}>
                        {format(day, 'd')}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {dayAppointments.slice(0, 3).map(app => (
                        <button
                          key={app.id}
                          onClick={() => {
                            setSelectedAppointment(app);
                            setFormData({
                              customerId: app.customerId,
                              time: format(new Date(app.time), "yyyy-MM-dd'T'HH:mm"),
                              content: app.content,
                              status: app.status
                            });
                            setIsModalOpen(true);
                          }}
                          className={cn(
                            "w-full text-left text-[10px] px-1.5 py-1 rounded truncate transition-all",
                            app.status === 'chưa diễn ra' && "bg-blue-50 text-blue-700 border-l-2 border-blue-500",
                            app.status === 'đã diễn ra' && "bg-green-50 text-green-700 border-l-2 border-green-500",
                            app.status === 'hoãn' && "bg-orange-50 text-orange-700 border-l-2 border-orange-500",
                            app.status === 'hủy' && "bg-red-50 text-red-700 border-l-2 border-red-500"
                          )}
                        >
                          {format(new Date(app.time), 'HH:mm')} {app.customerName}
                        </button>
                      ))}
                      {dayAppointments.length > 3 && (
                        <div className="text-[10px] text-gray-400 text-center">+{dayAppointments.length - 3} lịch nữa</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-600" />
                Sắp diễn ra
              </h3>
              <div className="space-y-4">
                {appointments
                  .filter(a => a.time > Date.now() && a.status === 'chưa diễn ra')
                  .sort((a, b) => a.time - b.time)
                  .slice(0, 5)
                  .map(app => (
                    <div key={app.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 group hover:border-blue-200 transition-all">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-blue-600">{formatDate(app.time)}</span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => updateStatus(app.id, 'đã diễn ra')} className="p-1 text-green-600 hover:bg-green-100 rounded"><CheckCircle2 className="w-4 h-4" /></button>
                          <button onClick={() => updateStatus(app.id, 'hủy')} className="p-1 text-red-600 hover:bg-red-100 rounded"><XCircle className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-gray-900 mb-1">{app.customerName}</p>
                      <p className="text-xs text-gray-500 line-clamp-2">{app.content}</p>
                    </div>
                  ))}
                {appointments.filter(a => a.time > Date.now() && a.status === 'chưa diễn ra').length === 0 && (
                  <div className="text-center py-8">
                    <CalendarIcon className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Không có lịch hẹn sắp tới</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Tìm kiếm theo tên khách hàng hoặc nội dung..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="chưa diễn ra">Chưa diễn ra</option>
                <option value="đã diễn ra">Đã diễn ra</option>
                <option value="khách không đến">Khách không đến</option>
                <option value="hoãn">Hoãn</option>
                <option value="hủy">Hủy</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#2D5A4C] border-b border-[#2D5A4C]">
                    <th className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider border-r border-[#3D6A5C]">Thời gian</th>
                    <th className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider border-r border-[#3D6A5C]">Khách hàng</th>
                    <th className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider border-r border-[#3D6A5C]">SĐT</th>
                    <th className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider border-r border-[#3D6A5C]">Nội dung</th>
                    <th className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider border-r border-[#3D6A5C]">Trạng thái</th>
                    <th className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAppointments.map((app) => (
                    <tr 
                      key={app.id} 
                      className={cn(
                        "hover:bg-gray-50/50 transition-all border-b border-gray-100",
                        isToday(new Date(app.time)) && "bg-blue-50 hover:bg-blue-100"
                      )}
                    >
                      <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-100">
                        {formatDate(app.time)}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-100">
                        {app.customerName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-100">
                        {app.customerPhone}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-100 max-w-md truncate">
                        {app.content}
                      </td>
                      <td className="px-4 py-3 border-r border-gray-100">
                        {getStatusBadge(app.status)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button 
                            onClick={() => {
                              setSelectedAppointment(app);
                              setFormData({
                                customerId: app.customerId,
                                time: format(new Date(app.time), "yyyy-MM-dd'T'HH:mm"),
                                content: app.content,
                                status: app.status
                              });
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Chỉnh sửa"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(app.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Xóa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredAppointments.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                        Không tìm thấy lịch hẹn nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Lịch hẹn */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{selectedAppointment ? 'Chi tiết lịch hẹn' : 'Tạo lịch hẹn mới'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Khách hàng</label>
                <select
                  required
                  value={formData.customerId}
                  onChange={(e) => setFormData({...formData, customerId: e.target.value})}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Chọn khách hàng</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Thời gian</label>
                  <input
                    required
                    type="datetime-local"
                    value={formData.time}
                    onChange={(e) => setFormData({...formData, time: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Trạng thái</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as AppointmentStatus})}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="chưa diễn ra">Chưa diễn ra</option>
                    <option value="đã diễn ra">Đã diễn ra</option>
                    <option value="khách không đến">Khách không đến</option>
                    <option value="hoãn">Hoãn</option>
                    <option value="hủy">Hủy</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Nội dung cuộc hẹn</label>
                <textarea
                  required
                  rows={3}
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  placeholder="Mục đích cuộc hẹn, địa điểm..."
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium shadow-sm"
                >
                  {selectedAppointment ? 'Cập nhật' : 'Lưu lịch hẹn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
