import React, { useState } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { GymEntraLogo } from '../../components/GymEntraLogo';

interface JoinGymPageProps {
  userUid: string;
  onSuccess?: () => void;
}

export const JoinGymPage: React.FC<JoinGymPageProps> = ({ userUid, onSuccess }) => {
  const [gymCode, setGymCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = gymCode.trim().toUpperCase();
    if (!cleanCode) return;

    setLoading(true);
    setMessage(null);

    try {
      // 1. Search tenant by code
      const q = query(collection(db, 'tenants'), where('code', '==', cleanCode));
      const snap = await getDocs(q);

      if (snap.empty) {
        setMessage({ type: 'error', text: 'Geçersiz salon kodu. Lütfen kodunuzu kontrol ediniz.' });
        setLoading(false);
        return;
      }

      const tenantDoc = snap.docs[0];
      const tenantData = tenantDoc.data();
      const tenantId = tenantDoc.id;

      // 2. Check if already has a membership or request
      const existingQ = query(
        collection(db, 'tenant_memberships'),
        where('userId', '==', userUid),
        where('tenantId', '==', tenantId)
      );
      const existingSnap = await getDocs(existingQ);

      if (!existingSnap.empty) {
        const existingData = existingSnap.docs[0].data();
        if (existingData.status === 'pending') {
          setMessage({ type: 'error', text: 'Bu salona daha önce katılım talebi gönderdiniz. Yönetici onayı bekleniyor.' });
        } else if (existingData.status === 'active') {
          setMessage({ type: 'success', text: 'Zaten bu salonun aktif üyesisiniz!' });
        } else {
          setMessage({ type: 'error', text: 'Bu salon üyeliği için talebiniz daha önce reddedildi.' });
        }
        setLoading(false);
        return;
      }

      // 3. Create 'pending' tenant_membership request
      await addDoc(collection(db, 'tenant_memberships'), {
        userId: userUid,
        tenantId: tenantId,
        tenantCode: cleanCode,
        tenantName: tenantData.name || cleanCode,
        status: 'pending',
        role: 'member',
        requestedAt: serverTimestamp(),
      });

      setMessage({
        type: 'success',
        text: `Katılım talebiniz '${tenantData.name}' yöneticisine iletildi. Onaylandıktan sonra salona erişebilirsiniz.`,
      });
      setGymCode('');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Error joining gym:', err);
      setMessage({ type: 'error', text: 'İstek gönderilirken bir hata oluştu: ' + (err.message || err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex justify-center mb-6">
          <GymEntraLogo size={64} showText={true} />
        </div>

        <h2 className="text-2xl font-bold text-center mb-2 text-white">Salona Katıl</h2>
        <p className="text-sm text-slate-400 text-center mb-6">
          Spor salonunuzun size verdiği **Salon Kodunu** (Örn: `TARABYA-01` veya `OLYMPUS-84`) girerek katılım talebi iletin.
        </p>

        {message && (
          <div
            className={`p-4 rounded-2xl mb-6 text-sm flex items-start gap-3 ${
              message.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
            }`}
          >
            <span>{message.type === 'success' ? '✓' : '⚠️'}</span>
            <p>{message.text}</p>
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Salon Kodu
            </label>
            <input
              type="text"
              value={gymCode}
              onChange={(e) => setGymCode(e.target.value.toUpperCase())}
              placeholder="Örn: OLYMPUS-84"
              required
              className="w-full bg-slate-950/80 border border-slate-800 text-white font-mono text-center text-lg tracking-widest rounded-2xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase placeholder-slate-600 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !gymCode.trim()}
            className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 font-bold text-base py-3.5 px-6 rounded-2xl shadow-lg hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Talep Gönderiliyor...' : 'Salona Katılma Talebi Gönder'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-500">
            Resepsiyondaki QR kodunu okutmak için yakında QR tarama eklenecektir.
          </p>
        </div>
      </div>
    </div>
  );
};
