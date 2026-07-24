# Marte — Üye ve Ders Yönetimi

Spor salonu/yoga stüdyoları için üye ve ders yönetim sistemi (PWA).

## Yığın
- **Vite + React + TypeScript**, Firebase (Auth/Firestore) backend — yerel sunucu yok.

## Port
- `FRONTEND_PORT=9051` (`.env`'den okunur, bkz. `Codes/PORTS.md`).

## Çalıştırma
```bash
./run.sh            # interaktif menü (logo, durum, log)
./run.sh start|stop|restart|status|logs
```

## Not
`Codes/Marte/` hem kendisi hem `marte06/` alt klasörü ayrı ayrı git repoları — proje kodu `marte06/` içinde, üstteki `Marte/.git` muhtemelen eski/artık kullanılmayan bir repo. Silinmeden önce kullanıcıya danışılmalı.
