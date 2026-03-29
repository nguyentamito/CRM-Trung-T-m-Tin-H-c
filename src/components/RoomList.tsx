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
import { Room, RoomType, UserProfile } from '../types';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X, 
  MapPin, 
  Link as LinkIcon,
  Monitor,
  BookOpen,
  Globe,
  User,
  Building
} from 'lucide-react';

interface RoomListProps {
  profile: UserProfile | null;
}

const ROOM_TYPES: RoomType[] = ['Phòng máy tính', 'Phòng lý thuyết', 'Phòng Online', 'Gia Sư', 'Doanh nghiệp'];

const getRoomIcon = (type: RoomType) => {
  switch (type) {
    case 'Phòng máy tính': return <Monitor className="w-5 h-5" />;
    case 'Phòng lý thuyết': return <BookOpen className="w-5 h-5" />;
    case 'Phòng Online': return <Globe className="w-5 h-5" />;
    case 'Gia Sư': return <User className="w-5 h-5" />;
    case 'Doanh nghiệp': return <Building className="w-5 h-5" />;
    default: return <MapPin className="w-5 h-5" />;
  }
};

export default function RoomList({ profile }: RoomListProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const isAdmin = profile?.role === 'admin';

  const [formData, setFormData] = useState({
    name: '',
    type: 'Phòng lý thuyết' as RoomType,
    location: '',
  });

  useEffect(() => {
    const q = query(collection(db, 'rooms'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRooms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Room)));
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const data = {
      ...formData,
      updatedAt: Date.now(),
    };

    try {
      if (editingRoom) {
        await updateDoc(doc(db, 'rooms', editingRoom.id), data);
      } else {
        await addDoc(collection(db, 'rooms'), {
          ...data,
          createdAt: Date.now(),
        });
      }
      closeModal();
    } catch (error) {
      handleFirestoreError(error, editingRoom ? OperationType.UPDATE : OperationType.CREATE, 'rooms');
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin || !window.confirm('Bạn có chắc muốn xóa phòng học này?')) return;
    try {
      await deleteDoc(doc(db, 'rooms', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `rooms/${id}`);
    }
  };

  const openEditModal = (room: Room) => {
    setEditingRoom(room);
    setFormData({
      name: room.name,
      type: room.type,
      location: room.location,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingRoom(null);
    setFormData({
      name: '',
      type: 'Phòng lý thuyết',
      location: '',
    });
  };

  const filteredRooms = rooms.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Quản lý Phòng học</h2>
        {isAdmin && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-[#2D5A4C] text-white px-4 py-2 rounded-lg hover:bg-[#1D4A3C] transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Thêm phòng học mới
          </button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Tìm kiếm phòng học..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#2D5A4C] border-b border-[#2D5A4C]">
                <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider border-r border-[#3D6A5C]">Tên phòng</th>
                <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider border-r border-[#3D6A5C]">Loại phòng</th>
                <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider border-r border-[#3D6A5C]">Vị trí / Link</th>
                <th className="px-6 py-4 text-xs font-bold text-white uppercase tracking-wider text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRooms.map((room) => (
                <tr key={room.id} className="hover:bg-gray-50/50 transition-all border-b border-gray-100">
                  <td className="px-6 py-4 border-r border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        room.type === 'Phòng máy tính' ? 'bg-blue-100 text-blue-600' :
                        room.type === 'Phòng lý thuyết' ? 'bg-green-100 text-green-600' :
                        room.type === 'Phòng Online' ? 'bg-purple-100 text-purple-600' :
                        room.type === 'Gia Sư' ? 'bg-orange-100 text-orange-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {getRoomIcon(room.type)}
                      </div>
                      <span className="font-bold text-gray-900">{room.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 border-r border-gray-100">
                    <span className="text-sm text-gray-600">{room.type}</span>
                  </td>
                  <td className="px-6 py-4 border-r border-gray-100">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      {room.type === 'Phòng Online' ? <LinkIcon className="w-4 h-4 shrink-0" /> : <MapPin className="w-4 h-4 shrink-0" />}
                      <span className="truncate max-w-[200px]">{room.location}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isAdmin && (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => openEditModal(room)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Sửa">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(room.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Xóa">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filteredRooms.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500 italic">
                    Không tìm thấy phòng học nào phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-[#2D5A4C] text-white">
              <h3 className="text-xl font-bold">{editingRoom ? 'Sửa phòng học' : 'Thêm phòng học mới'}</h3>
              <button onClick={closeModal} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Tên phòng học</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                  placeholder="VD: Phòng 101, Zoom Meeting..."
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Loại phòng</label>
                <select
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as RoomType })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                >
                  {ROOM_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  {formData.type === 'Phòng Online' ? 'Link phòng học' : 'Địa chỉ / Vị trí'}
                </label>
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                  placeholder={formData.type === 'Phòng Online' ? 'https://zoom.us/j/...' : 'Tầng 1, Tòa nhà A...'}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#2D5A4C] text-white rounded-xl hover:bg-[#1D4A3C] transition-colors shadow-lg font-bold"
                >
                  {editingRoom ? 'Cập nhật' : 'Thêm mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
