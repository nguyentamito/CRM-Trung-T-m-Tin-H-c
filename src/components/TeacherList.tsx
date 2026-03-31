import React, { useState, useEffect } from 'react';
import { Teacher, Subject, UserProfile } from '../types';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X, 
  User, 
  Phone, 
  Mail, 
  BookOpen,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Pagination from './Pagination';

interface TeacherListProps {
  profile: UserProfile | null;
}

export default function TeacherList({ profile }: TeacherListProps) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const isAdmin = profile?.role === 'admin';

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    subjects: [] as string[],
    dob: '',
    qualification: '',
    pedagogical: false,
    address: '',
  });

  const fetchData = async () => {
    try {
      const [teachersRes, subjectsRes] = await Promise.all([
        fetch('/api/teachers'),
        fetch('/api/subjects')
      ]);
      const [teachersData, subjectsData] = await Promise.all([
        teachersRes.json(),
        subjectsRes.json()
      ]);
      const parsedTeachers = (Array.isArray(teachersData) ? teachersData : []).map((t: any) => {
        let parsedSubjects = [];
        try {
          parsedSubjects = typeof t.subjects === 'string' ? JSON.parse(t.subjects) : (t.subjects || []);
        } catch (e) {
          console.error('Error parsing subjects for teacher:', t.id, e);
          parsedSubjects = [];
        }
        return { ...t, subjects: Array.isArray(parsedSubjects) ? parsedSubjects : [] };
      });
      setTeachers(parsedTeachers);
      setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
    } catch (error) {
      console.error('Error fetching teacher data:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const data = {
      ...formData,
      subjects: JSON.stringify(formData.subjects)
    };

    try {
      if (editingTeacher) {
        await fetch(`/api/teachers/${editingTeacher.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      } else {
        await fetch('/api/teachers', {
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
      console.error('Error saving teacher:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin || !window.confirm('Bạn có chắc muốn xóa giáo viên này?')) return;
    try {
      await fetch(`/api/teachers/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Error deleting teacher:', error);
    }
  };

  const openEditModal = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      name: teacher.name,
      phone: teacher.phone,
      email: teacher.email,
      subjects: teacher.subjects || [],
      dob: teacher.dob || '',
      qualification: teacher.qualification || '',
      pedagogical: !!teacher.pedagogical,
      address: teacher.address || '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTeacher(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
      subjects: [],
      dob: '',
      qualification: '',
      pedagogical: false,
      address: '',
    });
  };

  const filteredTeachers = teachers.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.phone.includes(searchTerm) ||
    t.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredTeachers.length / itemsPerPage);
  const paginatedTeachers = filteredTeachers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const toggleSubject = (subjectName: string) => {
    setFormData(prev => ({
      ...prev,
      subjects: prev.subjects.includes(subjectName)
        ? prev.subjects.filter(s => s !== subjectName)
        : [...prev.subjects, subjectName]
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Quản lý Giáo viên</h2>
        {isAdmin && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-[#2D5A4C] text-white px-4 py-2 rounded-lg hover:bg-[#1D4A3C] transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Thêm giáo viên
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Tìm kiếm giáo viên..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-sm font-semibold text-gray-900">Họ tên</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900">Ngày sinh</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900">Liên hệ</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900">Trình độ</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900">NV Sư phạm</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900">Địa chỉ</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-900">Môn học</th>
                {isAdmin && <th className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginatedTeachers.map((teacher) => (
                <tr key={teacher.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#2D5A4C]/10 rounded-full flex items-center justify-center text-[#2D5A4C]">
                        <User className="w-4 h-4" />
                      </div>
                      <span className="font-medium text-gray-900">{teacher.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {teacher.dob ? new Date(teacher.dob).toLocaleDateString('vi-VN') : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-3 h-3" />
                        {teacher.phone}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="w-3 h-3" />
                        {teacher.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{teacher.qualification || '-'}</td>
                  <td className="px-6 py-4">
                    {teacher.pedagogical ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">Có</span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">Không</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{teacher.address || '-'}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {Array.isArray(teacher.subjects) && teacher.subjects.length > 0 ? (
                        teacher.subjects.map(s => (
                          <span key={s} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 italic text-xs">Chưa gán</span>
                      )}
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEditModal(teacher)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(teacher.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
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
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-[#2D5A4C] rounded-t-2xl">
              <h3 className="text-xl font-bold text-white">
                {editingTeacher ? 'Sửa thông tin giáo viên' : 'Thêm giáo viên mới'}
              </h3>
              <button onClick={closeModal} className="text-white/80 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Họ tên *</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày sinh</label>
                  <input
                    type="date"
                    value={formData.dob}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại *</label>
                  <input
                    required
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trình độ</label>
                  <input
                    type="text"
                    placeholder="VD: Thạc sĩ, Cử nhân..."
                    value={formData.qualification}
                    onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pedagogical"
                  checked={formData.pedagogical}
                  onChange={(e) => setFormData({ ...formData, pedagogical: e.target.checked })}
                  className="rounded border-gray-300 text-[#2D5A4C] focus:ring-[#2D5A4C]"
                />
                <label htmlFor="pedagogical" className="text-sm font-medium text-gray-700">Có nghiệp vụ sư phạm</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Môn học phụ trách</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border border-gray-100 rounded-lg">
                  {subjects.map(subject => (
                    <label key={subject.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.subjects.includes(subject.name)}
                        onChange={() => toggleSubject(subject.name)}
                        className="rounded border-gray-300 text-[#2D5A4C] focus:ring-[#2D5A4C]"
                      />
                      <span className="text-sm text-gray-600">{subject.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
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
                  {editingTeacher ? 'Cập nhật' : 'Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
