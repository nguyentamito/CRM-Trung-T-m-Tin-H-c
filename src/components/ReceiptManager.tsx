import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  deleteDoc,
  orderBy,
  where,
  doc,
  getDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Receipt, Customer, UserProfile, ReceiptType, PaymentMethod, CenterInfo } from '../types';
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
  Trash2,
  Paperclip,
  Eye
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import { cn, formatNumber } from '../lib/utils';
import { printReceipt } from './ReceiptPrint';

interface ReceiptManagerProps {
  profile: UserProfile | null;
}

export default function ReceiptManager({ profile }: ReceiptManagerProps) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [centerInfo, setCenterInfo] = useState<CenterInfo>({
    id: 'default',
    name: 'TRUNG TÂM ANH NGỮ ĐH SƯ PHẠM',
    address: '29 Lê Quý Đôn, Quận 3, Thành Phố Hồ Chí Minh',
    website: 'www.anhngusupham.com',
    updatedAt: Date.now()
  });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [receiptToDelete, setReceiptToDelete] = useState<Receipt | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  
  const [formData, setFormData] = useState({
    customerId: '',
    amount: 0,
    type: 'đóng 100%' as ReceiptType,
    paymentMethod: 'chuyển khoản' as PaymentMethod,
    note: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    attachmentUrl: ''
  });

  const isAdmin = profile?.role === 'admin';
  const isStaff = profile?.role === 'staff';

  useEffect(() => {
    if (!profile) return;

    const qReceipts = query(collection(db, 'receipts'), orderBy('createdAt', 'desc'));
    const unsubscribeReceipts = onSnapshot(qReceipts, (snapshot) => {
      setReceipts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Receipt)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'receipts');
    });

    const qCustomers = profile.role === 'admin'
      ? query(collection(db, 'customers'), orderBy('name', 'asc'))
      : query(collection(db, 'customers'), where('ownerId', '==', profile.uid), orderBy('name', 'asc'));

    const unsubscribeCustomers = onSnapshot(qCustomers, (snapshot) => {
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'customers');
    });

    const unsubscribeCenterInfo = onSnapshot(doc(db, 'center_info', 'default'), (docSnap) => {
      if (docSnap.exists()) {
        setCenterInfo({ id: docSnap.id, ...docSnap.data() } as CenterInfo);
      }
    });

    return () => {
      unsubscribeReceipts();
      unsubscribeCustomers();
      unsubscribeCenterInfo();
    };
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || (!isAdmin && !isStaff)) return;

    const customer = customers.find(c => c.id === formData.customerId);
    if (!customer) return;

    const totalAmount = parseInt(customer.closedAmount.replace(/\D/g, '')) || 0;
    
    // Calculate total already paid by this customer (excluding the current receipt if editing)
    const totalPaid = receipts
      .filter(r => r.customerId === customer.id && r.id !== selectedReceipt?.id)
      .reduce((sum, r) => sum + r.amount, 0);
    
    const remainingAmount = totalAmount - totalPaid - formData.amount;

    const data = {
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone || '',
      subject: customer.subject || '',
      amount: formData.amount,
      totalAmount: totalAmount,
      remainingAmount: remainingAmount,
      type: formData.type,
      paymentMethod: formData.paymentMethod,
      note: formData.note || '',
      attachmentUrl: formData.attachmentUrl || '',
      staffId: profile.uid,
      staffName: profile.displayName || profile.email || 'Unknown',
      date: new Date(formData.date).getTime(),
      status: isAdmin ? 'approved' : 'pending',
      updatedAt: Date.now()
    };

    try {
      if (selectedReceipt) {
        const receiptNumber = selectedReceipt.receiptNumber || `PT-${format(new Date(selectedReceipt.date || selectedReceipt.createdAt || Date.now()), 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;
        await updateDoc(doc(db, 'receipts', selectedReceipt.id), {
          ...data,
          receiptNumber
        });
      } else {
        const receiptNumber = `PT-${format(new Date(data.date), 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;
        await addDoc(collection(db, 'receipts'), { 
          ...data, 
          receiptNumber,
          createdAt: Date.now() 
        });
      }
      setIsModalOpen(false);
      setSelectedReceipt(null);
      setFormData({
        customerId: '',
        amount: 0,
        type: 'đóng 100%',
        paymentMethod: 'chuyển khoản',
        note: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        attachmentUrl: ''
      });
    } catch (error) {
      handleFirestoreError(error, selectedReceipt ? OperationType.UPDATE : OperationType.CREATE, 'receipts');
    }
  };

  const filteredReceipts = receipts.filter(r => {
    const matchesSearch = r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         r.customerPhone.includes(searchTerm) ||
                         (r.receiptNumber && r.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = typeFilter === 'all' || r.type === typeFilter;
    
    const receiptDate = new Date(r.date || r.createdAt);
    const startDate = startOfDay(parseISO(dateRange.start));
    const endDate = endOfDay(parseISO(dateRange.end));
    const matchesDate = isWithinInterval(receiptDate, { start: startDate, end: endDate });

    return matchesSearch && matchesType && matchesDate;
  });

  const totalCollected = filteredReceipts.reduce((sum, r) => sum + r.amount, 0);

  const openEditModal = (receipt: Receipt) => {
    if (!isAdmin) return;
    setSelectedReceipt(receipt);
    setFormData({
      customerId: receipt.customerId,
      amount: receipt.amount,
      type: receipt.type,
      paymentMethod: receipt.paymentMethod,
      note: receipt.note || '',
      date: format(receipt.date || receipt.createdAt, 'yyyy-MM-dd'),
      attachmentUrl: receipt.attachmentUrl || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!receiptToDelete) return;
    try {
      await deleteDoc(doc(db, 'receipts', receiptToDelete.id));
      setIsDeleteModalOpen(false);
      setReceiptToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'receipts');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit file size to 800KB to stay safe within Firestore 1MB limit
    if (file.size > 800 * 1024) {
      alert('Kích thước file quá lớn (tối đa 800KB). Vui lòng chọn file nhỏ hơn.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ ...formData, attachmentUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2D5A4C]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Quản lý Phiếu thu</h2>
          <p className="text-gray-500">Theo dõi các khoản thu học phí từ khách hàng</p>
        </div>
        {(isAdmin || isStaff) && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-[#2D5A4C] text-white px-4 py-2 rounded-lg hover:bg-[#23463a] transition-colors"
          >
            <Plus size={20} />
            Tạo phiếu thu
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-50 text-green-600 rounded-lg">
              <DollarSign size={20} />
            </div>
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Tổng thu</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{formatNumber(totalCollected)} VNĐ</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <FileText size={20} />
            </div>
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Số phiếu thu</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{filteredReceipts.length}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <CreditCard size={20} />
            </div>
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">Chuyển khoản</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {filteredReceipts.filter(r => r.paymentMethod === 'chuyển khoản').length} phiếu
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
                placeholder="Tìm theo tên khách hàng, số điện thoại..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
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
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
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
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
                <Filter size={12} /> Loại thu
              </label>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full pl-10 pr-8 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C] appearance-none bg-white"
                >
                  <option value="all">Tất cả loại</option>
                  <option value="cọc">Cọc</option>
                  <option value="đóng tất">Đóng tất</option>
                  <option value="đóng 100%">Đóng 100%</option>
                  <option value="thu khác">Thu khác</option>
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
                <th className="px-6 py-4 font-semibold">Khách hàng / Môn</th>
                <th className="px-6 py-4 font-semibold">Số tiền</th>
                <th className="px-6 py-4 font-semibold">Còn lại</th>
                <th className="px-6 py-4 font-semibold">Loại</th>
                <th className="px-6 py-4 font-semibold">Hình thức</th>
                <th className="px-6 py-4 font-semibold">Người thu</th>
                <th className="px-6 py-4 font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredReceipts.map((receipt) => (
                <tr key={receipt.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-blue-600">{receipt.receiptNumber || 'N/A'}</div>
                    <div className="text-xs text-gray-500">
                      {format(receipt.date || receipt.createdAt, 'dd/MM/yyyy')}
                    </div>
                    {receipt.status === 'pending' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 mt-1">
                        Chờ duyệt
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{receipt.customerName}</div>
                    <div className="text-xs text-[#2D5A4C] font-medium">{receipt.subject}</div>
                    <div className="text-xs text-gray-500">{receipt.customerPhone}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-[#2D5A4C]">{formatNumber(receipt.amount)} VNĐ</div>
                    <div className="text-xs text-gray-400">Tổng: {formatNumber(receipt.totalAmount)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-orange-600">
                      {formatNumber(receipt.remainingAmount)} VNĐ
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium",
                      receipt.type === 'đóng 100%' ? "bg-green-100 text-green-700" :
                      receipt.type === 'đóng tất' ? "bg-blue-100 text-blue-700" :
                      "bg-orange-100 text-orange-700"
                    )}>
                      {receipt.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 capitalize">
                    {receipt.paymentMethod}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {receipt.staffName}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {isAdmin && (
                        <>
                          <button 
                            onClick={() => openEditModal(receipt)}
                            className="p-2 text-gray-400 hover:text-blue-600 transition-colors" 
                            title="Chỉnh sửa phiếu thu"
                          >
                            <Edit2 size={18} />
                          </button>
                          {receipt.status === 'pending' && (
                            <button 
                              onClick={async () => {
                                try {
                                  await updateDoc(doc(db, 'receipts', receipt.id), { status: 'approved', updatedAt: Date.now() });
                                } catch (error) {
                                  handleFirestoreError(error, OperationType.UPDATE, 'receipts');
                                }
                              }}
                              className="p-2 text-gray-400 hover:text-green-600 transition-colors" 
                              title="Duyệt phiếu thu"
                            >
                              <Plus size={18} />
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              setReceiptToDelete(receipt);
                              setIsDeleteModalOpen(true);
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors" 
                            title="Xóa phiếu thu"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                      {receipt.attachmentUrl && (
                        <button 
                          onClick={() => window.open(receipt.attachmentUrl, '_blank')}
                          className="p-2 text-gray-400 hover:text-blue-600 transition-colors" 
                          title="Xem chứng từ"
                        >
                          <Eye size={18} />
                        </button>
                      )}
                      <button 
                        onClick={() => printReceipt(receipt, centerInfo)}
                        className="p-2 text-gray-400 hover:text-[#2D5A4C] transition-colors" 
                        title="In phiếu thu"
                      >
                        <Printer size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredReceipts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    Không tìm thấy phiếu thu nào
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
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-[#2D5A4C] text-white">
              <h3 className="text-xl font-bold">{selectedReceipt ? 'Chỉnh sửa Phiếu Thu' : 'Tạo Phiếu Thu Mới'}</h3>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setSelectedReceipt(null);
                }} 
                className="hover:bg-white/20 p-1 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Khách hàng *</label>
                <select
                  required
                  disabled={!!selectedReceipt}
                  value={formData.customerId}
                  onChange={(e) => {
                    const customer = customers.find(c => c.id === e.target.value);
                    if (customer) {
                      const totalAmount = parseInt(customer.closedAmount.replace(/\D/g, '')) || 0;
                      const totalPaid = receipts
                        .filter(r => r.customerId === customer.id)
                        .reduce((sum, r) => sum + r.amount, 0);
                      
                      const remaining = totalAmount - totalPaid;
                      setFormData({ 
                        ...formData, 
                        customerId: e.target.value, 
                        amount: remaining > 0 ? remaining : 0 
                      });
                    } else {
                      setFormData({ ...formData, customerId: e.target.value });
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                >
                  <option value="">Chọn khách hàng</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} - {c.phone} ({formatNumber(c.closedAmount)})</option>
                  ))}
                </select>
              </div>

              {formData.customerId && (
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Môn học</p>
                      <p className="font-bold text-[#2D5A4C]">{customers.find(c => c.id === formData.customerId)?.subject}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Đã thu trước đó</p>
                      <p className="font-bold text-blue-600">
                        {formatNumber(receipts.filter(r => r.customerId === formData.customerId).reduce((sum, r) => sum + r.amount, 0))} VNĐ
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày thu *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền thu (VNĐ) *</label>
                  <input
                    type="number"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loại thu *</label>
                <select
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as ReceiptType })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                >
                  <option value="cọc">Cọc</option>
                  <option value="đóng tất">Đóng tất</option>
                  <option value="đóng 100%">Đóng 100%</option>
                  <option value="thu khác">Thu khác</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hình thức thanh toán *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['tiền mặt', 'chuyển khoản', 'khác'] as PaymentMethod[]).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setFormData({ ...formData, paymentMethod: method })}
                      className={cn(
                        "py-2 px-3 text-sm rounded-lg border transition-all capitalize",
                        formData.paymentMethod === method 
                          ? "bg-[#2D5A4C] text-white border-[#2D5A4C]" 
                          : "bg-white text-gray-600 border-gray-200 hover:border-[#2D5A4C]"
                      )}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                  rows={2}
                  placeholder="Thông tin thêm về khoản thu..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chứng từ (Tùy chọn)</label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-200 rounded-lg hover:border-[#2D5A4C] hover:bg-gray-50 cursor-pointer transition-all">
                    <Paperclip size={18} className="text-gray-400" />
                    <span className="text-sm text-gray-500 font-medium">
                      {formData.attachmentUrl ? 'Đã chọn chứng từ' : 'Tải lên chứng từ (Ảnh/PDF)'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  {formData.attachmentUrl && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, attachmentUrl: '' })}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Xóa chứng từ"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
                {formData.attachmentUrl && formData.attachmentUrl.startsWith('data:image') && (
                  <div className="mt-2 relative w-20 h-20 rounded-lg overflow-hidden border border-gray-100">
                    <img src={formData.attachmentUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelectedReceipt(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#2D5A4C] text-white rounded-lg hover:bg-[#23463a] transition-colors font-medium"
                >
                  {selectedReceipt ? 'Cập nhật' : 'Lưu phiếu thu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Xác nhận xóa</h2>
              <button onClick={() => setIsDeleteModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-600">
                Bạn có chắc chắn muốn xóa phiếu thu <span className="font-bold text-gray-900">{receiptToDelete?.receiptNumber}</span>? 
                Hành động này không thể hoàn tác.
              </p>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Xác nhận xóa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
