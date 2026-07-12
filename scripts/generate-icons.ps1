param([string]$OutputDirectory = (Join-Path $PSScriptRoot "..\resources"))

Add-Type -AssemblyName System.Drawing
[System.IO.Directory]::CreateDirectory($OutputDirectory) | Out-Null

$bitmap = New-Object System.Drawing.Bitmap 256, 256
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)

$black = [System.Drawing.Color]::FromArgb(255, 32, 33, 35)
$white = [System.Drawing.Color]::FromArgb(255, 251, 251, 252)
$green = [System.Drawing.Color]::FromArgb(255, 33, 163, 102)
$blackBrush = New-Object System.Drawing.SolidBrush $black
$whitePen = New-Object System.Drawing.Pen $white, 18
$whitePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$whitePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$greenBrush = New-Object System.Drawing.SolidBrush $green

$graphics.FillEllipse($blackBrush, 12, 12, 232, 232)
$graphics.DrawArc($whitePen, 64, 57, 128, 142, 48, 263)
$graphics.DrawLine($whitePen, 134, 66, 168, 66)
$graphics.FillEllipse($greenBrush, 176, 174, 37, 37)

$pngPath = Join-Path $OutputDirectory "icon.png"
$icoPath = Join-Path $OutputDirectory "icon.ico"
$bitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)
$icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
$stream = [System.IO.File]::Open($icoPath, [System.IO.FileMode]::Create)
$icon.Save($stream)
$stream.Close()

$icon.Dispose()
$whitePen.Dispose()
$blackBrush.Dispose()
$greenBrush.Dispose()
$graphics.Dispose()
$bitmap.Dispose()

Write-Output $pngPath
Write-Output $icoPath
