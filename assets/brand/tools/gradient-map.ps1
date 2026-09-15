param(
  [Parameter(Mandatory=$true)][string]$SrcPath,
  [Parameter(Mandatory=$true)][string]$OutPath,
  [Parameter(Mandatory=$true)][string]$Theme  # "teal" or "terracotta"
)
Add-Type -AssemblyName System.Drawing

# control points: luminance -> RGB. Interpolated piecewise-linear.
# Verified empirically by correlating bw luminance buckets against the color reference image:
# lum 0 = outline, 72 = dog (primary), 144-152 = hand (primary/primary-soft mix), 168-176 = heart (accent), 192-216 = cat (primary-soft), 248 = gloss highlight
if ($Theme -eq "teal") {
  $stops = @(
    @{L=0;   R=14;  G=59;  B=57},
    @{L=60;  R=14;  G=59;  B=57},
    @{L=72;  R=18;  G=110; B=106},
    @{L=100; R=18;  G=110; B=106},
    @{L=144; R=71;  G=156; B=136},
    @{L=152; R=71;  G=156; B=136},
    @{L=168; R=242; G=112; B=95},
    @{L=176; R=242; G=112; B=95},
    @{L=192; R=124; G=201; B=166},
    @{L=216; R=124; G=201; B=166},
    @{L=248; R=183; G=225; B=206},
    @{L=255; R=183; G=225; B=206}
  )
} elseif ($Theme -eq "terracotta") {
  $stops = @(
    @{L=0;   R=44;  G=68;  B=51},
    @{L=60;  R=44;  G=68;  B=51},
    @{L=72;  R=62;  G=107; B=74},
    @{L=100; R=62;  G=107; B=74},
    @{L=144; R=110; G=147; B=117},
    @{L=152; R=110; G=147; B=117},
    @{L=168; R=192; G=90;  B=56},
    @{L=176; R=192; G=90;  B=56},
    @{L=192; R=157; G=187; B=160},
    @{L=216; R=157; G=187; B=160},
    @{L=248; R=201; G=218; B=203},
    @{L=255; R=201; G=218; B=203}
  )
} elseif ($Theme -eq "terracotta-muted") {
  $stops = @(
    @{L=0;   R=44;  G=68;  B=51},
    @{L=60;  R=44;  G=68;  B=51},
    @{L=72;  R=75;  G=99;  B=81},
    @{L=100; R=75;  G=99;  B=81},
    @{L=144; R=120; G=141; B=124},
    @{L=152; R=120; G=141; B=124},
    @{L=168; R=181; G=94;  B=65},
    @{L=176; R=181; G=94;  B=65},
    @{L=192; R=165; G=182; B=167},
    @{L=216; R=165; G=182; B=167},
    @{L=248; R=201; G=218; B=203},
    @{L=255; R=201; G=218; B=203}
  )
} else { throw "unknown theme $Theme" }

function LutColor($lum) {
  for ($i = 0; $i -lt $stops.Count - 1; $i++) {
    $a = $stops[$i]; $b = $stops[$i+1]
    if ($lum -ge $a.L -and $lum -le $b.L) {
      $t = if ($b.L -eq $a.L) { 0 } else { ($lum - $a.L) / ($b.L - $a.L) }
      $r = [int]($a.R + ($b.R - $a.R) * $t)
      $g = [int]($a.G + ($b.G - $a.G) * $t)
      $bl = [int]($a.B + ($b.B - $a.B) * $t)
      return ,($r,$g,$bl)
    }
  }
  return ,($stops[-1].R, $stops[-1].G, $stops[-1].B)
}

# precompute LUT for all 256 luminance values
$LUT = New-Object 'object[]' 256
for ($l = 0; $l -lt 256; $l++) { $LUT[$l] = LutColor $l }

$src = New-Object System.Drawing.Bitmap($SrcPath)
$w = $src.Width; $h = $src.Height
$rect = New-Object System.Drawing.Rectangle(0,0,$w,$h)
$fmt = [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
$data = $src.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, $fmt)
$stride = $data.Stride
$bytes = New-Object byte[] ($stride * $h)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
$src.UnlockBits($data)

$outBytes = New-Object byte[] ($stride * $h)
for ($y = 0; $y -lt $h; $y++) {
  $rowOff = $y * $stride
  for ($x = 0; $x -lt $w; $x++) {
    $off = $rowOff + $x*4
    $b = $bytes[$off]; $g = $bytes[$off+1]; $r = $bytes[$off+2]; $a = $bytes[$off+3]
    if ($a -lt 5) {
      $outBytes[$off]=0; $outBytes[$off+1]=0; $outBytes[$off+2]=0; $outBytes[$off+3]=0
      continue
    }
    $lum = [int](0.299*$r + 0.587*$g + 0.114*$b)
    if ($lum -gt 255) { $lum = 255 }
    $c = $LUT[$lum]
    $outBytes[$off]   = [byte]$c[2]  # B
    $outBytes[$off+1] = [byte]$c[1]  # G
    $outBytes[$off+2] = [byte]$c[0]  # R
    $outBytes[$off+3] = $a
  }
}

$out = New-Object System.Drawing.Bitmap($w, $h, $fmt)
$outData = $out.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, $fmt)
[System.Runtime.InteropServices.Marshal]::Copy($outBytes, 0, $outData.Scan0, $outBytes.Length)
$out.UnlockBits($outData)
$out.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
$out.Dispose(); $src.Dispose()
Write-Output "wrote $OutPath"
