@echo off
setlocal

echo ========================================
echo   Prism Build Script - Linux AMD64
echo ========================================

:: 设置变量
set APP_NAME=prism
set OUTPUT_DIR=dist
set VERSION=1.0.0

:: 获取当前时间作为构建时间
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set BUILD_TIME=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2% %datetime:~8,2%:%datetime:~10,2%:%datetime:~12,2%

echo.
echo [1/4] Cleaning output directory...
if exist %OUTPUT_DIR% rd /s /q %OUTPUT_DIR%
mkdir %OUTPUT_DIR%

echo.
echo [2/4] Installing frontend dependencies...
cd console
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] npm install failed!
    cd ..
    exit /b 1
)

echo.
echo [3/4] Building frontend (will be embedded in binary)...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Frontend build failed!
    cd ..
    exit /b 1
)
cd ..

echo.
echo [4/4] Building backend for Linux AMD64 (with embedded console)...
set GOOS=linux
set GOARCH=amd64
set CGO_ENABLED=0

go build -ldflags="-s -w -X main.Version=%VERSION% -X 'main.BuildTime=%BUILD_TIME%'" -o %OUTPUT_DIR%/%APP_NAME% ./cmd/server

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Backend build failed!
    exit /b 1
)

:: 复制示例配置
mkdir %OUTPUT_DIR%\configs
if exist configs\config.example.yaml copy configs\config.example.yaml %OUTPUT_DIR%\configs\

echo.
echo ========================================
echo   Build completed successfully!
echo ========================================
echo   Output:  %OUTPUT_DIR%/%APP_NAME%
echo   Config:  %OUTPUT_DIR%/configs/config.example.yaml
echo   OS:      linux
echo   Arch:    amd64
echo   Version: %VERSION%
echo   Time:    %BUILD_TIME%
echo ========================================
echo.
echo   Deploy:
echo   1. Upload prism and configs/ to server
echo   2. Rename config.example.yaml to config.yaml
echo   3. Edit config.yaml with your settings
echo   4. Run: ./prism
echo ========================================

endlocal
