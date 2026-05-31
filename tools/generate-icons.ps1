param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$electronAssets = Join-Path $Root 'electron\assets'
$webPublic = Join-Path $Root 'web\public'
$mobileWww = Join-Path $Root 'mobile\www'
$iosIcon = Join-Path $Root 'mobile\ios\App\App\Assets.xcassets\AppIcon.appiconset\AppIcon-512@2x.png'
$androidBase = Join-Path $Root 'mobile\android\app\src\main\res'

New-Item -ItemType Directory -Force -Path $electronAssets, $webPublic | Out-Null

function New-Brush($color) {
  return New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($color))
}

function New-Pen($color, [float]$width) {
  $pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml($color), $width)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  return $pen
}

function Add-RoundedRectangle($path, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
}

function Draw-Icon([int]$size, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear([System.Drawing.Color]::Transparent)

  $s = [float]$size
  $shadow = New-Brush '#000000'
  $shadow.Color = [System.Drawing.Color]::FromArgb(30, $shadow.Color)
  $shadowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  Add-RoundedRectangle $shadowPath ($s * 0.16) ($s * 0.18) ($s * 0.68) ($s * 0.66) ($s * 0.22)
  $matrix = New-Object System.Drawing.Drawing2D.Matrix
  $matrix.Translate(0, $s * 0.035)
  $shadowPath.Transform($matrix)
  $g.FillPath($shadow, $shadowPath)

  $bodyPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  Add-RoundedRectangle $bodyPath ($s * 0.15) ($s * 0.14) ($s * 0.70) ($s * 0.68) ($s * 0.23)
  $bodyRect = New-Object System.Drawing.RectangleF 0, 0, $s, $s
  $body = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    $bodyRect,
    [System.Drawing.ColorTranslator]::FromHtml('#FFE55A'),
    [System.Drawing.ColorTranslator]::FromHtml('#FFD400'),
    [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
  )
  $g.FillPath($body, $bodyPath)

  $rimPen = New-Pen '#1F2328' ($s * 0.028)
  $rimPen.Color = [System.Drawing.Color]::FromArgb(28, $rimPen.Color)
  $g.DrawPath($rimPen, $bodyPath)

  $highlight = New-Brush '#FFF6A3'
  $g.FillEllipse($highlight, $s * 0.24, $s * 0.21, $s * 0.19, $s * 0.11)

  $dark = New-Brush '#1F2328'
  $eyeW = [Math]::Max(2, $s * 0.055)
  $eyeH = [Math]::Max(2, $s * 0.078)
  $g.FillEllipse($dark, $s * 0.33, $s * 0.34, $eyeW, $eyeH)
  $g.FillEllipse($dark, $s * 0.61, $s * 0.34, $eyeW, $eyeH)

  $smilePen = New-Pen '#1F2328' ([Math]::Max(1.4, $s * 0.023))
  $g.DrawArc($smilePen, $s * 0.405, $s * 0.40, $s * 0.19, $s * 0.14, 20, 140)

  $cheek = New-Brush '#FF9E90'
  $cheek.Color = [System.Drawing.Color]::FromArgb(120, $cheek.Color)
  $g.FillEllipse($cheek, $s * 0.235, $s * 0.43, $s * 0.105, $s * 0.055)
  $g.FillEllipse($cheek, $s * 0.66, $s * 0.43, $s * 0.105, $s * 0.055)

  $armPen = New-Pen '#1F2328' ([Math]::Max(2.2, $s * 0.035))
  $armPen.Color = [System.Drawing.Color]::FromArgb(54, $armPen.Color)
  $g.DrawLine($armPen, $s * 0.165, $s * 0.53, $s * 0.08, $s * 0.48)
  $g.DrawLine($armPen, $s * 0.835, $s * 0.53, $s * 0.92, $s * 0.48)

  $fontSize = $s * 0.235
  $font = New-Object System.Drawing.Font 'Arial Black', $fontSize, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $letterRect = New-Object System.Drawing.RectangleF ($s * 0.20), ($s * 0.50), ($s * 0.60), ($s * 0.23)
  $g.DrawString('E', $font, $dark, $letterRect, $format)

  $foot = New-Brush '#1F2328'
  $foot.Color = [System.Drawing.Color]::FromArgb(72, $foot.Color)
  $g.FillEllipse($foot, $s * 0.31, $s * 0.78, $s * 0.14, $s * 0.055)
  $g.FillEllipse($foot, $s * 0.55, $s * 0.78, $s * 0.14, $s * 0.055)

  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $format.Dispose()
  $font.Dispose()
  $foot.Dispose()
  $armPen.Dispose()
  $cheek.Dispose()
  $smilePen.Dispose()
  $dark.Dispose()
  $highlight.Dispose()
  $rimPen.Dispose()
  $body.Dispose()
  $bodyRect = $null
  $bodyPath.Dispose()
  $matrix.Dispose()
  $shadowPath.Dispose()
  $shadow.Dispose()
  $g.Dispose()
  $bmp.Dispose()
}

function Write-Ico([string]$path, [string[]]$pngFiles) {
  $entries = @()
  $offset = 6 + (16 * $pngFiles.Count)
  foreach ($file in $pngFiles) {
    $bytes = [System.IO.File]::ReadAllBytes($file)
    $image = [System.Drawing.Image]::FromFile($file)
    $width = if ($image.Width -ge 256) { 0 } else { [byte]$image.Width }
    $height = if ($image.Height -ge 256) { 0 } else { [byte]$image.Height }
    $image.Dispose()
    $entries += [pscustomobject]@{ Width = $width; Height = $height; Bytes = $bytes; Offset = $offset }
    $offset += $bytes.Length
  }

  $stream = New-Object System.IO.MemoryStream
  $writer = New-Object System.IO.BinaryWriter $stream
  $writer.Write([UInt16]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]$entries.Count)
  foreach ($entry in $entries) {
    $writer.Write([byte]$entry.Width)
    $writer.Write([byte]$entry.Height)
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]32)
    $writer.Write([UInt32]$entry.Bytes.Length)
    $writer.Write([UInt32]$entry.Offset)
  }
  foreach ($entry in $entries) {
    $writer.Write($entry.Bytes)
  }
  [System.IO.File]::WriteAllBytes($path, $stream.ToArray())
  $writer.Dispose()
  $stream.Dispose()
}

$sizes = @(16, 32, 48, 192, 256, 512, 1024)
$generated = @{}
foreach ($size in $sizes) {
  $tmpPath = Join-Path $electronAssets "icon_$size.png"
  Draw-Icon $size $tmpPath
  $generated[$size] = $tmpPath
}

Copy-Item $generated[512] (Join-Path $webPublic 'icon-512.png') -Force
Copy-Item $generated[192] (Join-Path $webPublic 'icon-192.png') -Force
Copy-Item $generated[256] (Join-Path $electronAssets 'icon.png') -Force
Write-Ico (Join-Path $electronAssets 'icon.ico') @($generated[16], $generated[32], $generated[48], $generated[256])

if (Test-Path $mobileWww) {
  Copy-Item $generated[512] (Join-Path $mobileWww 'icon-512.png') -Force
  Copy-Item $generated[192] (Join-Path $mobileWww 'icon-192.png') -Force
}

if (Test-Path (Split-Path $iosIcon)) {
  Copy-Item $generated[1024] $iosIcon -Force
}

$androidIcons = @{
  'mipmap-mdpi' = 48
  'mipmap-hdpi' = 72
  'mipmap-xhdpi' = 96
  'mipmap-xxhdpi' = 144
  'mipmap-xxxhdpi' = 192
}
foreach ($density in $androidIcons.Keys) {
  $dir = Join-Path $androidBase $density
  if (Test-Path $dir) {
    $size = $androidIcons[$density]
    $temp = Join-Path $env:TEMP "e-messenger-icon-$size.png"
    Draw-Icon $size $temp
    Copy-Item $temp (Join-Path $dir 'ic_launcher.png') -Force
    Copy-Item $temp (Join-Path $dir 'ic_launcher_round.png') -Force
    Copy-Item $temp (Join-Path $dir 'ic_launcher_foreground.png') -Force
    Remove-Item $temp -Force
  }
}

Write-Host "Generated E-Messenger mascot icons."
