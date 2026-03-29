import React, { useState, useEffect } from 'react';
import { TeachingAssistant, UserProfile } from '../types';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X, 
  User, 
  Phone, 
  Mail 
} from 'lucide-react';

interface TAListProps {
  profile: UserProfile | null;
}

export default function TAList({ profile }: TAListProps) {
  const [tas, setTAs] = useState<TeachingAssistant[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTA, setEditingTA] = useState<TeachingAssistant | null>(null);
  const isAdmin = profile?.role === 'admin';

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
  });

  const fetchData = async () => {
    try {
      const res = await fetch('/api/teaching_assistants');
      const data = await res.json();
      setTAs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching TA data:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      if (editingTA) {
        await fetch(`/api/teaching_assistants/${editingTA.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      } else {
        await fetch('/api/teaching_assistants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            createdAt: Date.now(),
          })
        });
      }
      fetchData();
      closeModal();
    } catch (error) {
      console.error('Error saving TA:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin || !window.confirm('Bạn có chắc muốn xóa trợ giảng này?')) return;
    try {
      await fetch(`/api/teaching_assistants/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Error deleting TA:', error);
    }
  };

  const openEditModal = (ta: TeachingAssistant) => {
    setEditingTA(ta);
    setFormData({
      name: ta.name,
      phone: ta.phone,
      email: ta.email,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingTA(null);
    setFormData({
      name: '',
      phone: '',
      email: '',
    });
  };

  const filteredTAs = tas.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.phone.includes(searchTerm) ||
    t.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Quản lý Trợ giảng</h2>
        {isAdmin && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-[#2D5A4C] text-white px-4 py-2 rounded-lg hover:bg-[#1D4A3C] transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Thêm trợ giảng
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Tìm kiếm trợ giảng..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTAs.map((ta) => (
          <div key={ta.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#2D5A4C]/10 rounded-full flex items-center justify-center text-[#2D5A4C]">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{ta.name}</h3>
                    <p className="text-sm text-gray-500">Trợ giảng</p>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <button onClick={() => openEditModal(ta)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(ta.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Phone className="w-4 h-4" />
                  {ta.phone}
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Mail className="w-4 h-4" />
                  {ta.email}
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
                {editingTA ? 'Sửa thông tin trợ giảng' : 'Thêm trợ giảng mới'}
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
                  {editingTA ? 'Cập nhật' : 'Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
