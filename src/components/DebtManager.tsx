import React, { useState, useMemo } from 'react';
import { 
  Wallet, 
  Search, 
  Filter, 
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  User,
  Phone,
  BookOpen,
  Plus,
  Eye,
  X,
  DollarSign,
  Calendar,
  CreditCard,
  FileText
} from 'lucide-react';
import { Customer, Receipt, UserProfile, ReceiptType, PaymentMethod } from '../types';
import { cn, formatNumber } from '../lib/utils';
import { format, parseISO } from 'date-fns';

interface DebtManagerProps {
  profile: UserProfile | null;
}

export default function DebtManager({ profile }: DebtManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  
  const [formData, setFormData] = useState({
    amount: 0,
    type: 'đóng tất' as ReceiptType,
    paymentMethod: 'chuyển khoản' as PaymentMethod,
    note: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  const fetchData = async () => {
    try {
      const ownerIdParam = profile?.role === 'admin' ? '' : `?ownerId=${profile?.uid}`;
      const [custRes, rectRes] = await Promise.all([
        fetch(`/api/customers${ownerIdParam}`),
        fetch('/api/receipts')
      ]);
      
      if (custRes.ok && rectRes.ok) {
        const custData = await custRes.json();
        const rectData = await rectRes.json();
        setCustomers(Array.isArray(custData) ? custData : []);
        setReceipts(Array.isArray(rectData) ? rectData : []);
      }
    } catch (err) {
      console.error("Error fetching debt data:", err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [profile]);

  const debtList = useMemo(() => {
    return customers
      .filter(c => ['Đã chốt', 'Đã đóng tiền', 'Đã cọc'].includes(c.status))
      .map(customer => {
        const totalTuition = Number(customer.closedAmount || 0);
        const customerReceipts = receipts.filter(r => r.customerId === customer.id && r.status === 'approved' && r.type !== 'thu khác');
        const collectedTuition = customerReceipts.reduce((sum, r) => sum + Number(r.amount || 0), 0);
        
        const debt = totalTuition - collectedTuition;
        return {
          ...customer,
          totalTuition,
          collectedTuition,
          debt,
          history: customerReceipts.sort((a, b) => (b.date || b.createdAt) - (a.date || a.createdAt))
        };
      })
      .filter(item => item.debt > 0 && item.collectedTuition > 0)
      .filter(item => {
        const matchesSearch = 
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.phone.includes(searchTerm);
        return matchesSearch;
      })
      .sort((a, b) => b.debt - a.debt);
  }, [customers, receipts, searchTerm]);

  const totalDebt = useMemo(() => {
    return debtList.reduce((sum, item) => sum + item.debt, 0);
  }, [debtList]);

  const handleStartEdit = (item: any) => {
    setEditingId(item.id);
    setEditValue(item.closedAmount || '0');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleUpdateClosedAmount = async (id: string) => {
    try {
      const response = await fetch(`/api/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closedAmount: editValue }),
      });

      if (response.ok) {
        setEditingId(null);
        fetchData();
      } else {
        alert('Lỗi khi cập nhật số tiền chốt');
      }
    } catch (error) {
      console.error('Error updating closed amount:', error);
    }
  };

  const handleCollectMoney = (customer: any) => {
    setSelectedCustomer(customer);
    setFormData({
      amount: customer.debt,
      type: 'đóng tất',
      paymentMethod: 'chuyển khoản',
      note: '',
      date: format(new Date(), 'yyyy-MM-dd')
    });
    setIsCollectModalOpen(true);
  };

  const handleViewHistory = (customer: any) => {
    setSelectedCustomer(customer);
    setIsHistoryModalOpen(true);
  };

  const handleSubmitReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedCustomer) return;

    const selectedDate = parseISO(formData.date);
    const receiptNumber = `PT-${format(selectedDate, 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;
    
    const data = {
      receiptNumber,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      customerPhone: selectedCustomer.phone || '',
      subject: selectedCustomer.subject || '',
      amount: formData.amount,
      totalAmount: selectedCustomer.totalTuition,
      remainingAmount: selectedCustomer.debt - formData.amount,
      type: formData.type,
      paymentMethod: formData.paymentMethod,
      note: formData.note || '',
      staffId: profile.uid,
      staffName: profile.displayName || profile.email || 'Unknown',
      date: selectedDate.getTime(),
      status: profile.role === 'admin' ? 'approved' : 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    try {
      const response = await fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setIsCollectModalOpen(false);
        fetchData(); // Refresh data
      } else {
        const errorData = await response.json();
        alert(`Lỗi khi tạo phiếu thu: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      console.error('Error saving receipt:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Công nợ</h1>
          <p className="text-gray-500">Theo dõi học phí còn thiếu của học viên</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-all font-medium shadow-sm">
            <Download className="w-4 h-4" />
            Xuất báo cáo
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-50 text-red-600 rounded-xl">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Tổng công nợ</p>
              <h4 className="text-2xl font-bold text-red-600">{formatNumber(totalDebt)} VNĐ</h4>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <User className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Số học viên nợ</p>
              <h4 className="text-2xl font-bold text-blue-600">{debtList.length}</h4>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium uppercase tracking-wider">Trung bình nợ</p>
              <h4 className="text-2xl font-bold text-orange-600">
                {debtList.length > 0 ? formatNumber(Math.round(totalDebt / debtList.length)) : 0} VNĐ
              </h4>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo tên hoặc số điện thoại..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Debt Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Học viên</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Khóa học</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Tổng học phí</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Đã đóng</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Còn nợ</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {debtList.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                        {item.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{item.name}</p>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Phone className="w-3 h-3" />
                          {item.phone}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <BookOpen className="w-4 h-4 text-blue-500" />
                      {item.subject}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900">
                    {editingId === item.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <input
                          type="text"
                          value={formatNumber(editValue)}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setEditValue(val);
                          }}
                          className="w-32 px-2 py-1 border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
                          autoFocus
                        />
                        <button 
                          onClick={() => handleUpdateClosedAmount(item.id)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                          title="Lưu"
                        >
                          <CheckCircle2 size={18} />
                        </button>
                        <button 
                          onClick={handleCancelEdit}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Hủy"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2 group">
                        <span>{formatNumber(item.totalTuition)}</span>
                        <button 
                          onClick={() => handleStartEdit(item)}
                          className="p-1 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all"
                          title="Sửa số tiền chốt"
                        >
                          <FileText size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-green-600">
                    {formatNumber(item.collectedTuition)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-bold text-red-600">{formatNumber(item.debt)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCollectMoney(item)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Thu tiền"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleViewHistory(item)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Lịch sử đóng tiền"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {debtList.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Không có dữ liệu công nợ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Collect Money Modal */}
      {isCollectModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-blue-600 text-white">
              <h3 className="text-xl font-bold">Thu học phí còn thiếu</h3>
              <button onClick={() => setIsCollectModalOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmitReceipt} className="p-6 space-y-4">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Học viên:</span>
                  <span className="font-bold text-gray-900">{selectedCustomer.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Khóa học:</span>
                  <span className="font-bold text-blue-600">{selectedCustomer.subject}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2">
                  <span className="text-sm text-gray-500">Còn nợ:</span>
                  <span className="font-bold text-red-600">{formatNumber(selectedCustomer.debt)} VNĐ</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày thu *</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền thu *</label>
                  <input
                    type="text"
                    required
                    value={formatNumber(formData.amount)}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setFormData({ ...formData, amount: parseInt(val) || 0 });
                    }}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Loại thu *</label>
                <select
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as ReceiptType })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="đóng tất">Đóng tất</option>
                  <option value="đóng 100%">Đóng 100%</option>
                  <option value="cọc">Cọc</option>
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
                          ? "bg-blue-600 text-white border-blue-600" 
                          : "bg-white text-gray-600 border-gray-200 hover:border-blue-600"
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
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Ghi chú thu nợ..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCollectModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Xác nhận thu tiền
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {isHistoryModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-900 text-white">
              <div>
                <h3 className="text-xl font-bold">Lịch sử đóng tiền</h3>
                <p className="text-gray-400 text-sm">{selectedCustomer.name} - {selectedCustomer.subject}</p>
              </div>
              <button onClick={() => setIsHistoryModalOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {selectedCustomer.history.length > 0 ? (
                <div className="space-y-4">
                  {selectedCustomer.history.map((receipt: Receipt) => (
                    <div key={receipt.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                          <DollarSign size={20} />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{formatNumber(receipt.amount)} VNĐ</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Calendar size={12} />
                            {format(receipt.date || receipt.createdAt, 'dd/MM/yyyy')}
                            <span className="mx-1">•</span>
                            <CreditCard size={12} />
                            <span className="capitalize">{receipt.paymentMethod}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                          {receipt.type}
                        </span>
                        <p className="text-[10px] text-gray-400 mt-1">{receipt.receiptNumber}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  Chưa có lịch sử đóng tiền
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold">Tổng đã đóng</p>
                <p className="text-lg font-bold text-green-600">{formatNumber(selectedCustomer.collectedTuition)} VNĐ</p>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
