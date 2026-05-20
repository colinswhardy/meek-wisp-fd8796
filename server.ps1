# --------------------------------------------------------------------------
# ColinsChartsMacros - Lightweight PowerShell Web Server
# --------------------------------------------------------------------------

$port = 8080
$listener = New-Object System.Net.HttpListener

# Bind to 127.0.0.1 (Localhost) which does NOT require Administrator privileges
$listener.Prefixes.Add("http://127.0.0.1:$port/")

try {
    $listener.Start()
    Write-Host "--------------------------------------------------------"
    Write-Host "  ColinsChartsMacros Web Server Successfully Started!"
    Write-Host "  Open this link on your PC: http://127.0.0.1:$port"
    Write-Host "--------------------------------------------------------"
} catch {
    Write-Host "Error starting web server: $_"
    Write-Host "Make sure port $port is not being used by another program."
    exit 1
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $urlPath = $request.Url.LocalPath
        if ($urlPath -eq "/") {
            $urlPath = "/index.html"
        }
        
        # Format the file path cleanly for Windows
        $cleanPath = $urlPath.Replace("/", "\").TrimStart("\")
        $filePath = Join-Path "C:\Users\Colin's PC\.gemini\antigravity\scratch\colins-charts-macros" $cleanPath
        
        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            
            # Map standard file extensions to mime-types for the browser
            if ($filePath.EndsWith(".html")) { $response.ContentType = "text/html; charset=utf-8" }
            elseif ($filePath.EndsWith(".css")) { $response.ContentType = "text/css; charset=utf-8" }
            elseif ($filePath.EndsWith(".js")) { $response.ContentType = "application/javascript; charset=utf-8" }
            elseif ($filePath.EndsWith(".json")) { $response.ContentType = "application/json; charset=utf-8" }
            elseif ($filePath.EndsWith(".svg")) { $response.ContentType = "image/svg+xml" }
            
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $errBytes = [System.Text.Encoding]::UTF8.GetBytes("404 File Not Found")
            $response.OutputStream.Write($errBytes, 0, $errBytes.Length)
        }
        $response.Close()
    } catch {
        # Catch individual request errors so the server keeps running in loop
        Write-Host "Request error: $_"
    }
}
