$content = Get-Content 'C:\Users\Colin''s PC\.gemini\antigravity\scratch\colins-charts-macros\app.js' -Raw
$open = 0
$close = 0
foreach ($ch in $content.ToCharArray()) {
  if ($ch -eq '{') { $open++ }
  elseif ($ch -eq '}') { $close++ }
}
Write-Host "Open: $open, Close: $close, Balance: $($open - $close)"
