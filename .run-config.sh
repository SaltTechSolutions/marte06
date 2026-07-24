# ==== PROJE AYARLARI (gen-run.sh uretti/kullanir) ==========================
APP_NAME="MARTE — Uye ve Ders Yonetimi"
IFS= read -r -d '' LOGO <<'ASCII' || true
 __  __    _    ____ _____ _____
|  \/  |  / \  |  _ \_   _| ____|
| |\/| | / _ \ | |_) || | |  _|
| |  | |/ ___ \|  _ < | | | |___
|_|  |_/_/   \_\_| \_\|_| |_____|
ASCII
DEFAULT_BACKEND_PORT=""
DEFAULT_FRONTEND_PORT=9051

ensure_env() {
  [ -d "node_modules" ] || npm install
}

frontend_cmd() {
  exec npm run dev -- --port "$FRONTEND_PORT" --strictPort
}
