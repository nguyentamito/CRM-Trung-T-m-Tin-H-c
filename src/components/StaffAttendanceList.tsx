import React, { useState, useEffect } from 'react';
import { Clock, Calendar as CalendarIcon, Search, Filter, CheckCircle2, AlertCircle, Edit2, X, Save, Info, Download } from 'lucide-react';
import { StaffAttendance, UserProfile } from '../types';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

interface StaffAttendanceListProps {
  staff: UserProfile[];
  profile: UserProfile | null;
}

export default function StaffAttendanceList({ staff, profile }: StaffAttendanceListProps) {
  const [attendance, setAttendance] = useState<StaffAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [editingRecord, setEditingRecord] = useState<StaffAttendance | null>(null);
  const [editForm, setEditForm] = useState({
    checkInTime: '',
    checkOutTime: '',
    adminNote: ''
  });

  const fetchAttendance = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/staff_attendance?date=${dateFilter}`);
      if (res.ok) {
        const data = await res.json();
        setAttendance(data);
      }
    } catch (error) {
      console.error("Error fetching staff attendance:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [dateFilter]);

  const handleEdit = (record: StaffAttendance) => {
    setEditingRecord(record);
    setEditForm({
      checkInTime: format(record.checkInTime, "yyyy-MM-dd'T'HH:mm"),
      checkOutTime: record.checkOutTime ? format(record.checkOutTime, "yyyy-MM-dd'T'HH:mm") : '',
      adminNote: record.adminNote || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;

    try {
      const updatedData = {
        ...editingRecord,
        checkInTime: new Date(editForm.checkInTime).getTime(),
        checkOutTime: editForm.checkOutTime ? new Date(editForm.checkOutTime).getTime() : undefined,
        adminNote: editForm.adminNote,
        isEdited: true,
        editedAt: Date.now(),
        updatedAt: Date.now()
      };

      const res = await fetch(`/api/staff_attendance/${editingRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });

      if (res.ok) {
        setEditingRecord(null);
        fetchAttendance();
      }
    } catch (error) {
      console.error("Error updating attendance:", error);
    }
  };

  const filteredAttendance = attendance.filter(a => {
    const matchesSearch = a.staffName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStaff = staffFilter === 'all' || a.staffId === staffFilter;
    return matchesSearch && matchesStaff;
  });

  const handleExport = () => {
    const headers = ['Nhân viên', 'Ngày', 'Giờ vào', 'Giờ ra', 'Thời gian (phút)', 'Kế hoạch', 'Kết quả', 'Trạng thái', 'Ghi chú admin'];
    const csvData = filteredAttendance.map(a => {
      const duration = a.checkOutTime ? Math.floor((a.checkOutTime - a.checkInTime) / (1000 * 60)) : '';
      return [
        a.staffName,
        a.date,
        format(a.checkInTime, 'HH:mm'),
        a.checkOutTime ? format(a.checkOutTime, 'HH:mm') : '',
        duration,
        a.plan.replace(/,/g, ';'),
        (a.result || '').replace(/,/g, ';'),
        a.status === 'completed' ? 'Hoàn thành' : 'Đang làm',
        (a.adminNote || '').replace(/,/g, ';')
      ].join(',');
    });

    const csvContent = [headers.join(','), ...csvData].join('\n');
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `bao-cao-cham-cong-${dateFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm kiếm nhân viên..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-gray-200">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="text-sm border-none focus:ring-0 p-0 bg-transparent"
            >
              <option value="all">Tất cả nhân viên</option>
              {staff.map(s => (
                <option key={s.uid} value={s.uid}>{s.displayName}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-gray-200">
            <CalendarIcon className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="text-sm border-none focus:ring-0 p-0"
            />
          </div>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg shadow-green-200 transition-all text-sm"
        >
          <Download className="w-4 h-4" />
          Xuất báo cáo
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[1000px] text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Nhân viên</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Giờ vào</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Giờ ra</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Thời gian</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Kế hoạch</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Kết quả</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Trạng thái</th>
                {profile?.role === 'admin' && (
                  <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Thao tác</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={profile?.role === 'admin' ? 8 : 7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                      <p className="text-sm text-gray-500 font-medium">Đang tải dữ liệu...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredAttendance.length === 0 ? (
                <tr>
                  <td colSpan={profile?.role === 'admin' ? 8 : 7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center">
                        <AlertCircle className="w-6 h-6 text-gray-300" />
                      </div>
                      <p className="text-gray-500 font-medium">Không có dữ liệu chấm công cho ngày này</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAttendance.map((record) => {
                  const duration = record.checkOutTime 
                    ? Math.floor((record.checkOutTime - record.checkInTime) / (1000 * 60))
                    : null;
                  const hours = duration ? Math.floor(duration / 60) : 0;
                  const minutes = duration ? duration % 60 : 0;

                  return (
                    <tr key={record.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-bold text-xs">
                              {record.staffName && record.staffName !== '0' ? record.staffName.charAt(0) : '?'}
                            </span>
                          </div>
                          <div>
                            <span className="font-bold text-gray-900">
                              {record.staffName === '0' ? 'Chưa đặt tên' : record.staffName}
                            </span>
                            {record.isEdited && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Đã chỉnh sửa</span>
                                {record.adminNote && (
                                  <div className="group relative">
                                    <Info className="w-3 h-3 text-amber-500 cursor-help" />
                                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-[10px] rounded shadow-xl z-50">
                                      {record.adminNote}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                          <Clock className="w-4 h-4 text-blue-500" />
                          {format(record.checkInTime, 'HH:mm')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                          {record.checkOutTime ? (
                            <>
                              <Clock className="w-4 h-4 text-green-500" />
                              {format(record.checkOutTime, 'HH:mm')}
                            </>
                          ) : (
                            <span className="text-gray-400 italic">Chưa kết công</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-600 font-medium">
                          {duration ? `${hours}h ${minutes}m` : '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600 max-w-[150px] truncate" title={record.plan}>
                          {record.plan}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600 max-w-[150px] truncate" title={record.result}>
                          {record.result || '-'}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1",
                          record.status === 'completed' 
                            ? "bg-green-100 text-green-700" 
                            : "bg-blue-100 text-blue-700"
                        )}>
                          {record.status === 'completed' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              Hoàn thành
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" />
                              Đang làm
                            </>
                          )}
                        </span>
                      </td>
                      {profile?.role === 'admin' && (
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => handleEdit(record)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editingRecord && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-blue-600">
              <h3 className="text-xl font-bold text-white">Điều chỉnh chấm công</h3>
              <button onClick={() => setEditingRecord(null)} className="text-white/80 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Nhân viên</label>
                <p className="text-gray-900 font-medium">{editingRecord.staffName}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Giờ vào</label>
                  <input
                    type="datetime-local"
                    value={editForm.checkInTime}
                    onChange={(e) => setEditForm({ ...editForm, checkInTime: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Giờ ra</label>
                  <input
                    type="datetime-local"
                    value={editForm.checkOutTime}
                    onChange={(e) => setEditForm({ ...editForm, checkOutTime: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Ghi chú điều chỉnh (Nhân viên sẽ thấy)</label>
                <textarea
                  value={editForm.adminNote}
                  onChange={(e) => setEditForm({ ...editForm, adminNote: e.target.value })}
                  placeholder="Lý do điều chỉnh..."
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none min-h-[100px] resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditingRecord(null)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl transition-all"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
