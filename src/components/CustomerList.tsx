import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Plus, 
  Filter, 
  Edit2,
  Trash2,
  History,
  MessageSquare,
  ExternalLink,
  Receipt as ReceiptIcon,
  Upload,
  Paperclip,
  X
} from 'lucide-react';
import { collection, query, onSnapshot, where, addDoc, updateDoc, deleteDoc, doc, orderBy, limit, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Customer, UserProfile, CustomerStatus, CustomerSource, Interaction, InteractionStatus, Subject, ReceiptType, PaymentMethod, Receipt } from '../types';
import { cn, formatDate, formatOnlyDate, formatNumber, safeGetISODate, safeGetISODateTime } from '../lib/utils';
import InteractionTimeline from './InteractionTimeline';
import Pagination from './Pagination';
import Papa from 'papaparse';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface CustomerListProps {
  profile: UserProfile | null;
}

export default function CustomerList({ profile }: CustomerListProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [interactions, setInteractions] = useState<Record<string, Interaction>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [isQuickNoteOpen, setIsQuickNoteOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState({
    amount: 0,
    type: 'đóng 100%' as ReceiptType,
    paymentMethod: 'chuyển khoản' as PaymentMethod,
    note: '',
    date: new Date().toISOString().split('T')[0],
    attachmentUrl: ''
  });
  const [quickNoteData, setQuickNoteData] = useState({
    content: '',
    status: 'đã liên hệ' as InteractionStatus,
    notes: ''
  });

  const [formData, setFormData] = useState({
    consultationDate: Date.now(),
    fbLink: '',
    name: '',
    phone: '',
    subject: '',
    status: 'Phân vân' as CustomerStatus,
    notes: '',
    closedAmount: '',
    source: 'Facebook' as CustomerSource,
    initialInteraction: '',
    appointmentTime: 0,
    appointmentContent: ''
  });

  const fetchData = useCallback(async () => {
    if (!profile) return;
    try {
      const ownerIdParam = profile.role === 'admin' ? '' : `?ownerId=${profile.uid}`;
      
      const [customersRes, interactionsRes, subjectsRes, receiptsRes] = await Promise.all([
        fetch(`/api/customers${ownerIdParam}`),
        fetch(`/api/interactions`),
        fetch(`/api/subjects`),
        fetch(`/api/receipts`)
      ]);

      const [customersData, interactionsData, subjectsData, receiptsData] = await Promise.all([
        customersRes.ok ? customersRes.json() : Promise.resolve([]),
        interactionsRes.ok ? interactionsRes.json() : Promise.resolve([]),
        subjectsRes.ok ? subjectsRes.json() : Promise.resolve([]),
        receiptsRes.ok ? receiptsRes.json() : Promise.resolve([])
      ]);

      setCustomers(Array.isArray(customersData) ? customersData : []);
      setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
      setReceipts(Array.isArray(receiptsData) ? receiptsData : []);

      const latest: Record<string, Interaction> = {};
      if (Array.isArray(interactionsData)) {
        interactionsData.forEach((data: Interaction) => {
          if (!latest[data.customerId]) {
            latest[data.customerId] = data;
          }
        });
      }
      setInteractions(latest);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }, [profile]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Poll every 30s as a simple fallback for real-time
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleCreateReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedCustomer) return;

    const totalAmount = parseInt(String(selectedCustomer.closedAmount || '').replace(/\D/g, '')) || 0;
    
    const totalPaid = receipts
      .filter(r => String(r.customerId) === String(selectedCustomer.id) && r.status !== 'rejected')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);
    
    const remainingAmount = totalAmount - totalPaid - Number(receiptData.amount);

    const isAdmin = profile.role === 'admin';
    const receiptDate = new Date(receiptData.date).getTime();
    const receiptNumber = `PT-${formatOnlyDate(receiptDate).replace(/\//g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const data = {
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      customerPhone: selectedCustomer.phone,
      subject: selectedCustomer.subject,
      amount: receiptData.amount,
      totalAmount: totalAmount,
      remainingAmount: remainingAmount,
      type: receiptData.type,
      paymentMethod: receiptData.paymentMethod,
      note: receiptData.note,
      attachmentUrl: receiptData.attachmentUrl || '',
      staffId: profile.uid,
      staffName: profile.displayName || profile.email,
      date: receiptDate,
      status: isAdmin ? 'approved' : 'pending',
      receiptNumber,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    try {
      const res = await fetch('/api/receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        setIsReceiptModalOpen(false);
        setReceiptData({
          amount: 0,
          type: 'đóng 100%',
          paymentMethod: 'chuyển khoản',
          note: '',
          date: new Date().toISOString().split('T')[0],
          attachmentUrl: ''
        });
        // Refresh data
        fetchData();
      }
    } catch (error) {
      console.error("Error creating receipt:", error);
      alert("Lỗi khi lưu phiếu thu. Vui lòng thử lại hoặc liên hệ quản trị viên.");
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
      setReceiptData({ ...receiptData, attachmentUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         c.phone.includes(searchTerm);
    const matchesFilter = filterStatus === 'all' || c.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    const { initialInteraction, appointmentTime, appointmentContent, ...customerData } = formData;
    const data: any = {
      ...customerData,
      closedAmount: String(customerData.closedAmount || '').replace(/[^0-9]/g, ""),
      updatedAt: Date.now()
    };

    if (!selectedCustomer) {
      data.ownerId = profile.uid;
      data.ownerName = profile.displayName || profile.email;
      data.createdAt = Date.now();
    }

    try {
      let customerId = '';
      let customerName = data.name;

      if (selectedCustomer) {
        customerId = selectedCustomer.id;
        const res = await fetch(`/api/customers/${customerId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to update customer');
      } else {
        const res = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.details || 'Failed to create customer');
        }

        const newCustomer = await res.json();
        if (!newCustomer || !newCustomer.id) {
          throw new Error('Server returned invalid customer data');
        }
        customerId = newCustomer.id;

        if (initialInteraction.trim()) {
          await fetch('/api/interactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerId: customerId,
              content: initialInteraction,
              notes: 'Tạo cùng lúc với khách hàng',
              status: 'đã liên hệ',
              staffId: profile.uid,
              createdAt: Date.now(),
              updatedAt: Date.now()
            })
          });
        }
      }

      // Create appointment if provided
      if (appointmentTime > 0 && appointmentContent.trim()) {
        await fetch('/api/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerId: customerId,
            customerName: customerName,
            customerPhone: data.phone,
            time: appointmentTime,
            content: appointmentContent,
            staffId: profile.uid,
            status: 'chưa diễn ra',
            createdAt: Date.now(),
            updatedAt: Date.now()
          })
        });
      }

      setIsModalOpen(false);
      setSelectedCustomer(null);
      setFormData({
        consultationDate: Date.now(),
        fbLink: '',
        name: '',
        phone: '',
        subject: '',
        status: 'Phân vân',
        notes: '',
        closedAmount: '',
        source: 'Facebook' as CustomerSource,
        initialInteraction: '',
        appointmentTime: 0,
        appointmentContent: ''
      });
      fetchData();
    } catch (err) {
      console.error("Error submitting customer:", err);
    }
  };

  const handleDeleteRequest = (id: string) => {
    setCustomerToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!customerToDelete) return;
    try {
      await fetch(`/api/customers/${customerToDelete}`, { method: 'DELETE' });
      setIsDeleteModalOpen(false);
      setCustomerToDelete(null);
      fetchData();
    } catch (err) {
      console.error("Error deleting customer:", err);
    }
  };

  const handleQuickNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedCustomer || !quickNoteData.content.trim()) return;

    try {
      await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          content: quickNoteData.content,
          notes: quickNoteData.notes,
          status: quickNoteData.status,
          staffId: profile.uid,
          createdAt: Date.now(),
          updatedAt: Date.now()
        })
      });

      // Update customer's updatedAt
      await fetch(`/api/customers/${selectedCustomer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updatedAt: Date.now()
        })
      });

      setIsQuickNoteOpen(false);
      setQuickNoteData({ content: '', status: 'đã liên hệ', notes: '' });
      setSelectedCustomer(null);
      fetchData();
    } catch (err) {
      console.error("Error submitting quick note:", err);
    }
  };

  const openEditModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      consultationDate: customer.consultationDate || Date.now(),
      fbLink: customer.fbLink || '',
      name: customer.name,
      phone: customer.phone,
      subject: customer.subject || '',
      status: customer.status,
      notes: customer.notes || '',
      closedAmount: formatNumber(customer.closedAmount) || '',
      source: customer.source,
      initialInteraction: '',
      appointmentTime: 0,
      appointmentContent: ''
    });
    setIsModalOpen(true);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setIsImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      complete: async (results) => {
        let count = 0;
        let errors = 0;
        const errorMessages: string[] = [];

        // Map common variations of headers
        const normalizeRow = (row: any) => {
          return {
            name: row.name || row['họ tên'] || row['tên'] || row['fullname'] || '',
            phone: row.phone || row['sđt'] || row['số điện thoại'] || row['telephone'] || '',
            consultationDate: row.consultationdate || row['ngày tư vấn'] || row['date'] || '',
            fbLink: row.fblink || row['link facebook'] || row['facebook'] || '',
            subject: row.subject || row['môn'] || row['môn học'] || '',
            status: row.status || row['trạng thái'] || 'Phân vân',
            notes: row.notes || row['ghi chú'] || '',
            closedAmount: row.closedamount || row['số tiền chốt'] || row['tiền chốt'] || '0',
            source: row.source || row['nguồn'] || 'Facebook'
          };
        };

        for (const rawRow of results.data as any[]) {
          const row = normalizeRow(rawRow);
          if (!row.name || !row.phone) {
            errors++;
            errorMessages.push(`Bỏ qua dòng thiếu tên hoặc SĐT: ${JSON.stringify(rawRow)}`);
            continue;
          }

          const consultationDate = row.consultationDate ? new Date(row.consultationDate).getTime() : Date.now();
          const finalConsultationDate = isNaN(consultationDate) ? Date.now() : consultationDate;

          const customerData = {
            name: row.name,
            phone: row.phone,
            consultationDate: finalConsultationDate,
            fbLink: row.fbLink || '',
            subject: row.subject || '',
            status: (row.status || 'Phân vân') as CustomerStatus,
            notes: row.notes || '',
            closedAmount: String(row.closedAmount).replace(/[^0-9]/g, ""),
            source: (row.source || 'Facebook') as CustomerSource,
            ownerId: profile.uid,
            ownerName: profile.displayName || profile.email || 'Unknown',
            createdAt: Date.now(),
            updatedAt: Date.now()
          };

          try {
            const res = await fetch('/api/customers', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(customerData)
            });
            
            if (res.ok) {
              count++;
            } else {
              errors++;
              const errorText = await res.text();
              console.error("Failed to import customer:", row.name, errorText);
              errorMessages.push(`Lỗi khi nhập ${row.name}: ${errorText}`);
            }
          } catch (err) {
            errors++;
            console.error("Error importing customer:", row.name, err);
            errorMessages.push(`Lỗi hệ thống khi nhập ${row.name}`);
          }
        }

        setIsImporting(false);
        if (count > 0) {
          alert(`Đã nhập thành công ${count} khách hàng!${errors > 0 ? ` (${errors} lỗi)` : ''}`);
          if (errors > 0) {
            console.log("Import Errors:", errorMessages);
          }
          fetchData();
        } else {
          alert(errors > 0 ? `Không thể nhập khách hàng. Có ${errors} lỗi xảy ra. Xem console để biết chi tiết.` : 'Không tìm thấy dữ liệu hợp lệ để nhập. Vui lòng kiểm tra tiêu đề cột (Họ tên, SĐT).');
          console.log("Import Errors:", errorMessages);
        }
        if (e.target) e.target.value = '';
      },
      error: (error) => {
        console.error("Papa Parse Error:", error);
        alert('Lỗi khi đọc file CSV.');
        setIsImporting(false);
      }
    });
  };

  const getStatusBadge = (status: CustomerStatus) => {
    const base = "px-3 py-1 rounded-full text-xs font-medium inline-flex items-center justify-center min-w-[100px]";
    switch (status) {
      case 'Đã đóng tiền': return <span className={cn(base, "bg-emerald-100 text-emerald-700 border border-emerald-200")}>Đã đóng tiền</span>;
      case 'Đã cọc': return <span className={cn(base, "bg-green-100 text-green-700 border border-green-200")}>Đã cọc</span>;
      case 'Đã chốt': return <span className={cn(base, "bg-blue-100 text-blue-700 border border-blue-200")}>Đã chốt</span>;
      case 'Phân vân': return <span className={cn(base, "bg-orange-100 text-orange-700 border border-orange-200")}>Phân vân</span>;
      case 'Hẹn lại': return <span className={cn(base, "bg-purple-100 text-purple-700 border border-purple-200")}>Hẹn lại</span>;
      case 'Khác': return <span className={cn(base, "bg-gray-100 text-gray-700 border border-gray-200")}>Khác</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý khách hàng & Trao đổi</h1>
          <p className="text-gray-500">Quản lý tập trung thông tin và lịch sử chăm sóc</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className={cn(
            "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-all shadow-sm font-medium cursor-pointer border border-gray-200 hover:bg-gray-50",
            isImporting && "opacity-50 cursor-not-allowed"
          )}>
            <Upload className="w-5 h-5 text-gray-600" />
            <span className="text-gray-700">{isImporting ? 'Đang nhập...' : 'Nhập từ CSV'}</span>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImportCSV}
              disabled={isImporting}
            />
          </label>
          <button
            onClick={() => {
              setSelectedCustomer(null);
              setFormData({
                consultationDate: Date.now(),
                fbLink: '',
                name: '',
                phone: '',
                subject: '',
                status: 'Phân vân',
                notes: '',
                closedAmount: '',
                source: 'Facebook' as CustomerSource,
                initialInteraction: '',
                appointmentTime: 0,
                appointmentContent: ''
              });
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-sm font-medium"
          >
            <Plus className="w-5 h-5" />
            Thêm khách hàng mới
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm kiếm theo tên, SĐT, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="Đã đóng tiền">Đã đóng tiền</option>
            <option value="Đã cọc">Đã cọc</option>
            <option value="Đã chốt">Đã chốt</option>
            <option value="Phân vân">Phân vân</option>
            <option value="Hẹn lại">Hẹn lại</option>
            <option value="Khác">Khác</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#2D5A4C] border-b border-[#2D5A4C]">
                <th className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider border-r border-[#3D6A5C]">Ngày Tư vấn</th>
                <th className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider border-r border-[#3D6A5C]">Họ Tên</th>
                <th className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider border-r border-[#3D6A5C]">Sđt</th>
                <th className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider border-r border-[#3D6A5C]">Môn</th>
                <th className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider border-r border-[#3D6A5C]">Trạng thái</th>
                <th className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider border-r border-[#3D6A5C]">Ghi chú</th>
                <th className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider border-r border-[#3D6A5C]">Số tiền đã chốt</th>
                <th className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider border-r border-[#3D6A5C]">Nguồn Data</th>
                <th className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider border-r border-[#3D6A5C]">Người tạo</th>
                <th className="px-4 py-3 text-xs font-bold text-white uppercase tracking-wider text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedCustomers.map((customer) => {
                return (
                  <tr key={customer.id} className="hover:bg-gray-50/50 transition-all group border-b border-gray-100">
                    <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-100">
                      {customer.consultationDate ? formatOnlyDate(customer.consultationDate) : ''}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-100">
                      {customer.fbLink ? (
                        <a href={customer.fbLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                          {customer.name} <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        customer.name
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-100">
                      {customer.phone}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-100">
                      {customer.subject}
                    </td>
                    <td className="px-4 py-3 border-r border-gray-100">
                      {getStatusBadge(customer.status)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-100 max-w-xs truncate">
                      {customer.notes}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-100">
                      {formatNumber(customer.closedAmount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-100">
                      {customer.source}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 border-r border-gray-100">
                      {customer.ownerName}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setIsQuickNoteOpen(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                          title="Thêm trao đổi nhanh"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setIsTimelineOpen(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Lịch sử trao đổi"
                        >
                          <History className="w-4 h-4" />
                        </button>
                        {customer.status === 'Đã chốt' && (
                          <button 
                            onClick={() => {
                              setSelectedCustomer(customer);
                              const totalAmount = parseInt(String(customer.closedAmount || '').replace(/\D/g, '')) || 0;
                              const totalPaid = receipts
                                .filter(r => r.customerId === customer.id)
                                .reduce((sum, r) => sum + r.amount, 0);
                              
                              const remaining = totalAmount - totalPaid;
                              setReceiptData({ ...receiptData, amount: remaining > 0 ? remaining : 0 });
                              setIsReceiptModalOpen(true);
                            }}
                            className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                            title="Tạo phiếu thu"
                          >
                            <ReceiptIcon className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={() => openEditModal(customer)}
                          className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                          title="Chỉnh sửa"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {profile?.role === 'admin' && (
                          <button 
                            onClick={() => handleDeleteRequest(customer.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Xóa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-gray-400">
                    Không tìm thấy khách hàng nào phù hợp.
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

      {/* Unified Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {selectedCustomer ? 'Cập nhật thông tin khách hàng' : 'Thêm khách hàng & Trao đổi ban đầu'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider">Thông tin khách hàng</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Ngày tư vấn</label>
                    <input
                      type="date"
                      value={safeGetISODate(formData.consultationDate)}
                      onChange={(e) => setFormData({...formData, consultationDate: new Date(e.target.value).getTime()})}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Link Facebook</label>
                    <input
                      type="url"
                      value={formData.fbLink}
                      onChange={(e) => setFormData({...formData, fbLink: e.target.value})}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Họ tên *</label>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Số điện thoại</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Môn học</label>
                    <select
                      value={formData.subject}
                      onChange={(e) => setFormData({...formData, subject: e.target.value})}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Chọn môn học</option>
                      {subjects.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Trạng thái</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as CustomerStatus})}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Đã đóng tiền">Đã đóng tiền</option>
                      <option value="Đã cọc">Đã cọc</option>
                      <option value="Đã chốt">Đã chốt</option>
                      <option value="Phân vân">Phân vân</option>
                      <option value="Hẹn lại">Hẹn lại</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Số tiền đã chốt</label>
                    <input
                      type="text"
                      value={formData.closedAmount}
                      onChange={(e) => {
                        const rawValue = e.target.value.replace(/[^0-9]/g, "");
                        const formattedValue = rawValue === "" ? "" : new Intl.NumberFormat('vi-VN').format(parseInt(rawValue));
                        setFormData({...formData, closedAmount: formattedValue});
                      }}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Nguồn Data</label>
                    <select
                      value={formData.source}
                      onChange={(e) => setFormData({...formData, source: e.target.value as CustomerSource})}
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Facebook">Facebook</option>
                      <option value="Tiktok">Tiktok</option>
                      <option value="CTV Online">CTV Online</option>
                      <option value="Được giới thiệu">Được giới thiệu</option>
                      <option value="Học viên tự đến">Học viên tự đến</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Ghi chú</label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider">Lịch hẹn (Không bắt buộc)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">Thời gian hẹn</label>
                      <input
                        type="datetime-local"
                        value={safeGetISODateTime(formData.appointmentTime)}
                        onChange={(e) => setFormData({...formData, appointmentTime: e.target.value ? new Date(e.target.value).getTime() : 0})}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium text-gray-700">Nội dung hẹn</label>
                      <input
                        type="text"
                        value={formData.appointmentContent}
                        onChange={(e) => setFormData({...formData, appointmentContent: e.target.value})}
                        placeholder="Ví dụ: Gọi lại tư vấn thêm..."
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {!selectedCustomer && (
                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <h3 className="text-sm font-bold text-blue-600 uppercase tracking-wider">Nội dung trao đổi đầu tiên (Tùy chọn)</h3>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Nội dung tư vấn</label>
                    <textarea
                      rows={3}
                      value={formData.initialInteraction}
                      onChange={(e) => setFormData({...formData, initialInteraction: e.target.value})}
                      placeholder="Ghi lại nội dung tư vấn ban đầu..."
                      className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              <div className="pt-6 flex gap-3 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium shadow-sm"
                >
                  {selectedCustomer ? 'Cập nhật' : 'Lưu khách hàng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {isReceiptModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-[#2D5A4C] text-white">
              <h3 className="text-xl font-bold">Tạo Phiếu Thu</h3>
              <button onClick={() => setIsReceiptModalOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleCreateReceipt} className="p-6 space-y-4">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-2">Thông tin khách hàng</p>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-gray-900">{selectedCustomer.name}</p>
                    <p className="text-sm text-gray-600">{selectedCustomer.phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#2D5A4C]">{selectedCustomer.subject}</p>
                    <p className="text-xs text-gray-500">Môn học</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Học phí đã chốt</p>
                    <p className="font-bold text-gray-900">{formatNumber(selectedCustomer.closedAmount)} VNĐ</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Đã thu trước đó</p>
                    <p className="font-bold text-blue-600">
                      {formatNumber(receipts.filter(r => r.customerId === selectedCustomer.id).reduce((sum, r) => sum + Number(r.amount), 0))} VNĐ
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ngày thu *</label>
                  <input
                    type="date"
                    required
                    value={receiptData.date}
                    onChange={(e) => setReceiptData({ ...receiptData, date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số tiền thu (VNĐ) *</label>
                  <input
                    type="text"
                    required
                    value={formatNumber(receiptData.amount)}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setReceiptData({ ...receiptData, amount: parseInt(val) || 0 });
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
                  value={receiptData.type}
                  onChange={(e) => setReceiptData({ ...receiptData, type: e.target.value as ReceiptType })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                >
                  <option value="cọc">Cọc</option>
                  <option value="đóng tất">Đóng tất</option>
                  <option value="đóng 100%">Đóng 100%</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hình thức thanh toán *</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['tiền mặt', 'chuyển khoản', 'khác'] as PaymentMethod[]).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setReceiptData({ ...receiptData, paymentMethod: method })}
                      className={cn(
                        "py-2 px-3 text-sm rounded-lg border transition-all capitalize",
                        receiptData.paymentMethod === method 
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
                  value={receiptData.note}
                  onChange={(e) => setReceiptData({ ...receiptData, note: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D5A4C]/20 focus:border-[#2D5A4C]"
                  rows={2}
                  placeholder="Thông tin thêm về khoản thu..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chứng từ (Tùy chọn)</label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-200 rounded-lg hover:border-[#2D5A4C] hover:bg-[#2D5A4C]/5 cursor-pointer transition-all">
                    <Paperclip size={18} className="text-gray-400" />
                    <span className="text-sm text-gray-500 font-medium">
                      {receiptData.attachmentUrl ? 'Đã chọn chứng từ' : 'Tải lên chứng từ (Ảnh/PDF)'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  {receiptData.attachmentUrl && (
                    <button
                      type="button"
                      onClick={() => setReceiptData({ ...receiptData, attachmentUrl: '' })}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Xóa chứng từ"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
                {receiptData.attachmentUrl && receiptData.attachmentUrl.startsWith('data:image') && (
                  <div className="mt-2 relative w-20 h-20 rounded-lg overflow-hidden border border-gray-100">
                    <img src={receiptData.attachmentUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#2D5A4C] text-white rounded-lg hover:bg-[#23463a] transition-colors font-medium"
                >
                  Lưu phiếu thu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Timeline Modal */}
      {isTimelineOpen && selectedCustomer && (
        <InteractionTimeline 
          customer={selectedCustomer} 
          profile={profile} 
          onClose={() => setIsTimelineOpen(false)} 
        />
      )}

      {/* Quick Note Modal */}
      {isQuickNoteOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Thêm trao đổi nhanh</h2>
                <p className="text-sm text-gray-500">Khách hàng: {selectedCustomer.name}</p>
              </div>
              <button onClick={() => setIsQuickNoteOpen(false)} className="text-gray-400 hover:text-gray-600">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleQuickNoteSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Nội dung trao đổi *</label>
                <textarea
                  required
                  rows={4}
                  autoFocus
                  value={quickNoteData.content}
                  onChange={(e) => setQuickNoteData({...quickNoteData, content: e.target.value})}
                  placeholder="Nhập nội dung đã trao đổi với khách..."
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Trạng thái</label>
                  <select
                    value={quickNoteData.status}
                    onChange={(e) => setQuickNoteData({...quickNoteData, status: e.target.value as InteractionStatus})}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="đã liên hệ">Đã liên hệ</option>
                    <option value="chưa phản hồi">Chưa phản hồi</option>
                    <option value="quan tâm">Quan tâm</option>
                    <option value="từ chối">Từ chối</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Ghi chú nhanh</label>
                  <input
                    type="text"
                    value={quickNoteData.notes}
                    onChange={(e) => setQuickNoteData({...quickNoteData, notes: e.target.value})}
                    placeholder="Ghi chú thêm..."
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsQuickNoteOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium shadow-sm flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Lưu trao đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Xác nhận xóa</h2>
              <button onClick={() => setIsDeleteModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-600">Bạn có chắc chắn muốn xóa khách hàng này? Hành động này không thể hoàn tác và dữ liệu trao đổi liên quan cũng sẽ bị ảnh hưởng.</p>
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium"
              >
                Hủy
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium shadow-sm"
              >
                Xóa ngay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

