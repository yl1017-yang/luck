# Optional reference refresh; the offline test never calls external services.
$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot 'fixtures/historical-terms'
[System.IO.Directory]::CreateDirectory($root) | Out-Null
$utf8 = [System.Text.UTF8Encoding]::new($false)
$years = @(1901) + @(1910..2020 | Where-Object { $_ % 10 -eq 0 }) + @(2025)
$sources = @()
foreach ($year in (@(1900) + $years)) {
    $url = "https://aa.usno.navy.mil/api/seasons?year=$year&tz=0&dst=false"
    $response = Invoke-WebRequest -UseBasicParsing $url
    $file = "usno-$year.json"
    [System.IO.File]::WriteAllText((Join-Path $root $file), $response.Content, $utf8)
    $sources += [ordered]@{ file = $file; url = $url; sha256 = (Get-FileHash (Join-Path $root $file) -Algorithm SHA256).Hash.ToLower() }
    if ($year -ne 1900) {
        $url = "https://www.hko.gov.hk/en/gts/time/calendar/text/files/T${year}e.txt"
        $file = "hko-$year.txt"
        Invoke-WebRequest -UseBasicParsing $url -OutFile (Join-Path $root $file)
        $sources += [ordered]@{ file = $file; url = $url; sha256 = (Get-FileHash (Join-Path $root $file) -Algorithm SHA256).Hash.ToLower() }
    }
    Write-Output "Fetched $year"
}
$manifest = [ordered]@{ retrieved = [DateTime]::UtcNow.ToString('yyyy-MM-dd'); hkoYears = $years; usnoYears = (@(1900) + $years); sources = $sources }
[System.IO.File]::WriteAllText((Join-Path $root 'manifest.json'), ($manifest | ConvertTo-Json -Depth 5) + "`n", $utf8)
