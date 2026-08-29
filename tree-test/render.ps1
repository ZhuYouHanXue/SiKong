Add-Type -AssemblyName System.Drawing

$root = $PSScriptRoot
$data = Get-Content (Join-Path $root 'tree-data.json') | ConvertFrom-Json

$bmp = New-Object System.Drawing.Bitmap([int]$data.w, [int]$data.h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAlias'
$g.Clear([System.Drawing.Color]::White)

$inkBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(107, 0, 0, 0))
foreach ($e in $data.edges) {
  $pts = @()
  foreach ($p in $e.poly) {
    $pts += [System.Drawing.PointF]::new([float]$p[0], [float]$p[1])
  }
  $g.FillPolygon($inkBrush, $pts)
}

$seal = [System.Drawing.Color]::FromArgb(194, 12, 12)
$dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(179, 194, 12, 12))
$textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(230, 194, 12, 12))
$font = New-Object System.Drawing.Font('Microsoft YaHei', 13)

foreach ($n in $data.nodes) {
  $isCurrent = $n.id -eq $data.currentId
  $r = if ($isCurrent) { 6.0 } else { 3.0 }
  $g.FillEllipse($dotBrush, [float]$n.x - $r, [float]$n.y - $r, 2 * $r, 2 * $r)
  $g.DrawString([string]$n.tail, $font, $textBrush, [float]$n.x + 6, [float]$n.y - 8)
  if ($isCurrent) {
    for ($i = 0; $i -lt 5; $i += 1) {
      $a = (-[Math]::PI / 2) + $i * ((2 * [Math]::PI) / 5)
      $cx = [float]$n.x + [Math]::Cos($a) * 9
      $cy = [float]$n.y + [Math]::Sin($a) * 9
      $g.FillEllipse($dotBrush, $cx - 6, $cy - 4, 12, 8)
    }
    $g.FillEllipse($dotBrush, [float]$n.x - 3.5, [float]$n.y - 3.5, 7, 7)
  }
}

$g.Dispose()
$bmp.Save((Join-Path $root 'tree.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output 'wrote tree.png'
