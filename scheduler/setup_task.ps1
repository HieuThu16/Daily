# setup_task.ps1
# Chạy script này 1 lần duy nhất để đăng ký Task Scheduler
# KHÔNG cần quyền Administrator

$TaskName   = "NightlyCrawl_TruyenNgonTinh"
$BatFile    = "d:\Desktop\Daily\scheduler\crawl_nightly.bat"
$ProjectDir  = "d:\Desktop\Daily"

Write-Host "=== Cai dat Windows Task Scheduler ===" -ForegroundColor Cyan

# Xoá task cũ nếu có
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "[OK] Da xoa task cu." -ForegroundColor Yellow
}

# Action: chạy file .bat
$Action = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/d /c call `"$BatFile`"" `
    -WorkingDirectory $ProjectDir

# ── Trigger 1: Mỗi ngày lúc 1:00 AM ─────────────────────────────────
$Trigger1 = New-ScheduledTaskTrigger -Daily -At "01:00"

# ── Trigger 2: Khi đăng nhập vào Windows ─────────────────────────────
# → Đảm bảo chạy ngay khi bật máy, dù lỡ giờ 1 AM
# → File .bat tự check flag "hôm nay đã chạy chưa" nên không bị double-run
$Trigger2 = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME

# Settings
$Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 6) `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -MultipleInstances IgnoreNew

# Principal: chạy với user hiện tại khi đã login
$Principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType Interactive `
    -RunLevel Limited

# Đăng ký Task với CẢ 2 trigger
Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger @($Trigger1, $Trigger2) `
    -Settings $Settings `
    -Principal $Principal `
    -Description "Tu dong cao truyen Ngon Tinh, BL va H. Chay luc 1AM hoac ngay khi dang nhap Windows (1 lan/ngay)." `
    -Force | Out-Null

Write-Host ""
Write-Host "=== HOAN TAT! ===" -ForegroundColor Green
Write-Host ""
Write-Host "  Trigger 1 : Moi ngay luc 01:00 AM" -ForegroundColor White
Write-Host "  Trigger 2 : Ngay khi dang nhap Windows (bat may la chay)" -ForegroundColor White
Write-Host "  Bao ve    : Chi chay 1 lan/ngay (file flag)" -ForegroundColor White
Write-Host "  Log luu   : d:\Desktop\Daily\scheduler\logs\" -ForegroundColor White
Write-Host ""
Write-Host "Lenh quan ly:" -ForegroundColor Cyan
Write-Host "  Chay ngay bay gio : Start-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
Write-Host "  Xem trang thai    : Get-ScheduledTaskInfo -TaskName '$TaskName'" -ForegroundColor Gray
Write-Host "  Xoa task          : Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false" -ForegroundColor Gray
