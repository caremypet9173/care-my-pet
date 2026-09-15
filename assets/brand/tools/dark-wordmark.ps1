param(
  [Parameter(Mandatory=$true)][string]$SrcPath,
  [Parameter(Mandatory=$true)][string]$OutPath,
  [Parameter(Mandatory=$true)][int]$TextRegionYStart,
  [string]$LightHex = "F2EFE6"
)
Add-Type -AssemblyName System.Drawing

$lr = [Convert]::ToInt32($LightHex.Substring(0,2),16)
$lg = [Convert]::ToInt32($LightHex.Substring(2,2),16)
$lb = [Convert]::ToInt32($LightHex.Substring(4,2),16)

$src = New-Object System.Drawing.Bitmap($SrcPath)
$w = $src.Width; $h = $src.Height
$rect = New-Object System.Drawing.Rectangle(0,0,$w,$h)
$fmt = [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
$data = $src.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, $fmt)
$stride = $data.Stride
$bytes = New-Object byte[] ($stride * $h)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
$src.UnlockBits($data)

for ($y = $TextRegionYStart; $y -lt $h; $y++) {
  $rowOff = $y * $stride
  for ($x = 0; $x -lt $w; $x++) {
    $off = $rowOff + $x*4
    $a = $bytes[$off+3]
    if ($a -lt 5) { continue }
    $b=$bytes[$off]; $g=$bytes[$off+1]; $r=$bytes[$off+2]
    $lum = 0.299*$r + 0.587*$g + 0.114*$b
    if ($lum -lt 100) {
      # blend toward light color proportional to how dark it was (preserve antialiased edges)
      $t = 1 - ($lum/100.0)
      $nr = [int]($r + ($lr-$r)*$t)
      $ng = [int]($g + ($lg-$g)*$t)
      $nb = [int]($b + ($lb-$b)*$t)
      $bytes[$off]  = [byte]$nb
      $bytes[$off+1]= [byte]$ng
      $bytes[$off+2]= [byte]$nr
    }
  }
}

$out = New-Object System.Drawing.Bitmap($w, $h, $fmt)
$outData = $out.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, $fmt)
[System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $outData.Scan0, $bytes.Length)
$out.UnlockBits($outData)
$out.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
$out.Dispose(); $src.Dispose()
Write-Output "wrote $OutPath"
