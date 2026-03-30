import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { 
  Users, 
  Shield, 
  ShieldCheck, 
  UserCog,
  Search,
  Mail,
  User as UserIcon,
  Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';

interface UserManagementProps {
  profile: UserProfile | null;
}

export default function UserManagement({ profile }: UserManagementProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [approvalFilter, setApprovalFilter] = useState<string>('all');

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      setUsers(Array.isArray(data) ? data : []);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching users:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!profile || profile.role !== 'admin') return;
    fetchUsers();
  }, [profile]);

  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

  const handleNameUpdate = async (userId: string) => {
    if (!tempName.trim()) return;
    setUpdatingId(userId);
    try {
      await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: tempName.trim()
        })
      });
      setEditingNameId(null);
      fetchUsers();
    } catch (error) {
      console.error("Error updating name:", error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusChange = async (userId: string, field: 'role' | 'isApproved', value: any) => {
    if (userId === profile?.uid && field === 'role') {
      alert("Bạn không thể tự thay đổi quyền của chính mình.");
      return;
    }

    setUpdatingId(userId);
    try {
      await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [field]: value,
          updatedAt: Date.now()
        })
      });
      fetchUsers();
    } catch (error) {
      console.error("Error updating status:", error);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
     u.email.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (roleFilter === 'all' || u.role === roleFilter) &&
    (approvalFilter === 'all' || (approvalFilter === 'approved' ? u.isApproved : !u.isApproved))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Quản lý người dùng & Phân quyền</h1>
        <p className="text-gray-500">Chỉ quản trị viên mới có quyền thay đổi vai trò của nhân viên.</p>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo tên hoặc email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-500">Lọc theo vai trò:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium"
          >
            <option value="all">Tất cả vai trò</option>
            <option value="admin">Quản trị viên</option>
            <option value="staff">Nhân viên</option>
            <option value="teacher">Giáo viên</option>
            <option value="ta">Trợ giảng</option>
            <option value="collaborator">Cộng tác viên</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-500">Trạng thái:</span>
          <select
            value={approvalFilter}
            onChange={(e) => setApprovalFilter(e.target.value)}
            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="approved">Đã phê duyệt</option>
            <option value="pending">Chờ phê duyệt</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Người dùng</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ngày tham gia</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Vai trò hiện tại</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Trạng thái</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Thao tác</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredUsers.map((u) => (
                <tr key={u.uid} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt="" className="w-10 h-10 rounded-full border border-gray-100" />
                      ) : (
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center border border-gray-100">
                          <UserIcon className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                      <div>
                        {editingNameId === u.uid ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={tempName}
                              onChange={(e) => setTempName(e.target.value)}
                              className="text-sm font-semibold text-gray-900 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleNameUpdate(u.uid);
                                if (e.key === 'Escape') setEditingNameId(null);
                              }}
                            />
                            <button
                              onClick={() => handleNameUpdate(u.uid)}
                              className="text-blue-600 hover:text-blue-700 font-bold text-xs"
                            >
                              Lưu
                            </button>
                            <button
                              onClick={() => setEditingNameId(null)}
                              className="text-gray-400 hover:text-gray-500 text-xs"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group">
                            <p className="text-sm font-semibold text-gray-900">{u.displayName}</p>
                            <button
                              onClick={() => {
                                setEditingNameId(u.uid);
                                setTempName(u.displayName);
                              }}
                              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-all"
                            >
                              <UserCog className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        <p className="text-xs text-gray-500">ID: {u.uid.substring(0, 8)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="w-4 h-4 text-gray-400" />
                        {u.email}
                      </div>
                      {u.createdAt && (
                        <p className="text-xs text-gray-400">
                          {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {u.role === 'admin' ? (
                        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          Quản trị viên
                        </span>
                      ) : u.role === 'teacher' ? (
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold flex items-center gap-1">
                          <UserCog className="w-3 h-3" />
                          Giáo viên
                        </span>
                      ) : u.role === 'ta' ? (
                        <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold flex items-center gap-1">
                          <UserCog className="w-3 h-3" />
                          Trợ giảng
                        </span>
                      ) : u.role === 'collaborator' ? (
                        <span className="px-3 py-1 bg-pink-100 text-pink-700 rounded-full text-xs font-bold flex items-center gap-1">
                          <UserCog className="w-3 h-3" />
                          Cộng tác viên
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-bold flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          Nhân viên
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {u.isApproved ? (
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                          Đã phê duyệt
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-bold">
                          Chờ phê duyệt
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {updatingId === u.uid ? (
                        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      ) : (
                        <>
                          <button
                            onClick={() => handleStatusChange(u.uid, 'isApproved', !u.isApproved)}
                            className={cn(
                              "text-xs font-semibold px-3 py-1.5 rounded-lg transition-all",
                              u.isApproved 
                                ? "bg-red-50 text-red-600 hover:bg-red-100" 
                                : "bg-green-600 text-white hover:bg-green-700 shadow-sm"
                            )}
                          >
                            {u.isApproved ? 'Hủy phê duyệt' : 'Phê duyệt'}
                          </button>
                          <select
                            value={u.role}
                            disabled={u.uid === profile?.uid}
                            onChange={(e) => handleStatusChange(u.uid, 'role', e.target.value as any)}
                            className={cn(
                              "text-xs font-medium border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white",
                              u.uid === profile?.uid && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            <option value="staff">Nhân viên</option>
                            <option value="teacher">Giáo viên</option>
                            <option value="ta">Trợ giảng</option>
                            <option value="collaborator">Cộng tác viên</option>
                            <option value="admin">Quản trị viên</option>
                          </select>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
