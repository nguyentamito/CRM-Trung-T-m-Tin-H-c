import React, { useState, useEffect } from 'react';
import { Class, Teacher, TeachingAssistant, Customer, Subject, UserProfile, TeachingSession, Attendance, SessionStatus, Room } from '../types';
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
  Filter,
  MapPin,
  AlertTriangle
} from 'lucide-react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay } from 'date-fns';
import { vi } from 'date-fns/locale';
import SearchableSelect from './SearchableSelect';
import Pagination from './Pagination';

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
  const [rooms, setRooms] = useState<Room[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [viewType, setViewType] = useState<'table' | 'calendar'>('table');
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'students'>('list');
  const [studentModalTab, setStudentModalTab] = useState<'list' | 'add'>('list');
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [editingSession, setEditingSession] = useState<TeachingSession | null>(null);
  const [selectedSessionForAttendance, setSelectedSessionForAttendance] = useState<TeachingSession | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const [selectedClassForStudents, setSelectedClassForStudents] = useState<Class | null>(null);
  const isAdmin = profile?.role === 'admin';
  const isStaff = profile?.role === 'staff';
  const isTeacher = profile?.role === 'teacher';
  const canMarkAttendance = isAdmin || isStaff || isTeacher;

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
    roomId: '',
    roomName: '',
    roomLink: '',
    zaloLink: '',
    status: 'đang học' as Class['status'],
  });

  const [sessionFormData, setSessionFormData] = useState({
    classId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '08:00',
    endTime: '09:30',
    roomId: '',
    roomName: '',
    roomLink: '',
    status: 'chưa diễn ra' as SessionStatus,
  });

  const fetchData = async () => {
    try {
      const [
        classesRes,
        teachersRes,
        tasRes,
        customersRes,
        subjectsRes,
        sessionsRes,
        attendanceRes,
        roomsRes
      ] = await Promise.all([
        fetch('/api/classes'),
        fetch('/api/teachers'),
        fetch('/api/teaching_assistants'),
        fetch('/api/customers'),
        fetch('/api/subjects'),
        fetch('/api/teaching_sessions'),
        fetch('/api/attendance'),
        fetch('/api/rooms')
      ]);

      const [
        classesData,
        teachersData,
        tasData,
        customersData,
        subjectsData,
        sessionsData,
        attendanceData,
        roomsData
      ] = await Promise.all([
        classesRes.ok ? classesRes.json() : Promise.resolve([]),
        teachersRes.ok ? teachersRes.json() : Promise.resolve([]),
        tasRes.ok ? tasRes.json() : Promise.resolve([]),
        customersRes.ok ? customersRes.json() : Promise.resolve([]),
        subjectsRes.ok ? subjectsRes.json() : Promise.resolve([]),
        sessionsRes.ok ? sessionsRes.json() : Promise.resolve([]),
        attendanceRes.ok ? attendanceRes.json() : Promise.resolve([]),
        roomsRes.ok ? roomsRes.json() : Promise.resolve([])
      ]);

      const parsedClasses = (Array.isArray(classesData) ? classesData : []).map((c: any) => ({
        ...c,
        sessions: (typeof c.sessions === 'string' && c.sessions.trim()) ? JSON.parse(c.sessions) : (Array.isArray(c.sessions) ? c.sessions : []),
        studentIds: (typeof c.studentIds === 'string' && c.studentIds.trim()) ? JSON.parse(c.studentIds) : (Array.isArray(c.studentIds) ? c.studentIds : []),
        studentNames: (typeof c.studentNames === 'string' && c.studentNames.trim()) ? JSON.parse(c.studentNames) : (Array.isArray(c.studentNames) ? c.studentNames : []),
      }));
      setClasses(parsedClasses);
      setTeachers(Array.isArray(teachersData) ? teachersData : []);
      setTAs(Array.isArray(tasData) ? tasData : []);
      setCustomers(Array.isArray(customersData) ? customersData : []);
      setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
      setTeachingSessions(Array.isArray(sessionsData) ? sessionsData : []);
      setAttendanceRecords(Array.isArray(attendanceData) ? attendanceData : []);
      setRooms(Array.isArray(roomsData) ? roomsData : []);
    } catch (error) {
      console.error("Error fetching class list data:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [profile]);

  const checkConflict = (roomId: string, date: number, startTime: string, endTime: string, excludeSessionId?: string) => {
    if (!roomId) return null;
    
    const room = rooms.find(r => String(r.id) === String(roomId));
    if (!room || room.type !== 'Phòng Online') return null;
    
    const conflict = teachingSessions.find(s => {
      if (s.id === excludeSessionId) return false;
      if (s.roomId !== roomId) return false;
      if (!isSameDay(new Date(s.date), new Date(date))) return false;
      
      // Overlap logic: (StartA < EndB) && (EndA > StartB)
      return (startTime < s.endTime) && (endTime > s.startTime);
    });
    
    if (conflict) {
      return `Xung đột với lớp ${conflict.className} (${conflict.startTime} - ${conflict.endTime})`;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const selectedTeacher = teachers.find(t => String(t.id) === String(formData.teacherId));
    const selectedTA = tas.find(t => String(t.id) === String(formData.taId));
    const selectedRoom = rooms.find(r => String(r.id) === String(formData.roomId));

    const data = {
      ...formData,
      teacherId: formData.teacherId || null,
      taId: formData.taId || null,
      roomId: formData.roomId || null,
      teacherName: selectedTeacher?.name || '',
      taName: selectedTA?.name || '',
      roomName: selectedRoom?.name || '',
      roomLink: selectedRoom?.location || '',
      startDate: new Date(formData.startDate).getTime(),
      sessions: JSON.stringify(formData.sessions || []),
      studentIds: JSON.stringify(formData.studentIds || []),
      studentNames: JSON.stringify(formData.studentNames || []),
      updatedAt: Date.now(),
    };

    try {
      if (editingClass) {
        await fetch(`/api/classes/${editingClass.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } else {
        await fetch('/api/classes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            createdAt: Date.now(),
          })
        });
      }
      fetchData();
      closeModal();
    } catch (error) {
      console.error("Error saving class:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin || !window.confirm('Bạn có chắc muốn xóa lớp học này?')) return;
    try {
      await fetch(`/api/classes/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error("Error deleting class:", error);
    }
  };

  const handleSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const selectedClass = classes.find(c => String(c.id) === String(sessionFormData.classId));
    if (!selectedClass) return;

    const selectedRoom = rooms.find(r => String(r.id) === String(sessionFormData.roomId));

    const data = {
      classId: selectedClass.id,
      className: selectedClass.name,
      subject: selectedClass.subject,
      teacherId: selectedClass.teacherId || null,
      teacherName: selectedClass.teacherName,
      taId: selectedClass.taId || null,
      taName: selectedClass.taName || '',
      roomId: selectedRoom?.id || null,
      roomName: selectedRoom?.name || '',
      roomLink: selectedRoom?.location || '',
      date: new Date(sessionFormData.date).getTime(),
      startTime: sessionFormData.startTime,
      endTime: sessionFormData.endTime,
      status: sessionFormData.status,
      createdAt: Date.now(),
    };

    try {
      if (editingSession) {
        await fetch(`/api/teaching_sessions/${editingSession.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } else {
        await fetch('/api/teaching_sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      }
      fetchData();
      setIsSessionModalOpen(false);
      setEditingSession(null);
      setSessionFormData({
        classId: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        startTime: '08:00',
        endTime: '09:30',
        roomId: '',
        roomName: '',
        roomLink: '',
        status: 'chưa diễn ra',
      });
    } catch (error) {
      console.error("Error saving session:", error);
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!isAdmin) return;
    try {
      await fetch(`/api/teaching_sessions/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error("Error deleting session:", error);
    }
  };

  const openEditSessionModal = (session: TeachingSession) => {
    setEditingSession(session);
    setSessionFormData({
      classId: session.classId,
      date: format(new Date(session.date), 'yyyy-MM-dd'),
      startTime: session.startTime,
      endTime: session.endTime,
      roomId: session.roomId || '',
      roomName: session.roomName || '',
      roomLink: session.roomLink || '',
      status: session.status,
    });
    setIsSessionModalOpen(true);
  };

  const openAttendanceModal = (session: TeachingSession) => {
    setSelectedSessionForAttendance(session);
    setIsAttendanceModalOpen(true);
  };

  const handleAttendanceChange = async (studentId: string, studentName: string, status: Attendance['status']) => {
    if (!canMarkAttendance || !selectedSessionForAttendance || !profile) return;

    const existingRecord = attendanceRecords.find(
      r => String(r.sessionId) === String(selectedSessionForAttendance.id) && String(r.studentId) === String(studentId)
    );

    const data = {
      status,
      takenById: profile.uid,
      takenByName: profile.displayName || profile.email || 'Unknown',
      date: selectedSessionForAttendance.date, // Add the session date to the attendance record
      updatedAt: Date.now()
    };

    try {
      if (existingRecord) {
        await fetch(`/api/attendance/${existingRecord.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } else {
        await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...data,
            sessionId: selectedSessionForAttendance.id,
            classId: selectedSessionForAttendance.classId,
            studentId,
            studentName,
          })
        });
      }
      
      // Update session status to 'hoàn thành' if it's currently 'chưa diễn ra'
      if (selectedSessionForAttendance.status === 'chưa diễn ra') {
        await fetch(`/api/teaching_sessions/${selectedSessionForAttendance.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'hoàn thành' })
        });
        setSelectedSessionForAttendance({ ...selectedSessionForAttendance, status: 'hoàn thành' });
      }

      fetchData();
    } catch (error) {
      console.error("Error updating attendance:", error);
    }
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
      roomId: cls.roomId || '',
      roomName: cls.roomName || '',
      roomLink: cls.roomLink || '',
      zaloLink: cls.zaloLink || '',
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
      roomId: '',
      roomName: '',
      roomLink: '',
      zaloLink: '',
      schedule: '',
      sessions: [],
      startDate: format(new Date(), 'yyyy-MM-dd'),
      status: 'đang học',
    });
  };

  const toggleStudent = (customer: Customer) => {
    setFormData(prev => {
      const isSelected = prev.studentIds.some(id => String(id) === String(customer.id));
      if (isSelected) {
        return {
          ...prev,
          studentIds: prev.studentIds.filter(id => String(id) !== String(customer.id)),
          studentNames: prev.studentNames.filter(name => name !== customer.name)
        };
      } else {
        return {
          ...prev,
          studentIds: [...prev.studentIds, String(customer.id)],
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
    if ((!isAdmin && !isStaff) || !selectedClassForStudents) return;

    try {
      await fetch(`/api/classes/${selectedClassForStudents.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentIds: JSON.stringify(formData.studentIds),
          studentNames: JSON.stringify(formData.studentNames),
          updatedAt: Date.now(),
        })
      });
      fetchData();
      closeStudentManagement();
    } catch (error) {
      console.error("Error updating students:", error);
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

  const totalPages = Math.ceil(filteredClasses.length / itemsPerPage);
  const paginatedClasses = filteredClasses.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

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
                  <div className="max-w-md">
                    <SearchableSelect
                      options={customers.map(customer => ({
                        id: String(customer.id),
                        label: customer.name,
                        sublabel: customer.phone,
                        disabled: formData.studentIds.some(id => String(id) === String(customer.id))
                      }))}
                      value=""
                      onChange={(value) => {
                        const customer = customers.find(c => String(c.id) === String(value));
                        if (customer) toggleStudent(customer);
                      }}
                      placeholder="Tìm kiếm học viên để thêm vào lớp..."
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto p-1">
                    {customers.length > 0 ? (
                      customers.filter(c => formData.studentIds.some(id => String(id) === String(c.id))).map(customer => (
                        <label key={customer.id} className="flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all border-[#2D5A4C] bg-[#2D5A4C]/5 ring-1 ring-[#2D5A4C]">
                          <input
                            type="checkbox"
                            checked={true}
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
                    {formData.studentIds.length === 0 && (
                      <div className="col-span-full py-12 text-center border-2 border-dashed border-gray-100 rounded-2xl">
                        <p className="text-gray-400 italic">Chọn học viên từ ô tìm kiếm phía trên để thêm vào lớp.</p>
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
                          const customer = customers.find(c => String(c.id) === String(id));
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
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Zalo</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Trạng thái</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedClasses.map((cls) => (
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
                      {cls.zaloLink ? (
                        <a 
                          href={cls.zaloLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center gap-1"
                        >
                          Link nhóm
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs italic">Chưa có</span>
                      )}
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
                                roomId: cls.roomId || '',
                                roomName: cls.roomName || '',
                                roomLink: cls.roomLink || '',
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
          <Pagination 
            currentPage={currentPage} 
            totalPages={totalPages} 
            onPageChange={setCurrentPage} 
          />
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
                          roomId: filteredClass?.roomId || '',
                          roomName: filteredClass?.roomName || '',
                          roomLink: filteredClass?.roomLink || '',
                          status: 'chưa diễn ra',
                        });
                        setIsSessionModalOpen(true);
                      }}
                      className="absolute bottom-1 right-1 p-1 bg-[#2D5A4C] text-white rounded opacity-0 group-hover:opacity-100 transition-opacity z-10"
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
                      onClick={() => {
                        if (isAdmin) {
                          openEditSessionModal(session);
                        } else if (canMarkAttendance) {
                          openAttendanceModal(session);
                        }
                      }}
                      className={`p-2 rounded-lg border text-xs shadow-sm transition-all hover:shadow-md relative group/item cursor-pointer ${
                        session.status === 'hoàn thành' || session.status === 'đang học' ? 'bg-[#2D5A4C]/5 border-[#2D5A4C]/20 text-[#2D5A4C]' :
                        session.status === 'kết thúc' || session.status === 'hủy' ? 'bg-gray-50 border-gray-200 text-gray-400 grayscale' :
                        'bg-yellow-50 border-yellow-200 text-yellow-700'
                      }`}
                    >
                      <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity z-20">
                        {canMarkAttendance && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openAttendanceModal(session);
                            }}
                            className="p-1.5 bg-green-500 text-white rounded-full shadow-md hover:bg-green-600"
                            title="Điểm danh"
                          >
                            <Users className="w-3 h-3" />
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSession(session.id);
                            }}
                            className="p-1.5 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600"
                            title="Xóa"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
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

      {isAttendanceModalOpen && selectedSessionForAttendance && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[70] backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-[#2D5A4C] text-white">
              <div>
                <h3 className="text-xl font-bold">Điểm danh buổi học</h3>
                <p className="text-sm opacity-80">{selectedSessionForAttendance.className} - {format(new Date(selectedSessionForAttendance.date), 'dd/MM/yyyy')}</p>
              </div>
              <button onClick={() => setIsAttendanceModalOpen(false)} className="text-white/80 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Học viên</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {classes.find(c => String(c.id) === String(selectedSessionForAttendance.classId))?.studentIds.map((studentId, index) => {
                    const studentName = classes.find(c => String(c.id) === String(selectedSessionForAttendance.classId))?.studentNames[index] || '';
                    const record = attendanceRecords.find(r => String(r.sessionId) === String(selectedSessionForAttendance.id) && String(r.studentId) === String(studentId));
                    
                    return (
                      <tr key={studentId} className="hover:bg-gray-50/50">
                        <td className="px-4 py-4">
                          <div className="font-bold text-gray-900">{studentName}</div>
                          {record && (
                            <div className="text-[9px] text-gray-400 mt-0.5">
                              Cập nhật bởi: {record.takenByName} lúc {format(new Date(record.updatedAt), 'HH:mm dd/MM')}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex justify-center gap-2">
                            {(['có mặt', 'vắng mặt', 'muộn', 'phép'] as Attendance['status'][]).map((status) => (
                              <button
                                key={status}
                                onClick={() => handleAttendanceChange(studentId, studentName, status)}
                                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${
                                  record?.status === status
                                    ? status === 'có mặt' ? 'bg-green-500 text-white' :
                                      status === 'vắng mặt' ? 'bg-red-500 text-white' :
                                      status === 'muộn' ? 'bg-yellow-500 text-white' :
                                      'bg-blue-500 text-white'
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}
                              >
                                {status}
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {(!classes.find(c => String(c.id) === String(selectedSessionForAttendance.classId))?.studentIds.length) && (
                <div className="text-center py-10 text-gray-500 italic">
                  Lớp học này chưa có học viên.
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setIsAttendanceModalOpen(false)}
                className="px-6 py-2 bg-[#2D5A4C] text-white rounded-lg hover:bg-[#1D4A3C] transition-colors font-bold"
              >
                Hoàn tất
              </button>
            </div>
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
                  roomId: '',
                  roomName: '',
                  roomLink: '',
                  status: 'chưa diễn ra',
                });
              }} className="text-white/80 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSessionSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lớp học *</label>
                <SearchableSelect
                  options={classes.map(c => ({
                    id: String(c.id),
                    label: `${c.name} (${c.subject})`,
                    sublabel: c.teacherName
                  }))}
                  value={String(sessionFormData.classId)}
                  onChange={(value) => {
                    setSessionFormData({ 
                      ...sessionFormData, 
                      classId: String(value),
                    });
                  }}
                  placeholder="Chọn lớp học"
                />
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
                  onChange={(e) => setSessionFormData({ ...sessionFormData, status: e.target.value as SessionStatus })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                >
                  <option value="chưa diễn ra">Chưa diễn ra</option>
                  <option value="hoàn thành">Hoàn thành</option>
                  <option value="hủy">Hủy</option>
                  <option value="đang học">Đang học (Lớp)</option>
                  <option value="kết thúc">Kết thúc (Lớp)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phòng học *</label>
                <SearchableSelect
                  options={rooms.map(r => ({
                    id: String(r.id),
                    label: r.name,
                    sublabel: r.type
                  }))}
                  value={String(sessionFormData.roomId)}
                  onChange={(value) => setSessionFormData({ ...sessionFormData, roomId: String(value) })}
                  placeholder="Chọn phòng học"
                />
              </div>
              {sessionFormData.roomId && (
                <div className="text-xs text-gray-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {rooms.find(r => String(r.id) === String(sessionFormData.roomId))?.location}
                </div>
              )}
              {(() => {
                const conflict = checkConflict(
                  sessionFormData.roomId,
                  new Date(sessionFormData.date).getTime(),
                  sessionFormData.startTime,
                  sessionFormData.endTime,
                  editingSession?.id
                );
                if (conflict) {
                  return (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700 text-sm">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{conflict}</span>
                    </div>
                  );
                }
                return null;
              })()}
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
                    <SearchableSelect
                      options={subjects.map(s => ({
                        id: s.name,
                        label: s.name
                      }))}
                      value={formData.subject}
                      onChange={(value) => setFormData({ ...formData, subject: String(value) })}
                      placeholder="Chọn môn học"
                    />
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
                    <SearchableSelect
                      options={teachers.map(t => ({
                        id: String(t.id),
                        label: t.name,
                        sublabel: t.phone
                      }))}
                      value={String(formData.teacherId)}
                      onChange={(value) => setFormData({ ...formData, teacherId: String(value) })}
                      placeholder="Chọn giáo viên"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Trợ giảng</label>
                    <SearchableSelect
                      options={tas.map(t => ({
                        id: String(t.id),
                        label: t.name,
                        sublabel: t.phone
                      }))}
                      value={String(formData.taId)}
                      onChange={(value) => setFormData({ ...formData, taId: String(value) })}
                      placeholder="Chọn trợ giảng"
                    />
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Link nhóm Zalo</label>
                    <input
                      type="text"
                      value={formData.zaloLink}
                      onChange={(e) => setFormData({ ...formData, zaloLink: e.target.value })}
                      placeholder="https://zalo.me/g/..."
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phòng học mặc định</label>
                    <SearchableSelect
                      options={rooms.map(r => ({
                        id: String(r.id),
                        label: r.name,
                        sublabel: r.type
                      }))}
                      value={String(formData.roomId)}
                      onChange={(value) => setFormData({ ...formData, roomId: String(value) })}
                      placeholder="Chọn phòng học"
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
