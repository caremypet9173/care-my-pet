param(
  [Parameter(Mandatory=$true)][string]$SrcPath,
  [Parameter(Mandatory=$true)][string]$OutPath,
  [Parameter(Mandatory=$true)][double]$GreenTargetHue,
  [Parameter(Mandatory=$true)][double]$OrangeTargetHue,
  [double]$GreenSatScale = 1.0,
  [double]$OrangeSatScale = 1.0
)
Add-Type -AssemblyName System.Drawing

function RgbToHsl($r,$g,$b) {
  $rf=$r/255.0; $gf=$g/255.0; $bf=$b/255.0
  $max=[Math]::Max($rf,[Math]::Max($gf,$bf))
  $min=[Math]::Min($rf,[Math]::Min($gf,$bf))
  $l=($max+$min)/2
  if ($max -eq $min) { return ,(0,0,$l) }
  $d=$max-$min
  $s = if ($l -gt 0.5) { $d/(2-$max-$min) } else { $d/($max+$min) }
  if ($max -eq $rf) { $h = 60*((($gf-$bf)/$d) % 6) }
  elseif ($max -eq $gf) { $h = 60*((($bf-$rf)/$d)+2) }
  else { $h = 60*((($rf-$gf)/$d)+4) }
  if ($h -lt 0) { $h += 360 }
  return ,($h,$s,$l)
}

function HueToRgb($p,$q,$t) {
  if ($t -lt 0) { $t += 1 }
  if ($t -gt 1) { $t -= 1 }
  if ($t -lt (1/6)) { return $p + ($q-$p)*6*$t }
  if ($t -lt 0.5) { return $q }
  if ($t -lt (2/3)) { return $p + ($q-$p)*(2/3-$t)*6 }
  return $p
}
function HslToRgb($h,$s,$l) {
  if ($s -eq 0) { $v=[int]([Math]::Round($l*255)); return ,($v,$v,$v) }
  $q = if ($l -lt 0.5) { $l*(1+$s) } else { $l+$s-$l*$s }
  $p = 2*$l - $q
  $hn = $h/360.0
  $r = HueToRgb $p $q ($hn+1/3)
  $g = HueToRgb $p $q $hn
  $b = HueToRgb $p $q ($hn-1/3)
  return ,([int][Math]::Round($r*255), [int][Math]::Round($g*255), [int][Math]::Round($b*255))
}

$src = New-Object System.Drawing.Bitmap($SrcPath)
$w = $src.Width; $h = $src.Height
$rect = New-Object System.Drawing.Rectangle(0,0,$w,$h)
$fmt = [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
$data = $src.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, $fmt)
$stride = $data.Stride
$bytes = New-Object byte[] ($stride * $h)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
$src.UnlockBits($data)

for ($y = 0; $y -lt $h; $y++) {
  $rowOff = $y * $stride
  for ($x = 0; $x -lt $w; $x++) {
    $off = $rowOff + $x*4
    $a = $bytes[$off+3]
    if ($a -lt 5) { continue }
    $b = $bytes[$off]; $g = $bytes[$off+1]; $r = $bytes[$off+2]
    $hsl = RgbToHsl $r $g $b
    $hh=$hsl[0]; $ss=$hsl[1]; $ll=$hsl[2]
    if ($ss -lt 0.12) { continue }  # near-gray/white/black: leave unchanged (outlines, paper, wordmark)
    $newHue = $null; $newSat = $ss
    if ($hh -ge 80 -and $hh -le 175) { $newHue = $GreenTargetHue; $newSat = $ss * $GreenSatScale }
    elseif ($hh -ge 8 -and $hh -le 58) { $newHue = $OrangeTargetHue; $newSat = $ss * $OrangeSatScale }
    if ($null -ne $newHue) {
      if ($newSat -gt 1) { $newSat = 1 }
      $rgb = HslToRgb $newHue $newSat $ll
      $bytes[$off]   = [byte]$rgb[2]
      $bytes[$off+1] = [byte]$rgb[1]
      $bytes[$off+2] = [byte]$rgb[0]
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
