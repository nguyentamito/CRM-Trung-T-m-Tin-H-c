import React, { useState } from 'react';
import { X, Clock, Target, CheckCircle2 } from 'lucide-react';
import { UserProfile, StaffAttendance } from '../types';
import { format } from 'date-fns';

interface StaffAttendanceModalProps {
  profile: UserProfile;
  currentAttendance: StaffAttendance | null;
  onSave: (data: Partial<StaffAttendance>) => Promise<void>;
  onClose: () => void;
}

export default function StaffAttendanceModal({ profile, currentAttendance, onSave, onClose }: StaffAttendanceModalProps) {
  const [plan, setPlan] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const isCheckingIn = !currentAttendance || currentAttendance.status === 'completed';
  const isCheckingOut = currentAttendance && currentAttendance.status === 'active';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isCheckingIn) {
        await onSave({
          staffId: profile.uid,
          staffName: profile.displayName || profile.email,
          date: format(new Date(), 'yyyy-MM-dd'),
          checkInTime: Date.now(),
          plan,
          status: 'active',
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      } else if (isCheckingOut) {
        await onSave({
          ...currentAttendance,
          checkOutTime: Date.now(),
          result,
          status: 'completed',
          updatedAt: Date.now()
        });
      }
      onClose();
    } catch (error) {
      console.error("Error saving attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-blue-600">
          <div className="flex items-center gap-3 text-white">
            <Clock className="w-6 h-6" />
            <h3 className="text-xl font-bold">
              {isCheckingIn ? 'Bắt đầu ngày làm việc' : 'Kết thúc ngày làm việc'}
            </h3>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
              <span className="text-blue-600 font-bold text-lg">
                {profile.displayName?.charAt(0) || profile.email.charAt(0)}
              </span>
            </div>
            <div>
              <p className="font-bold text-gray-900">{profile.displayName || profile.email}</p>
              <p className="text-sm text-gray-500">{format(new Date(), 'dd/MM/yyyy')}</p>
            </div>
          </div>

          {isCheckingIn ? (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                <Target className="w-4 h-4 text-blue-600" />
                Kế hoạch bạn sẽ thực hiện hôm nay
              </label>
              <textarea
                required
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                placeholder="Nhập kế hoạch công việc của bạn..."
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all min-h-[120px] resize-none"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Kế hoạch sáng nay:</p>
                <p className="text-gray-700">{currentAttendance?.plan}</p>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Kết quả công việc hôm nay bạn đã thực hiện
                </label>
                <textarea
                  required
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  placeholder="Nhập kết quả công việc của bạn..."
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all min-h-[120px] resize-none"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {isCheckingIn ? 'Lưu chấm công & Bắt đầu' : 'Lưu kết quả & Kết công'}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
