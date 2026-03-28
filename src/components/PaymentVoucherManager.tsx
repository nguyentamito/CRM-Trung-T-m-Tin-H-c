import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  orderBy,
  where,
  doc,
  getDocs
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { PaymentVoucher, UserProfile, PaymentCategory, PaymentMethod, CenterInfo, Teacher, TeachingAssistant } from '../types';
import { 
  Plus, 
  Search, 
  FileText, 
  Calendar, 
  User, 
  DollarSign, 
  CreditCard, 
  Filter,
  X,
  Printer,
  ChevronLeft,
  ChevronRight,
  Edit2,
  ArrowUpRight,
  Users
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import { cn, formatNumber } from '../lib/utils';
import { printPaymentVoucher } from './PaymentVoucherPrint';

interface PaymentVoucherManagerProps {
  profile: UserProfile | null;
}

export default function PaymentVoucherManager({ profile }: PaymentVoucherManagerProps) {
  const [vouchers, setVouchers] = useState<PaymentVoucher[]>([]);
  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [tas, setTas] = useState<TeachingAssistant[]>([]);
  const [centerInfo, setCenterInfo] = useState<CenterInfo>({
    id: 'default',
    name: 'TRUNG TÂM ANH NGỮ ĐH SƯ PHẠM',
    address: '29 Lê Quý Đôn, Quận 3, Thành Phố Hồ Chí Minh',
    website: 'www.anhngusupham.com',
    updatedAt: Date.now()
  });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<PaymentVoucher | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  
  const [formData, setFormData] = useState({
    category: 'lương nhân viên' as PaymentCategory,
    recipientName: '',
    recipientId: '',
    amount: 0,
    description: '',
    paymentMethod: 'tiền mặt' as PaymentMethod,
  });

  const isAdmin = profile?.role === 'admin';
  const isStaff = profile?.role === 'staff';

  useEffect(() => {
    if (!profile) return;

    const qVouchers = query(collection(db, 'payment_vouchers'), orderBy('createdAt', 'desc'));
    const unsubscribeVouchers = onSnapshot(qVouchers, (snapshot) => {
      setVouchers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentVoucher)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'payment_vouchers');
    });

    const unsubscribeCenterInfo = onSnapshot(doc(db, 'center_info', 'default'), (docSnap) => {
      if (docSnap.exists()) {
        setCenterInfo({ id: docSnap.id, ...docSnap.data() } as CenterInfo);
      }
    });

    // Fetch recipients for salary
    const fetchRecipients = async () => {
      try {
        const staffSnap = await getDocs(collection(db, 'users'));
        setStaffList(staffSnap.docs.map(doc => doc.data() as UserProfile));
        
        const teacherSnap = await getDocs(collection(db, 'teachers'));
        setTeachers(teacherSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Teacher)));
        
        const taSnap = await getDocs(collection(db, 'teaching_assistants'));
        setTas(taSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeachingAssistant)));
      } catch (error) {
        console.error("Error fetching recipients:", error);
      }
    };
    fetchRecipients();

    return () => {
      unsubscribeVouchers();
      unsubscribeCenterInfo();
    };
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || (!isAdmin && !isStaff)) return;

    const data = {
      category: formData.category,
      recipientName: formData.recipientName,
      recipientId: formData.recipientId || '',
      amount: formData.amount,
      description: formData.description,
      paymentMethod: formData.paymentMethod,
      staffId: profile.uid,
      staffName: profile.displayName || profile.email || 'Unknown',
      updatedAt: Date.now()
    };

    try {
      if (selectedVoucher) {
        await updateDoc(doc(db, 'payment_vouchers', selectedVoucher.id), {
          ...data,
          voucherNumber: selectedVoucher.voucherNumber
        });
      } else {
        const voucherNumber = `PC-${format(new Date(), 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;
        await addDoc(collection(db, 'payment_vouchers'), { 
          ...data, 
          voucherNumber,
          createdAt: Date.now() 
        });
      }
      setIsModalOpen(false);
      setSelectedVoucher(null);
      setFormData({
        category: 'lương nhân viên',
        recipientName: '',
        recipientId: '',
        amount: 0,
        description: '',
        paymentMethod: 'tiền mặt',
      });
    } catch (error) {
      handleFirestoreError(error, selectedVoucher ? OperationType.UPDATE : OperationType.CREATE, 'payment_vouchers');
    }
  };

  const filteredVouchers = vouchers.filter(v => {
    const matchesSearch = v.recipientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         v.voucherNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         v.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || v.category === categoryFilter;
    
    const voucherDate = new Date(v.createdAt);
    const startDate = startOfDay(parseISO(dateRange.start));
    const endDate = endOfDay(parseISO(dateRange.end));
    const matchesDate = isWithinInterval(voucherDate, { start: startDate, end: endDate });

    return matchesSearch && matchesCategory && matchesDate;
  });

  const totalSpent = filteredVouchers.reduce((sum, v) => sum + v.amount, 0);

  const openEditModal = (voucher: PaymentVoucher) => {
    setSelectedVoucher(voucher);
    setFormData({
      category: voucher.category,
      recipientName: voucher.recipientName,
      recipientId: voucher.recipientId || '',
      amount: voucher.amount,
      description: voucher.description,
      paymentMethod: voucher.paymentMethod,
    });
    setIsModalOpen(true);
  };

  const categories: PaymentCategory[] = [
    'lương nhân viên', 'lương giáo viên', 'lương trợ giảng', 
    'tiền nhà', 'tiền điện', 'tiền nước', 
    'văn phòng phẩm', 'marketing', 'khác'
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Quản lý Phiếu chi</h2>
          <p className="text-gray-500">Ghi nhận các khoản chi phí của trung tâm</p>
        </div>
        {(isAdmin || isStaff) && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            <Plus size={20} />
            Tạo phiếu chi
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-50 text-red-600 rounded-lg">
              <ArrowUpRight size={20} />
            </div>
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Tổng chi</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{formatNumber(totalSpent)} VNĐ</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <FileText size={20} />
            </div>
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Số phiếu chi</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{filteredVouchers.length}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Users size={20} />
            </div>
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Chi lương</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {filteredVouchers.filter(v => v.category.includes('lương')).length} phiếu
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-end">
          <div className="relative flex-1 w-full">
            <label className="block text-xs font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
              <Search size={12} /> Tìm kiếm
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Tìm theo người nhận, số phiếu, nội dung..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 w-full md:w-auto">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
                <Calendar size={12} /> Từ ngày
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
                <Calendar size={12} /> Đến ngày
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
                <Filter size={12} /> Danh mục
              </label>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full pl-10 pr-8 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600 appearance-none bg-white capitalize"
                >
                  <option value="all">Tất cả danh mục</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Số phiếu / Ngày</th>
                <th className="px-6 py-4 font-semibold">Người nhận / Danh mục</th>
                <th className="px-6 py-4 font-semibold">Số tiền</th>
                <th className="px-6 py-4 font-semibold">Nội dung</th>
                <th className="px-6 py-4 font-semibold">Hình thức</th>
                <th className="px-6 py-4 font-semibold">Người chi</th>
                <th className="px-6 py-4 font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredVouchers.map((voucher) => (
                <tr key={voucher.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-red-600">{voucher.voucherNumber}</div>
                    <div className="text-xs text-gray-500">
                      {format(voucher.createdAt, 'dd/MM/yyyy HH:mm')}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{voucher.recipientName}</div>
                    <div className="text-xs text-red-600 font-medium capitalize">{voucher.category}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-red-600">{formatNumber(voucher.amount)} VNĐ</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600 max-w-xs truncate" title={voucher.description}>
                      {voucher.description}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 capitalize">
                    {voucher.paymentMethod}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {voucher.staffName}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => openEditModal(voucher)}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors" 
                        title="Chỉnh sửa phiếu chi"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => printPaymentVoucher(voucher, centerInfo)}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors" 
                        title="In phiếu chi"
                      >
                        <Printer size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredVouchers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    Không tìm thấy phiếu chi nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-red-600 text-white">
              <h3 className="text-xl font-bold">{selectedVoucher ? 'Chỉnh sửa Phiếu Chi' : 'Tạo Phiếu Chi Mới'}</h3>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedVoucher(null);
                }} 
                className="hover:bg-white/20 p-1 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Danh mục chi *</label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => {
                      const category = e.target.value as PaymentCategory;
                      setFormData({ ...formData, category, recipientId: '', recipientName: '' });
                    }}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600 capitalize"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hình thức *</label>
                  <select
                    required
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as PaymentMethod })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600 capitalize"
                  >
                    <option value="tiền mặt">Tiền mặt</option>
                    <option value="chuyển khoản">Chuyển khoản</option>
                    <option value="khác">Khác</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Người nhận tiền *</label>
                {formData.category === 'lương nhân viên' ? (
                  <select
                    required
                    value={formData.recipientId}
                    onChange={(e) => {
                      const staff = staffList.find(s => s.uid === e.target.value);
                      setFormData({ 
                        ...formData, 
                        recipientId: e.target.value, 
                        recipientName: staff?.displayName || staff?.email || '' 
                      });
                    }}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                  >
                    <option value="">Chọn nhân viên</option>
                    {staffList.map(s => (
                      <option key={s.uid} value={s.uid}>{s.displayName || s.email}</option>
                    ))}
                  </select>
                ) : formData.category === 'lương giáo viên' ? (
                  <select
                    required
                    value={formData.recipientId}
                    onChange={(e) => {
                      const teacher = teachers.find(t => t.id === e.target.value);
                      setFormData({ 
                        ...formData, 
                        recipientId: e.target.value, 
                        recipientName: teacher?.name || '' 
                      });
                    }}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                  >
                    <option value="">Chọn giáo viên</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                ) : formData.category === 'lương trợ giảng' ? (
                  <select
                    required
                    value={formData.recipientId}
                    onChange={(e) => {
                      const ta = tas.find(t => t.id === e.target.value);
                      setFormData({ 
                        ...formData, 
                        recipientId: e.target.value, 
                        recipientName: ta?.name || '' 
                      });
                    }}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                  >
                    <option value="">Chọn trợ giảng</option>
                    {tas.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={formData.recipientName}
                    onChange={(e) => setFormData({ ...formData, recipientName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                    placeholder="Nhập tên người nhận..."
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền chi (VNĐ) *</label>
                <input
                  type="number"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung chi *</label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
                  rows={3}
                  placeholder="Lý do chi, chi cho tháng nào, hóa đơn số mấy..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedVoucher(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  {selectedVoucher ? 'Cập nhật' : 'Lưu phiếu chi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
