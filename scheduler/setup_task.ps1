# setup_task.ps1
# Chạy script này 1 lần duy nhất (Run as Administrator) để đăng ký Task Scheduler
# Sau đó mỗi đêm 1:00 AM sẽ tự động cào dữ liệu

$TaskName   = "NightlyCrawl_TruyenNgonTinh"
$BatFile    = "d:\Desktop\Daily\scheduler\crawl_nightly.bat"
$TriggerTime = "01:00"   # Giờ chạy mỗi đêm (HH:mm, 24h)
$ProjectDir  = "d:\Desktop\Daily"

Write-Host "=== Cai dat Windows Task Scheduler ===" -ForegroundColor Cyan

# Xoá task cũ nếu có
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "[OK] Da xoa task cu." -ForegroundColor Yellow
}

# Tạo Action: chạy file .bat
$Action = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c `"$BatFile`"" `
    -WorkingDirectory $ProjectDir

# Trigger: mỗi ngày lúc 1:00 AM
$Trigger = New-ScheduledTaskTrigger -Daily -At $TriggerTime

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

# Đăng ký Task
Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description "Tu dong cao du lieu truyen Ngon Tinh, BL, Teamsany moi dem luc $TriggerTime" `
    -Force | Out-Null

Write-Host ""
Write-Host "=== HOAN TAT! ===" -ForegroundColor Green
Write-Host "Task: $TaskName" -ForegroundColor White
Write-Host "Chay moi dem luc: $TriggerTime" -ForegroundColor White
Write-Host "Log luu tai: d:\Desktop\Daily\scheduler\logs\" -ForegroundColor White
Write-Host ""
Write-Host "Lenh quan ly:" -ForegroundColor Cyan
Write-Host "  Xem trang thai : Get-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
Write-Host "  Chay ngay bay gio: Start-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Gray
Write-Host "  Xoa task       : Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false" -ForegroundColor Gray
