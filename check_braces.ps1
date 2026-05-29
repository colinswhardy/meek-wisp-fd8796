# Balancing Checker for Colin's Charts Macros JS Files
$files = @(
  "app.js",
  "state.js",
  "services/ai.js",
  "controllers/dashboard.js",
  "controllers/food.js",
  "controllers/food_selector.js",
  "controllers/settings.js"
)

foreach ($file in $files) {
  $filePath = Join-Path "C:\Users\Colin's PC\.gemini\antigravity\scratch\colins-charts-macros" $file
  if (Test-Path $filePath) {
    $content = Get-Content $filePath -Raw
    $open = 0
    $close = 0
    foreach ($ch in $content.ToCharArray()) {
      if ($ch -eq '{') { $open++ }
      elseif ($ch -eq '}') { $close++ }
    }
    $bal = $open - $close
    Write-Host "$file - Open: $open, Close: $close, Balance: $bal"
  } else {
    Write-Host "$file - Not Found!"
  }
}
