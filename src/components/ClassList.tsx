import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  orderBy 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Class, Teacher, TeachingAssistant, Customer, Subject, UserProfile, TeachingSession } from '../types';
import { 
  ChevronLeft,
  ChevronRight,
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X, 
  Users, 
  Calendar, 
  User, 
  BookOpen, 
  Clock, 
  Filter 
} from 'lucide-react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay } from 'date-fns';
import { vi } from 'date-fns/locale';

interface ClassListProps {
  profile: UserProfile | null;
}

export default function ClassList({ profile }: ClassListProps) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachingSessions, setTeachingSessions] = useState<TeachingSession[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [tas, setTAs] = useState<TeachingAssistant[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewType, setViewType] = useState<'table' | 'calendar'>('table');
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'students'>('list');
  const [studentModalTab, setStudentModalTab] = useState<'list' | 'add'>('list');
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [editingSession, setEditingSession] = useState<TeachingSession | null>(null);
  const [selectedClassForStudents, setSelectedClassForStudents] = useState<Class | null>(null);
  const isAdmin = profile?.role === 'admin';

  const [formData, setFormData] = useState({
    name: '',
    studentIds: [] as string[],
    studentNames: [] as string[],
    subject: '',
    teacherId: '',
    teacherName: '',
    taId: '',
    taName: '',
    schedule: '',
    sessions: [] as { dayOfWeek: number; startTime: string; endTime: string }[],
    startDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'đang học' as Class['status'],
  });

  const [sessionFormData, setSessionFormData] = useState({
    classId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '08:00',
    endTime: '09:30',
    status: 'đang học' as Class['status'],
  });

  useEffect(() => {
    const q = query(collection(db, 'classes'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
    });

    const qTeachers = query(collection(db, 'teachers'), orderBy('name', 'asc'));
    const unsubscribeTeachers = onSnapshot(qTeachers, (snapshot) => {
      setTeachers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teacher)));
    });

    const qTAs = query(collection(db, 'teaching_assistants'), orderBy('name', 'asc'));
    const unsubscribeTAs = onSnapshot(qTAs, (snapshot) => {
      setTAs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeachingAssistant)));
    });

    const qCustomers = query(collection(db, 'customers'), orderBy('name', 'asc'));
    const unsubscribeCustomers = onSnapshot(qCustomers, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    });

    const qSubjects = query(collection(db, 'subjects'), orderBy('name', 'asc'));
    const unsubscribeSubjects = onSnapshot(qSubjects, (snapshot) => {
      setSubjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
    });

    const qSessions = query(collection(db, 'teaching_sessions'), orderBy('date', 'asc'));
    const unsubscribeSessions = onSnapshot(qSessions, (snapshot) => {
      setTeachingSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeachingSession)));
    });

    return () => {
      unsubscribe();
      unsubscribeTeachers();
      unsubscribeTAs();
      unsubscribeCustomers();
      unsubscribeSubjects();
      unsubscribeSessions();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const selectedTeacher = teachers.find(t => t.id === formData.teacherId);
    const selectedTA = tas.find(t => t.id === formData.taId);

    const data = {
      ...formData,
      teacherName: selectedTeacher?.name || '',
      taName: selectedTA?.name || '',
      startDate: new Date(formData.startDate).getTime(),
      sessions: formData.sessions || [],
      updatedAt: Date.now(),
    };

    try {
      if (editingClass) {
        await updateDoc(doc(db, 'classes', editingClass.id), data);
      } else {
        await addDoc(collection(db, 'classes'), {
          ...data,
          createdAt: Date.now(),
        });
      }
      closeModal();
    } catch (error) {
      handleFirestoreError(error, editingClass ? OperationType.UPDATE : OperationType.CREATE, 'classes');
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin || !window.confirm('Bạn có chắc muốn xóa lớp học này?')) return;
    try {
      await deleteDoc(doc(db, 'classes', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `classes/${id}`);
    }
  };

  const handleSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const selectedClass = classes.find(c => c.id === sessionFormData.classId);
    if (!selectedClass) return;

    const data = {
      classId: selectedClass.id,
      className: selectedClass.name,
      subject: selectedClass.subject,
      teacherId: selectedClass.teacherId,
      teacherName: selectedClass.teacherName,
      taId: selectedClass.taId || '',
      taName: selectedClass.taName || '',
      date: new Date(sessionFormData.date).getTime(),
      startTime: sessionFormData.startTime,
      endTime: sessionFormData.endTime,
      status: sessionFormData.status,
      createdAt: Date.now(),
    };

    try {
      if (editingSession) {
        await updateDoc(doc(db, 'teaching_sessions', editingSession.id), data);
      } else {
        await addDoc(collection(db, 'teaching_sessions'), data);
      }
      setIsSessionModalOpen(false);
      setEditingSession(null);
      setSessionFormData({
        classId: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        startTime: '08:00',
        endTime: '09:30',
        status: 'đang học',
      });
    } catch (error) {
      handleFirestoreError(error, editingSession ? OperationType.UPDATE : OperationType.CREATE, 'teaching_sessions');
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'teaching_sessions', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `teaching_sessions/${id}`);
    }
  };

  const openEditSessionModal = (session: TeachingSession) => {
    setEditingSession(session);
    setSessionFormData({
      classId: session.classId,
      date: format(new Date(session.date), 'yyyy-MM-dd'),
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
    });
    setIsSessionModalOpen(true);
  };

  const openEditModal = (cls: Class) => {
    setEditingClass(cls);
    setFormData({
      name: cls.name,
      studentIds: cls.studentIds || [],
      studentNames: cls.studentNames || [],
      subject: cls.subject,
      teacherId: cls.teacherId,
      teacherName: cls.teacherName,
      taId: cls.taId || '',
      taName: cls.taName || '',
      schedule: cls.schedule || '',
      sessions: cls.sessions || [],
      startDate: format(new Date(cls.startDate), 'yyyy-MM-dd'),
      status: cls.status,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingClass(null);
    setFormData({
      name: '',
      studentIds: [],
      studentNames: [],
      subject: '',
      teacherId: '',
      teacherName: '',
      taId: '',
      taName: '',
      schedule: '',
      sessions: [],
      startDate: format(new Date(), 'yyyy-MM-dd'),
      status: 'đang học',
    });
  };

  const toggleStudent = (customer: Customer) => {
    setFormData(prev => {
      const isSelected = prev.studentIds.includes(customer.id);
      if (isSelected) {
        return {
          ...prev,
          studentIds: prev.studentIds.filter(id => id !== customer.id),
          studentNames: prev.studentNames.filter(name => name !== customer.name)
        };
      } else {
        return {
          ...prev,
          studentIds: [...prev.studentIds, customer.id],
          studentNames: [...prev.studentNames, customer.name]
        };
      }
    });
  };

  const openStudentManagement = (cls: Class) => {
    setSelectedClassForStudents(cls);
    setFormData({
      ...formData,
      studentIds: cls.studentIds || [],
      studentNames: cls.studentNames || [],
    });
    setStudentModalTab((cls.studentIds?.length || 0) > 0 ? 'list' : 'add');
    setViewMode('students');
  };

  const closeStudentManagement = () => {
    setViewMode('list');
    setSelectedClassForStudents(null);
    setFormData({
      ...formData,
      studentIds: [],
      studentNames: [],
    });
  };

  const handleUpdateStudents = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !selectedClassForStudents) return;

    try {
      await updateDoc(doc(db, 'classes', selectedClassForStudents.id), {
        studentIds: formData.studentIds,
        studentNames: formData.studentNames,
        updatedAt: Date.now(),
      });
      closeStudentManagement();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `classes/${selectedClassForStudents.id}`);
    }
  };

  const filteredClasses = classes.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.studentNames.some(name => name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      c.teacherName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  if (viewMode === 'students' && selectedClassForStudents) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-4">
          <button 
            onClick={closeStudentManagement}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Quản lý học viên</h2>
            <p className="text-gray-500">Lớp: <span className="font-bold text-[#2D5A4C]">{selectedClassForStudents.name}</span></p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-[#2D5A4C] text-white">
            <div className="flex bg-white/10 p-1 rounded-lg max-w-md">
              <button
                onClick={() => setStudentModalTab('list')}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                  studentModalTab === 'list' ? 'bg-white text-[#2D5A4C] shadow-sm' : 'text-white hover:bg-white/10'
                }`}
              >
                Danh sách học viên ({formData.studentIds.length})
              </button>
              <button
                onClick={() => setStudentModalTab('add')}
                className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                  studentModalTab === 'add' ? 'bg-white text-[#2D5A4C] shadow-sm' : 'text-white hover:bg-white/10'
                }`}
              >
                Thêm học viên mới
              </button>
            </div>
          </div>
          
          <form onSubmit={handleUpdateStudents} className="p-6">
            <div className="space-y-6">
              {studentModalTab === 'add' ? (
                <div className="space-y-4">
                  <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm học viên để thêm vào lớp..."
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                      onChange={(e) => {
                        const term = e.target.value.toLowerCase();
                        const labels = e.currentTarget.parentElement?.nextElementSibling?.querySelectorAll('label');
                        labels?.forEach(label => {
                          const text = label.textContent?.toLowerCase() || '';
                          (label as HTMLElement).style.display = text.includes(term) ? 'flex' : 'none';
                        });
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto p-1">
                    {customers.length > 0 ? (
                      customers.map(customer => (
                        <label key={customer.id} className={`flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all ${
                          formData.studentIds.includes(customer.id) 
                            ? 'border-[#2D5A4C] bg-[#2D5A4C]/5 ring-1 ring-[#2D5A4C]' 
                            : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'
                        }`}>
                          <input
                            type="checkbox"
                            checked={formData.studentIds.includes(customer.id)}
                            onChange={() => toggleStudent(customer)}
                            className="w-5 h-5 rounded border-gray-300 text-[#2D5A4C] focus:ring-[#2D5A4C]"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-bold text-gray-900 truncate">{customer.name}</span>
                            <span className="text-xs text-gray-500">{customer.phone}</span>
                          </div>
                        </label>
                      ))
                    ) : (
                      <div className="col-span-full py-12 text-center">
                        <Users className="w-12 h-12 text-gray-200 mx-auto mb-2" />
                        <p className="text-gray-400 italic">Chưa có dữ liệu khách hàng</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  {formData.studentIds.length > 0 ? (
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Học viên</th>
                          <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Số điện thoại</th>
                          <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {formData.studentIds.map((id, index) => {
                          const name = formData.studentNames[index];
                          const customer = customers.find(c => c.id === id);
                          return (
                            <tr key={id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-[#2D5A4C]/10 rounded-full flex items-center justify-center text-[#2D5A4C] font-bold">
                                    {name.charAt(0)}
                                  </div>
                                  <span className="font-bold text-gray-900">{name}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {customer?.phone || 'N/A'}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newIds = formData.studentIds.filter(sid => sid !== id);
                                    const newNames = formData.studentNames.filter(sname => sname !== name);
                                    setFormData({ ...formData, studentIds: newIds, studentNames: newNames });
                                  }}
                                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Xóa khỏi lớp"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-20">
                      <Users className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900">Lớp học trống</h3>
                      <p className="text-gray-500 mb-6">Lớp học này hiện chưa có học viên nào tham gia.</p>
                      <button
                        type="button"
                        onClick={() => setStudentModalTab('add')}
                        className="bg-[#2D5A4C] text-white px-6 py-2 rounded-xl hover:bg-[#1D4A3C] transition-colors shadow-sm font-bold"
                      >
                        Thêm học viên ngay
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-6 border-t border-gray-100">
                <div className="text-sm">
                  <span className="text-gray-500">Tổng số học viên: </span>
                  <span className="font-bold text-xl text-[#2D5A4C]">{formData.studentIds.length}</span>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={closeStudentManagement}
                    className="flex-1 sm:flex-none px-8 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors font-bold"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="flex-1 sm:flex-none px-8 py-2.5 bg-[#2D5A4C] text-white rounded-xl hover:bg-[#1D4A3C] transition-colors shadow-lg font-bold"
                  >
                    Lưu thay đổi
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Quản lý Lớp học</h2>
        {isAdmin && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-[#2D5A4C] text-white px-4 py-2 rounded-lg hover:bg-[#1D4A3C] transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Tạo lớp học mới
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Tìm kiếm lớp học, học viên, giáo viên..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
          />
        </div>
        <div className="flex items-center gap-2 bg-white px-3 py-2 border border-gray-200 rounded-lg shrink-0">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent focus:outline-none text-sm text-gray-600"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="đang học">Đang học</option>
            <option value="kết thúc">Kết thúc</option>
            <option value="tạm dừng">Tạm dừng</option>
          </select>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg shrink-0">
          <button
            onClick={() => setViewType('table')}
            className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${
              viewType === 'table' ? 'bg-white text-[#2D5A4C] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Bảng
          </button>
          <button
            onClick={() => setViewType('calendar')}
            className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${
              viewType === 'calendar' ? 'bg-white text-[#2D5A4C] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Lịch
          </button>
        </div>
      </div>

      {viewType === 'table' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Lớp học</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Học viên</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Môn học & Giáo viên</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Trạng thái</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredClasses.map((cls) => (
                  <tr key={cls.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center bg-[#2D5A4C]/10 text-[#2D5A4C]"
                        >
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">{cls.name}</div>
                          <div className="text-xs text-gray-400">Bắt đầu: {format(new Date(cls.startDate), 'dd/MM/yyyy')}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-700">
                            {cls.studentIds.length} học viên
                          </span>
                        </div>
                        <button 
                          onClick={() => openStudentManagement(cls)}
                          className="text-xs font-bold hover:underline flex items-center gap-1 w-fit mt-1 text-[#2D5A4C]"
                        >
                          <BookOpen className="w-3 h-3" />
                          Xem danh sách & Quản lý
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">{cls.subject}</div>
                        <div className="text-gray-500 text-xs flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {cls.teacherName}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2 py-1 rounded text-[10px] uppercase font-bold ${
                        cls.status === 'đang học' ? 'bg-green-100 text-green-700' :
                        cls.status === 'kết thúc' ? 'bg-gray-100 text-gray-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {cls.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        {isAdmin && (
                          <>
                            <button 
                            onClick={() => {
                              setEditingSession(null);
                              setSessionFormData({ 
                                classId: cls.id,
                                date: format(new Date(), 'yyyy-MM-dd'),
                                startTime: '08:00',
                                endTime: '09:30',
                                status: 'đang học',
                              });
                              setIsSessionModalOpen(true);
                            }}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" 
                            title="Lên lịch buổi học"
                          >
                            <Calendar className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEditModal(cls)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Sửa">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(cls.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Xóa">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredClasses.length === 0 && (
            <div className="text-center py-12 text-gray-500 italic">
              Không tìm thấy lớp học nào phù hợp.
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/30">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}
                className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all border border-transparent hover:border-gray-200"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <button 
                onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
                className="px-4 py-1.5 text-sm font-bold text-[#2D5A4C] hover:bg-white hover:shadow-sm rounded-lg transition-all border border-transparent hover:border-gray-200"
              >
                Hôm nay
              </button>
              <button 
                onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
                className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all border border-transparent hover:border-gray-200"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="text-lg font-bold text-gray-900">
              Tháng {format(currentWeekStart, 'MM/yyyy')}
            </div>
          </div>
          <div className="grid grid-cols-7 border-b border-gray-100">
            {weekDates.map((date, i) => (
              <div 
                key={i} 
                className={`px-4 py-3 text-center border-r border-gray-50 last:border-r-0 ${
                  isSameDay(date, new Date()) ? 'bg-[#2D5A4C]/5' : 'bg-gray-50/50'
                }`}
              >
                <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
                  isSameDay(date, new Date()) ? 'text-[#2D5A4C]' : 'text-gray-400'
                }`}>
                  {format(date, 'EEEE', { locale: vi })}
                </div>
                <div className={`text-lg font-black ${
                  isSameDay(date, new Date()) ? 'text-[#2D5A4C]' : 'text-gray-700'
                }`}>
                  {format(date, 'dd')}
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 min-h-[600px]">
            {weekDates.map((date, i) => {
              const daySessions = teachingSessions.filter(s => isSameDay(new Date(s.date), date));
              return (
                <div 
                  key={i} 
                  className={`border-r border-gray-50 last:border-r-0 p-2 space-y-2 group relative ${
                    isSameDay(date, new Date()) ? 'bg-[#2D5A4C]/[0.02]' : 'bg-white/50'
                  }`}
                >
                  {isAdmin && (
                    <button
                      onClick={() => {
                        const filteredClass = classes.find(c => c.name === searchTerm);
                        setEditingSession(null);
                        setSessionFormData({ 
                          classId: filteredClass?.id || '',
                          date: format(date, 'yyyy-MM-dd'),
                          startTime: '08:00',
                          endTime: '09:30',
                          status: 'đang học',
                        });
                        setIsSessionModalOpen(true);
                      }}
                      className="absolute top-1 right-1 p-1 bg-[#2D5A4C] text-white rounded opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      title="Thêm buổi học"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                  {daySessions
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map((session, idx) => (
                    <div 
                      key={session.id} 
                      onClick={() => isAdmin && openEditSessionModal(session)}
                      className={`p-2 rounded-lg border text-xs shadow-sm transition-all hover:shadow-md relative group/item cursor-pointer ${
                        session.status === 'đang học' ? 'bg-[#2D5A4C]/5 border-[#2D5A4C]/20 text-[#2D5A4C]' :
                        session.status === 'kết thúc' ? 'bg-gray-50 border-gray-200 text-gray-400 grayscale' :
                        'bg-yellow-50 border-yellow-200 text-yellow-700'
                      }`}
                    >
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSession(session.id);
                          }}
                          className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity shadow-md z-20 hover:bg-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                      <div className="font-bold truncate" title={session.className}>{session.className}</div>
                      <div className="flex items-center gap-1 mt-1 text-[10px] opacity-80">
                        <Clock className="w-3 h-3" />
                        {session.startTime} - {session.endTime}
                      </div>
                      <div className="mt-1 font-medium opacity-90">{session.subject}</div>
                      <div className="text-[10px] opacity-70 mt-0.5 italic">{session.teacherName}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isSessionModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-[#2D5A4C] text-white">
              <h3 className="text-xl font-bold">{editingSession ? 'Sửa buổi học' : 'Thêm buổi học cụ thể'}</h3>
              <button onClick={() => {
                setIsSessionModalOpen(false);
                setEditingSession(null);
                setSessionFormData({
                  classId: '',
                  date: format(new Date(), 'yyyy-MM-dd'),
                  startTime: '08:00',
                  endTime: '09:30',
                  status: 'đang học',
                });
              }} className="text-white/80 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSessionSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lớp học *</label>
                <select
                  required
                  value={sessionFormData.classId}
                  onChange={(e) => {
                    setSessionFormData({ 
                      ...sessionFormData, 
                      classId: e.target.value,
                    });
                  }}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                >
                  <option value="">Chọn lớp học</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.subject})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày học *</label>
                <input
                  required
                  type="date"
                  value={sessionFormData.date}
                  onChange={(e) => setSessionFormData({ ...sessionFormData, date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giờ bắt đầu *</label>
                  <input
                    required
                    type="time"
                    value={sessionFormData.startTime}
                    onChange={(e) => setSessionFormData({ ...sessionFormData, startTime: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Giờ kết thúc *</label>
                  <input
                    required
                    type="time"
                    value={sessionFormData.endTime}
                    onChange={(e) => setSessionFormData({ ...sessionFormData, endTime: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái *</label>
                <select
                  required
                  value={sessionFormData.status}
                  onChange={(e) => setSessionFormData({ ...sessionFormData, status: e.target.value as Class['status'] })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                >
                  <option value="đang học">Đang học</option>
                  <option value="kết thúc">Kết thúc</option>
                  <option value="tạm dừng">Tạm dừng</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsSessionModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#2D5A4C] text-white rounded-lg hover:bg-[#1D4A3C] transition-colors shadow-sm font-bold"
                >
                  Lưu buổi học
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-[#2D5A4C] text-white">
              <h3 className="text-xl font-bold">
                {editingClass ? 'Sửa thông tin lớp học' : 'Tạo lớp học mới'}
              </h3>
              <button onClick={closeModal} className="text-white/80 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 max-h-[80vh] overflow-y-auto">
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <Users className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-700">
                      Bạn sẽ thêm học viên vào lớp sau khi tạo lớp xong bằng nút <span className="font-bold">"Thêm / Quản lý học viên"</span> trên thẻ lớp học.
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tên lớp học *</label>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="VD: Lớp Piano Cơ bản - K01"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Môn học *</label>
                    <select
                      required
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                    >
                      <option value="">Chọn môn học</option>
                      {subjects.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái *</label>
                    <select
                      required
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as Class['status'] })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                    >
                      <option value="đang học">Đang học</option>
                      <option value="kết thúc">Kết thúc</option>
                      <option value="tạm dừng">Tạm dừng</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Giáo viên *</label>
                    <select
                      required
                      value={formData.teacherId}
                      onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                    >
                      <option value="">Chọn giáo viên</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Trợ giảng</label>
                    <select
                      value={formData.taId}
                      onChange={(e) => setFormData({ ...formData, taId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                    >
                      <option value="">Chọn trợ giảng</option>
                      {tas.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lịch học</label>
                    <input
                      type="text"
                      value={formData.schedule}
                      onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                      placeholder="VD: Thứ 2, 4, 6 - 18:00"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu</label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                    />
                  </div>
                </div>

                <div className="col-span-full mt-4">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Kế hoạch giảng dạy theo tuần (Lịch học chi tiết)</label>
                  <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                    {formData.sessions.map((session, index) => (
                      <div key={index} className="flex flex-wrap items-end gap-3 bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                        <div className="flex-1 min-w-[120px]">
                          <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Thứ</label>
                          <select
                            value={session.dayOfWeek}
                            onChange={(e) => {
                              const newSessions = [...formData.sessions];
                              newSessions[index].dayOfWeek = parseInt(e.target.value);
                              setFormData({ ...formData, sessions: newSessions });
                            }}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20"
                          >
                            <option value={1}>Thứ 2</option>
                            <option value={2}>Thứ 3</option>
                            <option value={3}>Thứ 4</option>
                            <option value={4}>Thứ 5</option>
                            <option value={5}>Thứ 6</option>
                            <option value={6}>Thứ 7</option>
                            <option value={0}>Chủ Nhật</option>
                          </select>
                        </div>
                        <div className="flex-1 min-w-[100px]">
                          <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Từ</label>
                          <input
                            type="time"
                            value={session.startTime}
                            onChange={(e) => {
                              const newSessions = [...formData.sessions];
                              newSessions[index].startTime = e.target.value;
                              setFormData({ ...formData, sessions: newSessions });
                            }}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20"
                          />
                        </div>
                        <div className="flex-1 min-w-[100px]">
                          <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">Đến</label>
                          <input
                            type="time"
                            value={session.endTime}
                            onChange={(e) => {
                              const newSessions = [...formData.sessions];
                              newSessions[index].endTime = e.target.value;
                              setFormData({ ...formData, sessions: newSessions });
                            }}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newSessions = formData.sessions.filter((_, i) => i !== index);
                            setFormData({ ...formData, sessions: newSessions });
                          }}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({
                          ...formData,
                          sessions: [...formData.sessions, { dayOfWeek: 1, startTime: '08:00', endTime: '09:30' }]
                        });
                      }}
                      className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 hover:border-[#2D5A4C] hover:text-[#2D5A4C] transition-all flex items-center justify-center gap-2 text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Thêm buổi học mới
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-8">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#2D5A4C] text-white rounded-lg hover:bg-[#1D4A3C] transition-colors shadow-sm"
                >
                  {editingClass ? 'Cập nhật lớp học' : 'Tạo lớp học'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
