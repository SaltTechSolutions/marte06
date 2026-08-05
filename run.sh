#!/usr/bin/env bash
# Otomatik uretildi: _scripts/gen-run.sh ile (Marte). Elle duzenlemek yerine
# .run-config.sh dosyasini duzenleyip bu script'i yeniden calistirin.
set -u

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

# ==== ORTAK BOLUM — elle degistirme; _scripts/gen-run.sh ile uretildi/guncellenir ====
# Bu blok, proje ayar blogundaki degiskenleri/fonksiyonlari kullanir:
#   APP_NAME, LOGO, DEFAULT_BACKEND_PORT, DEFAULT_FRONTEND_PORT
#   ensure_env(), backend_cmd(), frontend_cmd()
# Opsiyonel: extra_menu_items(), extra_menu_dispatch()

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR" || exit 1

# .env varsa portlari ezer (registry varsayilanlari alt sinir)
set -a
[ -f .env ] && . ./.env
set +a
BACKEND_PORT="${BACKEND_PORT:-$DEFAULT_BACKEND_PORT}"
FRONTEND_PORT="${FRONTEND_PORT:-$DEFAULT_FRONTEND_PORT}"

BACKEND_LOG="$ROOT_DIR/logs/backend.log"
BACKEND_PID="$ROOT_DIR/.run/backend.pid"
FRONTEND_LOG="$ROOT_DIR/logs/frontend.log"
FRONTEND_PID="$ROOT_DIR/.run/frontend.pid"
mkdir -p "$ROOT_DIR/logs" "$ROOT_DIR/.run"

if [ -n "$FRONTEND_PORT" ]; then
  FRONTEND_URL="http://localhost:${FRONTEND_PORT}"
elif [ -n "$BACKEND_PORT" ]; then
  FRONTEND_URL="http://localhost:${BACKEND_PORT}"
else
  FRONTEND_URL=""
fi

# ---- Port/PID yardimcilari (oracle/scripts/ports.sh deseni) ---------------

port_pid() {
  lsof -ti "tcp:$1" -sTCP:LISTEN 2>/dev/null | head -n1
}

pid_name() {
  ps -p "$1" -o comm= 2>/dev/null | tr -d ' '
}

graceful_kill() {
  local pid="$1"
  kill -0 "$pid" 2>/dev/null || return 0
  kill -TERM "$pid" 2>/dev/null || true
  local i=0
  while [ "$i" -lt 20 ]; do
    kill -0 "$pid" 2>/dev/null || return 0
    sleep 0.25
    i=$((i + 1))
  done
  kill -KILL "$pid" 2>/dev/null || true
}

kill_port() {
  local port="$1" label="$2" pid
  [ -z "$port" ] && return 0
  pid="$(port_pid "$port")"
  if [ -n "$pid" ]; then
    echo -e "${YELLOW}$label portu $port kullanimda (PID $pid, $(pid_name "$pid")), durduruluyor...${NC}"
    graceful_kill "$pid"
  fi
}

pid_status() {
  local pid_file="$1"
  if [ -f "$pid_file" ] && ps -p "$(cat "$pid_file")" >/dev/null 2>&1; then
    echo -e "${GREEN}CALISIYOR${NC} (PID: $(cat "$pid_file"))"
  else
    echo -e "${RED}DURDU${NC}"
  fi
}

show_urls() {
  if [ -n "$FRONTEND_URL" ]; then
    echo -e "${BOLD}${GREEN}>>> Uygulama: ${FRONTEND_URL} <<<${NC}"
  fi
  if [ -n "$FRONTEND_PORT" ] && [ -n "$BACKEND_PORT" ]; then
    echo -e "    Backend : http://localhost:$BACKEND_PORT"
  fi
}

print_header() {
  clear
  echo -e "${BLUE}${BOLD}${LOGO}${NC}"
  echo -e "${BOLD}$APP_NAME${NC}"
  echo "------------------------------------------------"
  if [ -n "$DEFAULT_BACKEND_PORT" ]; then
    echo -e "Backend : $(pid_status "$BACKEND_PID")  http://localhost:$BACKEND_PORT"
  fi
  if [ -n "$DEFAULT_FRONTEND_PORT" ]; then
    echo -e "Frontend: $(pid_status "$FRONTEND_PID")  http://localhost:$FRONTEND_PORT"
  fi
  echo "------------------------------------------------"
  show_urls
  echo "------------------------------------------------"
}

pause() {
  echo
  read -r -p "Devam etmek icin Enter > "
}

# ---- Start/stop -------------------------------------------------------

start_backend() {
  [ -z "$DEFAULT_BACKEND_PORT" ] && return 0
  kill_port "$BACKEND_PORT" "Backend"
  type ensure_env >/dev/null 2>&1 && ensure_env
  echo -e "${GREEN}Backend baslatiliyor...${NC}"
  ( backend_cmd ) >"$BACKEND_LOG" 2>&1 &
  echo $! > "$BACKEND_PID"
  disown %+ 2>/dev/null || true
  sleep 1
  if ! ps -p "$(cat "$BACKEND_PID" 2>/dev/null)" >/dev/null 2>&1; then
    echo -e "${RED}Backend hemen sonlandi. Log:${NC}"
    tail -n 20 "$BACKEND_LOG" 2>/dev/null
    rm -f "$BACKEND_PID"
    return 1
  fi
}

start_frontend() {
  [ -z "$DEFAULT_FRONTEND_PORT" ] && return 0
  kill_port "$FRONTEND_PORT" "Frontend"
  echo -e "${GREEN}Frontend baslatiliyor...${NC}"
  ( frontend_cmd ) >"$FRONTEND_LOG" 2>&1 &
  echo $! > "$FRONTEND_PID"
  disown %+ 2>/dev/null || true
  sleep 1
  if ! ps -p "$(cat "$FRONTEND_PID" 2>/dev/null)" >/dev/null 2>&1; then
    echo -e "${RED}Frontend hemen sonlandi. Log:${NC}"
    tail -n 20 "$FRONTEND_LOG" 2>/dev/null
    rm -f "$FRONTEND_PID"
    return 1
  fi
}

stop_backend() {
  if [ -f "$BACKEND_PID" ]; then
    local pid; pid="$(cat "$BACKEND_PID")"
    if ps -p "$pid" >/dev/null 2>&1; then
      echo -e "${RED}Backend durduruluyor (PID: $pid)...${NC}"
      graceful_kill "$pid"
    fi
    rm -f "$BACKEND_PID"
  fi
  kill_port "$BACKEND_PORT" "Backend"
}

stop_frontend() {
  if [ -f "$FRONTEND_PID" ]; then
    local pid; pid="$(cat "$FRONTEND_PID")"
    if ps -p "$pid" >/dev/null 2>&1; then
      echo -e "${RED}Frontend durduruluyor (PID: $pid)...${NC}"
      graceful_kill "$pid"
    fi
    rm -f "$FRONTEND_PID"
  fi
  kill_port "$FRONTEND_PORT" "Frontend"
}

do_start() {
  local ok=1
  start_backend || ok=0
  start_frontend || ok=0
  if [ "$ok" = "1" ]; then
    echo -e "${GREEN}Hazir.${NC}"
    show_urls
  else
    echo -e "${RED}Baslatma basarisiz.${NC}"
    return 1
  fi
}

do_stop() {
  stop_frontend
  stop_backend
  echo -e "${RED}Durduruldu.${NC}"
}

do_status() {
  if [ -n "$DEFAULT_BACKEND_PORT" ]; then
    echo -e "Backend : $(pid_status "$BACKEND_PID")  http://localhost:$BACKEND_PORT"
  fi
  if [ -n "$DEFAULT_FRONTEND_PORT" ]; then
    echo -e "Frontend: $(pid_status "$FRONTEND_PID")  http://localhost:$FRONTEND_PORT"
  fi
}

do_logs() {
  touch "$BACKEND_LOG" "$FRONTEND_LOG"
  echo -e "${BLUE}Loglar izleniyor (cikmak icin Ctrl+C)...${NC}"
  tail -f "$BACKEND_LOG" "$FRONTEND_LOG" 2>/dev/null
}

usage() {
  echo "Kullanim: ./run.sh [start|stop|restart|status|logs]"
  echo "Argumansiz calistirilirsa interaktif menu acilir."
}

# ---- Interaktif menu -------------------------------------------------

menu() {
  while true; do
    print_header
    echo -e "${BOLD}Menu${NC}"
    echo "1) Baslat / yeniden baslat"
    echo "2) Durdur"
    echo "3) Durum"
    echo "4) Log goster"
    if type extra_menu_items >/dev/null 2>&1; then extra_menu_items; fi
    echo "Q) Cikis (uygulamayi durdurmadan)"
    echo
    read -r -p "Secim > " choice
    case "$choice" in
      1) do_stop; do_start; pause ;;
      2) do_stop; pause ;;
      3) do_status; pause ;;
      4) do_logs ;;
      q|Q) echo "Cikis yapildi (servisler calismaya devam ediyor)."; exit 0 ;;
      *)
        if type extra_menu_dispatch >/dev/null 2>&1 && extra_menu_dispatch "$choice"; then
          pause
        else
          echo -e "${RED}Gecersiz secim.${NC}"; sleep 1
        fi
        ;;
    esac
  done
}

# ---- Dispatch -------------------------------------------------------

case "${1:-}" in
  start)   do_start ;;
  stop)    do_stop ;;
  restart) do_stop; do_start ;;
  status)  do_status ;;
  logs)    do_logs ;;
  "")      menu ;;
  *)       usage; exit 2 ;;
esac
