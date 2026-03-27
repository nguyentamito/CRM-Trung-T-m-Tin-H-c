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
import { db, auth } from '../firebase';
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
  BookOpen 
} from 'lucide-react';

interface TeacherListProps {
  profile: UserProfile | null;
}

export default function TeacherList({ profile }: TeacherListProps) {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const isAdmin = profile?.role === 'admin';

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    subjects: [] as string[],
  });

  useEffect(() => {
    const q = query(collection(db, 'teachers'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTeachers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teacher)));
    });

    const qSub = query(collection(db, 'subjects'), orderBy('name', 'asc'));
    const unsubscribeSub = onSnapshot(qSub, (snapshot) => {
      setSubjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
    });

    return () => {
      unsubscribe();
      unsubscribeSub();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      if (editingTeacher) {
        await updateDoc(doc(db, 'teachers', editingTeacher.id), {
          ...formData,
        });
      } else {
        await addDoc(collection(db, 'teachers'), {
          ...formData,
          createdAt: Date.now(),
        });
      }
      closeModal();
    } catch (error) {
      console.error('Error saving teacher:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin || !window.confirm('Bạn có chắc muốn xóa giáo viên này?')) return;
    try {
      await deleteDoc(doc(db, 'teachers', id));
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
    });
  };

  const filteredTeachers = teachers.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.phone.includes(searchTerm) ||
    t.email.toLowerCase().includes(searchTerm.toLowerCase())
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTeachers.map((teacher) => (
          <div key={teacher.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#2D5A4C]/10 rounded-full flex items-center justify-center text-[#2D5A4C]">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{teacher.name}</h3>
                    <p className="text-sm text-gray-500">Giáo viên</p>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <button onClick={() => openEditModal(teacher)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(teacher.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Phone className="w-4 h-4" />
                  {teacher.phone}
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Mail className="w-4 h-4" />
                  {teacher.email}
                </div>
                <div className="flex items-start gap-3 text-sm text-gray-600">
                  <BookOpen className="w-4 h-4 mt-1" />
                  <div className="flex flex-wrap gap-1">
                    {teacher.subjects?.length > 0 ? (
                      teacher.subjects.map(s => (
                        <span key={s} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs">
                          {s}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-400 italic">Chưa gán môn học</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
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
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại *</label>
                  <input
                    required
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                  />
                </div>
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
