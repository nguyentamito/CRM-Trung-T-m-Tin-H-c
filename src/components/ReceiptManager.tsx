import React, { useState, useEffect } from 'react';
import { Receipt, Customer, UserProfile, ReceiptType, PaymentMethod, CenterInfo } from '../types';
import SearchableSelect from './SearchableSelect';
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
  Eye,
  ExternalLink
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay, parseISO, subMonths, subDays } from 'date-fns';
import { cn, formatNumber } from '../lib/utils';
import { printReceipt } from './ReceiptPrint';
import Pagination from './Pagination';

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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const clearFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setDateRange({
      start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
      isAll: false
    });
    setCurrentPage(1);
  };

  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    isAll: false
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

    const safeJson = async (res: Response, label: string) => {
      if (!res.ok) return [];
      try {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return await res.json();
        }
        const text = await res.text();
        if (text.includes("<!doctype") || text.includes("<html")) {
          console.warn(`Received HTML instead of JSON for ${label} in ReceiptManager. Server might be starting up.`);
        } else {
          console.warn(`Expected JSON for ${label} but got ${contentType}: ${text.substring(0, 100)}`);
        }
        return [];
      } catch (e) {
        console.error(`JSON parse error ${label} in ReceiptManager:`, e);
        return [];
      }
    };

    const fetchData = async (retries = 3, delay = 1000) => {
      try {
        const [receiptsRes, customersRes, settingsRes] = await Promise.all([
          fetch('/api/receipts'),
          fetch('/api/customers'),
          fetch('/api/settings/center_info')
        ]);

        const [receiptsData, customersData, settingsData] = await Promise.all([
          safeJson(receiptsRes, "receipts"),
          safeJson(customersRes, "customers"),
          safeJson(settingsRes, "settings")
        ]);

        setReceipts(Array.isArray(receiptsData) ? receiptsData : []);
        setCustomers(Array.isArray(customersData) ? customersData : []);
        
        if (settingsData && !settingsData.error) {
          setCenterInfo(settingsData);
        }

        setLoading(false);
      } catch (error: any) {
        if (retries > 0 && (error.message === 'Failed to fetch' || error.name === 'TypeError')) {
          console.warn(`Fetch failed in ReceiptManager, retrying in ${delay}ms... (${retries} retries left)`);
          setTimeout(() => fetchData(retries - 1, delay * 2), delay);
        } else {
          console.error('Error fetching data:', error);
          setLoading(false);
        }
      }
    };
    fetchData();
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || (!isAdmin && !isStaff)) return;

    const customer = customers.find(c => String(c.id) === String(formData.customerId));
    if (!customer) return;

    const closedAmountStr = customer.closedAmount ? customer.closedAmount.toString() : '0';
    const totalAmount = parseInt(closedAmountStr.replace(/\D/g, '')) || 0;
    const totalPaid = receipts
      .filter(r => String(r.customerId) === String(customer.id) && r.id !== selectedReceipt?.id && r.status !== 'rejected' && r.type !== 'thu khác')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);
    
    let remainingAmount = totalAmount - totalPaid;
    if (formData.type !== 'thu khác') {
      remainingAmount -= Number(formData.amount);
    }
    const selectedDate = parseISO(formData.date);

    const data: any = {
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
      date: selectedDate.getTime(),
      status: isAdmin ? 'approved' : 'pending',
      updatedAt: Date.now()
    };

    if (!selectedReceipt) {
      data.staffId = profile.uid;
      data.staffName = profile.displayName || profile.email || 'Unknown';
      data.createdAt = Date.now();
    }

    try {
      // Update date range to include the saved receipt's month if it's outside current range
      const savedDateStr = formData.date;
      const savedDate = parseISO(savedDateStr);
      const newStart = format(startOfMonth(savedDate), 'yyyy-MM-dd');
      const newEnd = format(endOfMonth(savedDate), 'yyyy-MM-dd');
      
      if (!dateRange.isAll && (savedDateStr < dateRange.start || savedDateStr > dateRange.end)) {
        setDateRange({ start: newStart, end: newEnd, isAll: false });
      }

      if (selectedReceipt) {
        const receiptNumber = selectedReceipt.receiptNumber || `PT-${format(selectedDate, 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;
        const response = await fetch(`/api/receipts/${selectedReceipt.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, receiptNumber }),
        });
        if (response.ok) {
          const updated = await response.json();
          setReceipts(receipts.map(r => r.id === selectedReceipt.id ? { ...r, ...updated } : r));
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
        } else {
          const errorData = await response.json();
          alert(`Lỗi khi cập nhật phiếu thu: ${errorData.error || response.statusText}`);
        }
      } else {
        const receiptNumber = `PT-${format(selectedDate, 'yyyyMMdd')}-${Math.floor(1000 + Math.random() * 9000)}`;
        const response = await fetch('/api/receipts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, receiptNumber, createdAt: Date.now() }),
        });
        if (response.ok) {
          const newReceipt = await response.json();
          setReceipts([newReceipt, ...receipts]);
          setIsModalOpen(false);
          setFormData({
            customerId: '',
            amount: 0,
            type: 'đóng 100%',
            paymentMethod: 'chuyển khoản',
            note: '',
            date: format(new Date(), 'yyyy-MM-dd'),
            attachmentUrl: ''
          });
        } else {
          const errorData = await response.json();
          alert(`Lỗi khi tạo phiếu thu: ${errorData.error || response.statusText}`);
        }
      }
    } catch (error) {
      console.error('Error saving receipt:', error);
    }
  };

  const filteredReceipts = receipts.filter(r => {
    const matchesSearch = r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         r.customerPhone.includes(searchTerm) ||
                         (r.receiptNumber && r.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = typeFilter === 'all' || r.type === typeFilter;
    
    const receiptDate = new Date(r.date || r.createdAt);
    let matchesDate = true;
    if (!dateRange.isAll) {
      const startDate = startOfDay(parseISO(dateRange.start));
      const endDate = endOfDay(parseISO(dateRange.end));
      matchesDate = isWithinInterval(receiptDate, { start: startDate, end: endDate });
    }

    return matchesSearch && matchesType && matchesDate;
  }).sort((a, b) => {
    const dateA = a.date || a.createdAt || 0;
    const dateB = b.date || b.createdAt || 0;
    return Number(dateB) - Number(dateA);
  });

  const totalCollected = filteredReceipts
    .filter(r => r.status === 'approved')
    .reduce((sum, r) => sum + Number(r.amount || 0), 0);

  const totalPages = Math.ceil(filteredReceipts.length / itemsPerPage);
  const paginatedReceipts = filteredReceipts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const openEditModal = (receipt: Receipt) => {
    if (!isAdmin) return;
    setSelectedReceipt(receipt);
    setFormData({
      customerId: receipt.customerId,
      amount: Number(receipt.amount),
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
      const response = await fetch(`/api/receipts/${receiptToDelete.id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setReceipts(receipts.filter(r => r.id !== receiptToDelete.id));
        setIsDeleteModalOpen(false);
        setReceiptToDelete(null);
      }
    } catch (error) {
      console.error('Error deleting receipt:', error);
    }
  };

  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Limit file size to 10MB for Google Drive
    if (file.size > 10 * 1024 * 1024) {
      alert('Kích thước file quá lớn (tối đa 10MB). Vui lòng chọn file nhỏ hơn.');
      return;
    }

    setIsUploading(true);
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      const response = await fetch('/api/upload-to-drive', {
        method: 'POST',
        body: formDataUpload,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();
      setFormData({ ...formData, attachmentUrl: data.url });
    } catch (error: any) {
      console.error('Error uploading to Drive:', error);
      alert('Không thể tải lên Google Drive: ' + error.message + '. Vui lòng kiểm tra cấu hình API.');
      
      // Fallback to local preview if Drive fails (optional, but maybe better to just fail)
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, attachmentUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUploading(false);
    }
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
        <div className="flex items-center gap-3">
          <a
            href="https://drive.google.com/drive/folders/1a5CP9_DkcNkVw2Y4OnIY-1tPyM1VLawR?usp=sharing"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
          >
            <ExternalLink size={18} />
            Thư mục Drive
          </a>
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
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1"><Calendar size={12} /> Từ ngày</span>
                <button 
                  onClick={() => setDateRange(prev => ({ ...prev, isAll: !prev.isAll }))}
                  className={cn("text-[10px] px-1 rounded", dateRange.isAll ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500")}
                >
                  {dateRange.isAll ? "Bỏ lọc ngày" : "Tất cả"}
                </button>
              </label>
              <input
                type="date"
                disabled={dateRange.isAll}
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value, isAll: false })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C] disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">
                <Calendar size={12} /> Đến ngày
              </label>
              <input
                type="date"
                disabled={dateRange.isAll}
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value, isAll: false })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C] disabled:bg-gray-50 disabled:text-gray-400"
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
            <div className="w-full md:w-auto">
              <button
                onClick={clearFilters}
                className="w-full md:w-auto px-4 py-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all text-sm font-medium border border-gray-200"
              >
                Xóa lọc
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={() => setDateRange({
                start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
                end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
                isAll: false
              })}
              className="px-2 py-1 text-[10px] font-bold uppercase bg-gray-50 text-gray-500 rounded border border-gray-100 hover:bg-gray-100"
            >
              Tháng này
            </button>
            <button
              onClick={() => {
                const lastMonth = subMonths(new Date(), 1);
                setDateRange({
                  start: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
                  end: format(endOfMonth(lastMonth), 'yyyy-MM-dd'),
                  isAll: false
                });
              }}
              className="px-2 py-1 text-[10px] font-bold uppercase bg-gray-50 text-gray-500 rounded border border-gray-100 hover:bg-gray-100"
            >
              Tháng trước
            </button>
            <button
              onClick={() => {
                const last7Days = subDays(new Date(), 7);
                setDateRange({
                  start: format(last7Days, 'yyyy-MM-dd'),
                  end: format(new Date(), 'yyyy-MM-dd'),
                  isAll: false
                });
              }}
              className="px-2 py-1 text-[10px] font-bold uppercase bg-gray-50 text-gray-500 rounded border border-gray-100 hover:bg-gray-100"
            >
              7 ngày qua
            </button>
            <button
              onClick={() => {
                const last30Days = subDays(new Date(), 30);
                setDateRange({
                  start: format(last30Days, 'yyyy-MM-dd'),
                  end: format(new Date(), 'yyyy-MM-dd'),
                  isAll: false
                });
              }}
              className="px-2 py-1 text-[10px] font-bold uppercase bg-gray-50 text-gray-500 rounded border border-gray-100 hover:bg-gray-100"
            >
              30 ngày qua
            </button>
            <button
              onClick={() => setDateRange(prev => ({ ...prev, isAll: true }))}
              className="px-2 py-1 text-[10px] font-bold uppercase bg-gray-50 text-gray-500 rounded border border-gray-100 hover:bg-gray-100"
            >
              Tất cả thời gian
            </button>
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[1000px] text-left border-collapse">
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
              {paginatedReceipts.map((receipt) => (
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
                                  const response = await fetch(`/api/receipts/${receipt.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ status: 'approved', updatedAt: Date.now() })
                                  });
                                  if (response.ok) {
                                    setReceipts(receipts.map(r => r.id === receipt.id ? { ...r, status: 'approved' } : r));
                                  }
                                } catch (error) {
                                  console.error('Error approving receipt:', error);
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
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    Không tìm thấy phiếu thu nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination 
          currentPage={currentPage} 
          totalPages={totalPages} 
          onPageChange={setCurrentPage} 
        />
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
                <SearchableSelect
                  disabled={!!selectedReceipt}
                  value={formData.customerId}
                  onChange={(val) => {
                    const customer = customers.find(c => String(c.id) === String(val));
                    if (customer) {
                      const closedAmountStr = customer.closedAmount ? customer.closedAmount.toString() : '0';
                      const totalAmount = parseInt(closedAmountStr.replace(/\D/g, '')) || 0;
                      const totalPaid = receipts
                        .filter(r => r.customerId === customer.id && r.type !== 'thu khác' && r.status !== 'rejected')
                        .reduce((sum, r) => sum + r.amount, 0);
                      
                      const remaining = totalAmount - totalPaid;
                      setFormData({ 
                        ...formData, 
                        customerId: String(val), 
                        amount: remaining > 0 ? remaining : 0 
                      });
                    } else {
                      setFormData({ ...formData, customerId: String(val) });
                    }
                  }}
                  options={customers.map(c => ({
                    id: c.id,
                    label: c.name,
                    subLabel: `${c.phone} (${formatNumber(c.closedAmount)} VNĐ)`
                  }))}
                  placeholder="Chọn khách hàng..."
                />
              </div>

              {formData.customerId && (
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Môn học</p>
                      <p className="font-bold text-[#2D5A4C]">{customers.find(c => String(c.id) === String(formData.customerId))?.subject}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Đã thu trước đó</p>
                      <p className="font-bold text-blue-600">
                        {formatNumber(receipts
                          .filter(r => r.customerId === formData.customerId && r.status !== 'rejected' && r.type !== 'thu khác')
                          .reduce((sum, r) => sum + Number(r.amount || 0), 0)
                        )} VNĐ
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
                    type="text"
                    required
                    value={formatNumber(formData.amount)}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setFormData({ ...formData, amount: parseInt(val) || 0 });
                    }}
                    placeholder="0"
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
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-200 rounded-lg hover:border-[#2D5A4C] hover:bg-gray-50 cursor-pointer transition-all">
                      <Paperclip size={18} className="text-gray-400" />
                      <span className="text-sm text-gray-500 font-medium">
                        {isUploading ? (
                          <span className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#2D5A4C]"></div>
                            Đang tải lên Drive...
                          </span>
                        ) : (
                          formData.attachmentUrl && formData.attachmentUrl.startsWith('data:') ? 'Đã chọn file' : 'Tải lên file (Ảnh/PDF)'
                        )}
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
                  
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Paperclip size={16} className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="Hoặc dán link Google Drive tại đây..."
                      value={formData.attachmentUrl && !formData.attachmentUrl.startsWith('data:') ? formData.attachmentUrl : ''}
                      onChange={(e) => setFormData({ ...formData, attachmentUrl: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C] text-sm"
                    />
                  </div>
                </div>
                {formData.attachmentUrl && formData.attachmentUrl.startsWith('data:image') && (
                  <div className="mt-2 relative w-20 h-20 rounded-lg overflow-hidden border border-gray-100">
                    <img src={formData.attachmentUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
                {formData.attachmentUrl && !formData.attachmentUrl.startsWith('data:') && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-blue-600 bg-blue-50 p-2 rounded-lg">
                    <Paperclip size={14} />
                    <span className="truncate flex-1">{formData.attachmentUrl}</span>
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
