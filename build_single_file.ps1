# Inline local scripts/styles into a single bundle.html for offline use
# Run this from the project directory containing index.html

$index = Get-Content -Raw -Path "index.html"
$out = $index

# Inline local JS files if present
$jsFiles = @('blockly.min.js','pako.min.js','kjua.min.js','blocks_custom.js','app.js')
# CDN sources to download if missing
$cdn = @{
    'blockly.min.js' = 'https://unpkg.com/blockly/blockly.min.js'
    'pako.min.js'   = 'https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js'
    'kjua.min.js'   = 'https://cdn.jsdelivr.net/npm/kjua@0.1.1/kjua.min.js'
}

function Ensure-File($name){
    if (-not (Test-Path $name)) {
        if ($cdn.ContainsKey($name)) {
            Write-Host "Downloading $name from CDN..."
            try {
                Invoke-WebRequest -Uri $cdn[$name] -OutFile $name -UseBasicParsing -ErrorAction Stop
                Write-Host "Downloaded $name"
            } catch {
                Write-Host "Failed to download $name: $_"
            }
        } else {
            Write-Host "$name not found and no CDN mapping available."
        }
    }
}

# Ensure required libs are available
Ensure-File 'blockly.min.js'
Ensure-File 'pako.min.js'
Ensure-File 'kjua.min.js'
foreach ($f in $jsFiles) {
    if (Test-Path $f) {
        Write-Host "Inlining $f"
        $content = Get-Content -Raw -Path $f
        $scriptTag = "<script src=\"$f\"></script>"
        $inline = "<script>`n/* inlined $f */`n" + $content + "`n</script>"
        $out = $out -replace [regex]::Escape($scriptTag), [System.Text.RegularExpressions.Regex]::Escape($inline)
    }
}

# Replace INLINE_LIBS block if present with actual inlined library content (local files)
$inlineLibsStart = '<!-- INLINE_LIBS_START -->'
$inlineLibsEnd = '<!-- INLINE_LIBS_END -->'
if ($out -like "*$inlineLibsStart*" -and $out -like "*$inlineLibsEnd*") {
    Write-Host "Replacing INLINE_LIBS block with inlined libraries"
    $libs = ''
    foreach ($lib in @('blockly.min.js','pako.min.js','kjua.min.js')) {
        if (Test-Path $lib) {
            $libs += "<script>`n/* inlined $lib */`n" + (Get-Content -Raw -Path $lib) + "`n</script>`n"
        } else {
            # leave CDN fallback if local missing
            if ($lib -eq 'blockly.min.js') { $libs += '<script src="https://unpkg.com/blockly/blockly.min.js"></script>`n' }
            if ($lib -eq 'pako.min.js') { $libs += '<script src="https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js"></script>`n' }
            if ($lib -eq 'kjua.min.js') { $libs += '<script src="https://cdn.jsdelivr.net/npm/kjua@0.1.1/kjua.min.js"></script>`n' }
        }
    }
    $pattern = [regex]::Escape($inlineLibsStart) + '.*?' + [regex]::Escape($inlineLibsEnd)
    $out = [regex]::Replace($out, $pattern, $libs, [System.Text.RegularExpressions.RegexOptions]::Singleline)
}

# Inline local CSS
$cssFiles = @('styles.css')
foreach ($f in $cssFiles) {
    if (Test-Path $f) {
        Write-Host "Inlining $f"
        $content = Get-Content -Raw -Path $f
        $linkTag = "<link rel=\"stylesheet\" href=\"$f\">"
        $inline = "<style>`n/* inlined $f */`n" + $content + "`n</style>"
        $out = $out -replace [regex]::Escape($linkTag), [System.Text.RegularExpressions.Regex]::Escape($inline)
    }
}

# Write bundle
Set-Content -Path "bundle.html" -Value $out -Encoding UTF8
Write-Host "Wrote bundle.html"
