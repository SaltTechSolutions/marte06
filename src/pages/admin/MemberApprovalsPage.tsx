import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useTenant } from '../../context/TenantContext';
import type { TenantMembership } from '../../types/tenant';

export const MemberApprovalsPage: React.FC = () => {
  const { activeTenant } = useTenant();
  const [pendingMemberships, setPendingMemberships] = useState<TenantMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTenant) return;

    const q = query(
      collection(db, 'tenant_memberships'),
      where('tenantId', '==', activeTenant.id),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: TenantMembership[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() } as TenantMembership);
        });
        setPendingMemberships(items);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching pending approvals:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [activeTenant]);

  const handleApprove = async (membershipId: string) => {
    setActioningId(membershipId);
    try {
      await updateDoc(doc(db, 'tenant_memberships', membershipId), {
        status: 'active',
        approvedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error approving membership:', err);
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (membershipId: string) => {
    setActioningId(membershipId);
    try {
      await updateDoc(doc(db, 'tenant_memberships', membershipId), {
        status: 'rejected',
      });
    } catch (err) {
      console.error('Error rejecting membership:', err);
    } finally {
      setActioningId(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Üyelik Onay Talepleri</h1>
          <p className="text-slate-400 text-sm mt-1">
            **{activeTenant?.name || 'Tarabya Marte'}** salonuna yapılan üye katılım istekleri.
          </p>
        </div>
        <span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-500/30">
          {pendingMemberships.length} Bekleyen İstek
        </span>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Yükleniyor...</div>
      ) : pendingMemberships.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center text-slate-400">
          <p className="text-base font-semibold text-slate-300">Bekleyen onay talebi bulunmuyor.</p>
          <p className="text-xs text-slate-500 mt-2">
            Üyeler salon kodunuzu (`{activeTenant?.code}`) girerek başvurduğunda burada listelenecektir.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingMemberships.map((m) => (
            <div
              key={m.id}
              className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex items-center justify-between hover:border-slate-700 transition-all shadow-lg"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-emerald-400 font-semibold">{m.userId}</span>
                  <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full uppercase">
                    {m.role}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Başvuru Tarihi: {m.requestedAt ? new Date((m.requestedAt as any).seconds * 1000).toLocaleDateString('tr-TR') : 'Bugün'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleReject(m.id)}
                  disabled={actioningId === m.id}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 active:scale-95 transition-all"
                >
                  Reddet
                </button>
                <button
                  onClick={() => handleApprove(m.id)}
                  disabled={actioningId === m.id}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 active:scale-95 transition-all shadow-md"
                >
                  Onayla
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
