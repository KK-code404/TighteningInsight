@echo off
REM CHANGE [2026-09-09 15:18 +08:00] [WH400]: 提供 Windows 内网环境的一键启动入口并自动准备前端产物。
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  py -3.11 -m venv .venv
  call .venv\Scripts\activate.bat
  python -m pip install -r requirements.txt
  REM CHANGE [2026-09-09 15:18 +08:00] [WH400]: 首次安装同步准备 Chromium，确保自动导出脚本无需额外手工步骤。
  python -m playwright install chromium
) else (
  call .venv\Scripts\activate.bat
)
if not exist "frontend\node_modules" (
  pushd frontend
  call npm install
  popd
)
pushd frontend
call npm run build
popd
python -m backend.main
endlocal
