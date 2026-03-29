import React, { useState, useEffect } from 'react';
import { CenterInfo, UserProfile } from '../types';
import { 
  Building2, 
  MapPin, 
  Globe, 
  Save,
  CheckCircle2,
  AlertCircle,
  User as UserIcon,
  Loader2
} from 'lucide-react';

interface SettingsProps {
  profile: UserProfile | null;
}

export default function Settings({ profile }: SettingsProps) {
  const [centerInfo, setCenterInfo] = useState<CenterInfo>({
    id: 'default',
    name: 'TRUNG TÂM ANH NGỮ ĐH SƯ PHẠM',
    address: '29 Lê Quý Đôn, Quận 3, Thành Phố Hồ Chí Minh',
    website: 'www.anhngusupham.com',
    updatedAt: Date.now()
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    const fetchCenterInfo = async () => {
      try {
        const response = await fetch('/api/settings/center_info');
        if (response.ok) {
          const data = await response.json();
          if (data && !data.error) setCenterInfo(data);
        }
      } catch (error) {
        console.error("Error fetching center info:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCenterInfo();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/settings/center_info', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...centerInfo,
          updatedAt: Date.now()
        })
      });
      if (response.ok) {
        setMessage({ type: 'success', text: 'Cập nhật thông tin trung tâm thành công!' });
      } else {
        throw new Error('Failed to update');
      }
    } catch (error) {
      console.error("Error updating center info:", error);
      setMessage({ type: 'error', text: 'Có lỗi xảy ra khi cập nhật thông tin.' });
    } finally {
      setSaving(false);
    }
  };

  const [userDisplayName, setUserDisplayName] = useState(profile?.displayName || '');
  const [updatingProfile, setUpdatingProfile] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setUpdatingProfile(true);
    try {
      const response = await fetch(`/api/users/${profile.uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...profile,
          displayName: userDisplayName
        })
      });
      if (response.ok) {
        setMessage({ type: 'success', text: 'Cập nhật thông tin cá nhân thành công!' });
      } else {
        throw new Error('Failed to update profile');
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      setMessage({ type: 'error', text: 'Có lỗi xảy ra khi cập nhật thông tin cá nhân.' });
    } finally {
      setUpdatingProfile(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2D5A4C]"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Cài đặt</h2>
        <p className="text-gray-600">Quản lý thông tin cá nhân và hệ thống.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-blue-600" />
            Thông tin cá nhân
          </h3>
        </div>
        <form onSubmit={handleUpdateProfile} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên hiển thị</label>
            <input
              type="text"
              value={userDisplayName}
              onChange={(e) => setUserDisplayName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="Nhập tên của bạn..."
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={updatingProfile}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-medium disabled:opacity-50"
            >
              {updatingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Cập nhật tên
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#2D5A4C]" />
            Thông tin trung tâm
          </h3>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          {message && (
            <div className={`p-4 rounded-xl flex items-center gap-3 ${
              message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              <span className="text-sm font-medium">{message.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên trung tâm *</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  required
                  disabled={!isAdmin}
                  value={centerInfo.name}
                  onChange={(e) => setCenterInfo({ ...centerInfo, name: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2D5A4C] focus:border-transparent outline-none transition-all disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="Nhập tên trung tâm..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ *</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  required
                  disabled={!isAdmin}
                  value={centerInfo.address}
                  onChange={(e) => setCenterInfo({ ...centerInfo, address: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2D5A4C] focus:border-transparent outline-none transition-all disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="Nhập địa chỉ trung tâm..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Website *</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  required
                  disabled={!isAdmin}
                  value={centerInfo.website}
                  onChange={(e) => setCenterInfo({ ...centerInfo, website: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#2D5A4C] focus:border-transparent outline-none transition-all disabled:bg-gray-50 disabled:text-gray-500"
                  placeholder="www.example.com"
                />
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="pt-4 border-t border-gray-100 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#2D5A4C] text-white rounded-xl hover:bg-[#23463a] transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                Lưu thay đổi
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
