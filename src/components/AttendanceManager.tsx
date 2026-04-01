import React, { useState, useEffect } from 'react';
import { 
  TeachingSession, 
  Attendance, 
  Class, 
  UserProfile, 
  AttendanceStatus 
} from '../types';
import { 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  X, 
  Users, 
  Clock, 
  User as UserIcon,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  MapPin,
  ExternalLink
} from 'lucide-react';
import { format, startOfDay, endOfDay, addDays, subDays } from 'date-fns';
import Pagination from './Pagination';

interface AttendanceManagerProps {
  profile: UserProfile | null;
}

export default function AttendanceManager({ profile }: AttendanceManagerProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [sessions, setSessions] = useState<TeachingSession[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<TeachingSession | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setSelectedDate(new Date());
    setCurrentPage(1);
  };

  const fetchData = async () => {
    if (!profile) return;

    const start = startOfDay(selectedDate).getTime();
    const end = endOfDay(selectedDate).getTime();

    try {
      const [sessionsRes, classesRes, attendanceRes] = await Promise.all([
        fetch(`/api/teaching_sessions?start=${start}&end=${end}`),
        fetch('/api/classes'),
        fetch('/api/attendance')
      ]);

      const [sessionsData, classesData, attendanceData] = await Promise.all([
        sessionsRes.ok ? sessionsRes.json().catch(() => []) : Promise.resolve([]),
        classesRes.ok ? classesRes.json().catch(() => []) : Promise.resolve([]),
        attendanceRes.ok ? attendanceRes.json().catch(() => []) : Promise.resolve([])
      ]);

      const parsedClasses = (Array.isArray(classesData) ? classesData : []).map((c: any) => ({
        ...c,
        studentIds: (typeof c.studentIds === 'string' && c.studentIds.trim()) ? JSON.parse(c.studentIds) : (Array.isArray(c.studentIds) ? c.studentIds : []),
        studentNames: (typeof c.studentNames === 'string' && c.studentNames.trim()) ? JSON.parse(c.studentNames) : (Array.isArray(c.studentNames) ? c.studentNames : []),
        sessions: (typeof c.sessions === 'string' && c.sessions.trim()) ? JSON.parse(c.sessions) : (Array.isArray(c.sessions) ? c.sessions : []),
      }));

      setSessions(Array.isArray(sessionsData) ? sessionsData : []);
      setClasses(parsedClasses);
      setAttendanceRecords(Array.isArray(attendanceData) ? attendanceData : []);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching attendance data:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate, profile]);

  const filteredSessions = sessions.filter(s => {
    const matchesSearch = s.className.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         s.teacherName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         s.subject.toLowerCase().includes(searchTerm.toLowerCase());
    
    const stats = getAttendanceStats(s.id, s.classId);
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'completed' ? stats.completed : !stats.completed);
    
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredSessions.length / itemsPerPage);
  const paginatedSessions = filteredSessions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleAttendanceChange = async (studentId: string, studentName: string, status: AttendanceStatus) => {
    if (!selectedSession || !profile) return;

    const existingRecord = attendanceRecords.find(
      r => String(r.sessionId) === String(selectedSession.id) && String(r.studentId) === String(studentId)
    );

    const data = {
      status,
      takenById: profile.uid,
      takenByName: profile.displayName || profile.email || 'Unknown',
      date: selectedSession.date, // Add the session date to the attendance record
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
            sessionId: selectedSession.id,
            classId: selectedSession.classId,
            studentId,
            studentName,
          })
        });
      }
      
      // Update session status to 'hoàn thành' if it's currently 'chưa diễn ra'
      if (selectedSession.status === 'chưa diễn ra') {
        await fetch(`/api/teaching_sessions/${selectedSession.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'hoàn thành' })
        });
        setSelectedSession({ ...selectedSession, status: 'hoàn thành' });
      }

      fetchData();
    } catch (error) {
      console.error("Error updating attendance:", error);
    }
  };

  const getAttendanceStats = (sessionId: string, classId: string) => {
    const classData = classes.find(c => String(c.id) === String(classId));
    if (!classData || !classData.studentIds) return { total: 0, present: 0, completed: false };

    const records = attendanceRecords.filter(r => String(r.sessionId) === String(sessionId));
    const present = records.filter(r => r.status === 'có mặt').length;
    
    const totalStudents = classData.studentIds.length;
    
    return {
      total: totalStudents,
      present: present,
      completed: records.length === totalStudents && totalStudents > 0
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Quản lý điểm danh</h2>
          <p className="text-gray-500">Theo dõi và cập nhật tình hình chuyên cần của học viên</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-gray-100">
          <button 
            onClick={() => setSelectedDate(subDays(selectedDate, 1))}
            className="p-2 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="px-4 py-2 font-bold text-gray-900 flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-blue-600" />
            {format(selectedDate, 'dd/MM/yyyy')}
          </div>
          <button 
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            className="p-2 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
          <button 
            onClick={() => setSelectedDate(new Date())}
            className="ml-2 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            Hôm nay
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Số lớp hôm nay</p>
            <p className="text-xl font-bold text-gray-900">{sessions.length}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Đã điểm danh</p>
            <p className="text-xl font-bold text-gray-900">
              {sessions.filter(s => getAttendanceStats(s.id, s.classId).completed).length}
            </p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center text-yellow-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Chưa hoàn thành</p>
            <p className="text-xl font-bold text-gray-900">
              {sessions.filter(s => !getAttendanceStats(s.id, s.classId).completed).length}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-50 bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm lớp học, giáo viên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">Bộ lọc:</span>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="text-sm bg-transparent border-none focus:ring-0 font-medium text-gray-700"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="completed">Đã điểm danh</option>
              <option value="pending">Chưa điểm danh</option>
            </select>
            <button
              onClick={clearFilters}
              className="px-3 py-1 text-xs text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all font-medium border border-gray-200 ml-2"
            >
              Xóa lọc
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Lớp học & Môn học</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Phòng học</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Thời gian</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Giáo viên</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Sĩ số</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedSessions.map((session) => {
                const stats = getAttendanceStats(session.id, session.classId);
                return (
                  <tr key={session.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{session.className}</div>
                      <div className="text-xs text-gray-500">{session.subject}</div>
                    </td>
                    <td className="px-6 py-4">
                      {session.roomName ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                            <MapPin className="w-3.5 h-3.5 text-gray-400" />
                            {session.roomName}
                          </div>
                          {session.roomLink && (
                            <a 
                              href={session.roomLink.startsWith('http') ? session.roomLink : `https://${session.roomLink}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                              Vào lớp
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Chưa gán</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Clock className="w-4 h-4 text-gray-400" />
                        {session.startTime} - {session.endTime}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                          <UserIcon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-medium text-gray-700">{session.teacherName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {[...Array(Math.min(3, stats.total))].map((_, i) => (
                            <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center">
                              <UserIcon className="w-3 h-3 text-gray-400" />
                            </div>
                          ))}
                        </div>
                        <span className="text-sm font-bold text-gray-900">
                          {stats.present}/{stats.total}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedSession(session);
                          setIsAttendanceModalOpen(true);
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all shadow-sm ${
                          stats.completed 
                            ? "bg-green-50 text-green-600 hover:bg-green-100" 
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        }`}
                      >
                        {stats.completed ? "Đã xong" : "Điểm danh"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredSessions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <CalendarIcon className="w-12 h-12 opacity-20" />
                      <p className="italic">Không có lịch học nào trong ngày này.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination 
          currentPage={currentPage} 
          totalPages={totalPages} 
          onPageChange={setCurrentPage} 
        />
      </div>

      {isAttendanceModalOpen && selectedSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[70] backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-[#2D5A4C] text-white">
              <div>
                <h3 className="text-xl font-bold">Điểm danh buổi học</h3>
                <div className="flex items-center gap-3 text-sm opacity-80">
                  <span>{selectedSession.className} - {format(new Date(selectedSession.date), 'dd/MM/yyyy')}</span>
                  {selectedSession.roomName && (
                    <span className="flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded text-xs">
                      <MapPin className="w-3 h-3" />
                      {selectedSession.roomName}
                      {selectedSession.roomLink && (
                        <a 
                          href={selectedSession.roomLink.startsWith('http') ? selectedSession.roomLink : `https://${selectedSession.roomLink}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-1 hover:text-white"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </span>
                  )}
                </div>
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
                  {(classes.find(c => String(c.id) === String(selectedSession.classId))?.studentIds || []).map((studentId, index) => {
                    const studentName = classes.find(c => String(c.id) === String(selectedSession.classId))?.studentNames?.[index] || '';
                    const record = attendanceRecords.find(r => String(r.sessionId) === String(selectedSession.id) && String(r.studentId) === String(studentId));
                    
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
                            {(['có mặt', 'vắng mặt', 'muộn', 'phép'] as AttendanceStatus[]).map((status) => (
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
              {((classes.find(c => String(c.id) === String(selectedSession.classId))?.studentIds?.length || 0) === 0) && (
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
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
