$workerUrl = "https://cm-tv-refresh.victor-salema-53d.workers.dev/"
$checkInterval = 1

$lastPath = $null
$lastChangeTime = Get-Date

Write-Host ""
Write-Host "======================================="
Write-Host " SUNSHINE PATH CHANGE MONITOR"
Write-Host "======================================="
Write-Host ""

function Extract-SunshinePath {
    param([string]$text)

    $decodedText = [System.Uri]::UnescapeDataString($text)

    $match = [regex]::Match(
        $decodedText,
        '/sunshine/[^"''\s<>]+?/hls/index\.m3u8'
    )

    if ($match.Success) {
        return $match.Value
    }

    return $null
}

while ($true) {
    try {
        $response = Invoke-WebRequest `
            -Uri $workerUrl `
            -UseBasicParsing `
            -TimeoutSec 10

        $content = $response.Content

        $currentPath = Extract-SunshinePath $content

        if ([string]::IsNullOrWhiteSpace($currentPath)) {
            Write-Host "[!] Partie /sunshine/.../hls/index.m3u8 introuvable"
        }
        else {
            if ($lastPath -eq $null) {
                $lastPath = $currentPath
                $lastChangeTime = Get-Date

                Write-Host ""
                Write-Host "[INIT]"
                Write-Host "SUNSHINE PATH :"
                Write-Host $currentPath
                Write-Host ""
            }
            elseif ($currentPath -ne $lastPath) {
                $now = Get-Date
                $elapsed = $now - $lastChangeTime

                Write-Host ""
                Write-Host ""
                Write-Host "======================================="
                Write-Host " SUNSHINE PATH CHANGED"
                Write-Host "======================================="
                Write-Host ""
                Write-Host "Ancienne partie :"
                Write-Host $lastPath
                Write-Host ""
                Write-Host "Nouvelle partie :"
                Write-Host $currentPath
                Write-Host ""
                Write-Host ("Temps avant changement : {0:N2} secondes" -f $elapsed.TotalSeconds)
                Write-Host ("Date du changement : " + $now)
                Write-Host ""

                $lastPath = $currentPath
                $lastChangeTime = $now
            }
            else {
                $elapsedNow = (Get-Date) - $lastChangeTime

                Write-Host -NoNewline "`r"
                Write-Host -NoNewline ("Monitoring... {0:N1}s | Sunshine path stable" -f $elapsedNow.TotalSeconds)
            }
        }
    }
    catch {
        Write-Host ""
        Write-Host "[ERREUR]"
        Write-Host $_.Exception.Message
    }

    Start-Sleep -Seconds $checkInterval
}