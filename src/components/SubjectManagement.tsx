import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  BookOpen,
  Loader2,
  AlertCircle,
  Check,
  X
} from 'lucide-react';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Subject, UserProfile } from '../types';

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

interface SubjectManagementProps {
  profile: UserProfile | null;
}

export default function SubjectManagement({ profile }: SubjectManagementProps) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'subjects'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSubjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'subjects');
    });

    return () => unsubscribe();
  }, []);

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;

    try {
      await addDoc(collection(db, 'subjects'), {
        name: newSubjectName.trim(),
        createdAt: Date.now()
      });
      setNewSubjectName('');
      setIsAdding(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'subjects');
    }
  };

  const handleUpdateSubject = async (id: string) => {
    if (!editingName.trim()) return;

    try {
      await updateDoc(doc(db, 'subjects', id), {
        name: editingName.trim()
      });
      setEditingId(null);
      setEditingName('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `subjects/${id}`);
    }
  };

  const handleDeleteSubject = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa môn học này?')) return;

    try {
      await deleteDoc(doc(db, 'subjects', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `subjects/${id}`);
    }
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-gray-500">
        <AlertCircle className="w-12 h-12 mb-4 text-orange-400" />
        <p className="text-lg font-medium">Bạn không có quyền truy cập trang này.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý môn học</h1>
          <p className="text-gray-500 text-sm">Thêm, sửa hoặc xóa danh sách môn học trong hệ thống.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-sm font-medium"
        >
          <Plus className="w-5 h-5" />
          Thêm môn học
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleAddSubject} className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100 flex items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-5 h-5 text-blue-600" />
          </div>
          <input
            autoFocus
            type="text"
            placeholder="Nhập tên môn học mới..."
            value={newSubjectName}
            onChange={(e) => setNewSubjectName(e.target.value)}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
            >
              <Check className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-gray-400">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <p>Đang tải danh sách...</p>
          </div>
        ) : subjects.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Chưa có môn học nào được tạo.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {subjects.map((subject) => (
              <div key={subject.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-all group">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center group-hover:bg-white transition-all">
                    <BookOpen className="w-5 h-5 text-gray-400" />
                  </div>
                  {editingId === subject.id ? (
                    <input
                      autoFocus
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdateSubject(subject.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="flex-1 bg-white border border-blue-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <span className="font-medium text-gray-900">{subject.name}</span>
                  )}
                </div>
                
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  {editingId === subject.id ? (
                    <>
                      <button
                        onClick={() => handleUpdateSubject(subject.id)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditingId(subject.id);
                          setEditingName(subject.name);
                        }}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSubject(subject.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
