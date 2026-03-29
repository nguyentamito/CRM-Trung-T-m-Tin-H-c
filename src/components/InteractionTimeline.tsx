import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Send, 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle 
} from 'lucide-react';
import { Customer, Interaction, UserProfile, InteractionStatus } from '../types';
import { cn, formatDate } from '../lib/utils';
import ReactMarkdown from 'react-markdown';

interface InteractionTimelineProps {
  customer: Customer;
  profile: UserProfile | null;
  onClose: () => void;
}

export default function InteractionTimeline({ customer, profile, onClose }: InteractionTimelineProps) {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [newContent, setNewContent] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newStatus, setNewStatus] = useState<InteractionStatus>('đã liên hệ');

  const fetchInteractions = async () => {
    try {
      const response = await fetch(`/api/interactions?customerId=${customer.id}`);
      const data = await response.json();
      setInteractions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching interactions:", error);
    }
  };

  useEffect(() => {
    fetchInteractions();
  }, [customer.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newContent.trim()) return;

    try {
      await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          content: newContent,
          notes: newNotes,
          status: newStatus,
          staffId: profile.uid,
          createdAt: Date.now()
        })
      });

      // Update customer's updatedAt
      await fetch(`/api/customers/${customer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updatedAt: Date.now()
        })
      });

      setNewContent('');
      setNewNotes('');
      fetchInteractions();
    } catch (err) {
      console.error("Error submitting interaction:", err);
    }
  };

  const getStatusIcon = (status: InteractionStatus) => {
    switch (status) {
      case 'đã liên hệ': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'chưa phản hồi': return <Clock className="w-4 h-4 text-orange-500" />;
      case 'quan tâm': return <AlertCircle className="w-4 h-4 text-blue-500" />;
      case 'từ chối': return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Lịch sử trao đổi</h2>
            <p className="text-sm text-gray-500">Khách hàng: {customer.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <div className="bg-blue-50 p-6 rounded-2xl space-y-4 border border-blue-100">
            <h3 className="text-sm font-bold text-blue-700 uppercase tracking-wider flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Thêm trao đổi mới
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <textarea
                  required
                  rows={3}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Nhập nội dung đã trao đổi với khách..."
                  className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Trạng thái</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as InteractionStatus)}
                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="đã liên hệ">Đã liên hệ</option>
                    <option value="chưa phản hồi">Chưa phản hồi</option>
                    <option value="quan tâm">Quan tâm</option>
                    <option value="từ chối">Từ chối</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-500">Ghi chú nhanh</label>
                  <input
                    type="text"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Ghi chú nhanh..."
                    className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-xl hover:bg-blue-700 transition-all font-medium shadow-sm"
              >
                <Send className="w-4 h-4" />
                Lưu trao đổi
              </button>
            </form>
          </div>

          <div className="relative space-y-6">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-100" />
            
            {interactions.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-400">Chưa có lịch sử trao đổi nào.</p>
              </div>
            ) : (
              interactions.map((interaction) => (
                <div key={interaction.id} className="relative pl-10">
                  <div className="absolute left-2 top-0 w-4 h-4 rounded-full bg-white border-2 border-blue-500 z-10" />
                  <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(interaction.status)}
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">{interaction.status}</span>
                      </div>
                      <span className="text-xs text-gray-400">{formatDate(interaction.createdAt)}</span>
                    </div>
                    <div className="prose prose-sm max-w-none text-gray-700 mb-3">
                      <ReactMarkdown>{interaction.content}</ReactMarkdown>
                    </div>
                    {interaction.notes && (
                      <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-500 italic">
                        Ghi chú: {interaction.notes}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
