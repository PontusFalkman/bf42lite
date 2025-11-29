# Root of the repo (current directory)
$RepoRoot = (Resolve-Path ".").Path

function Export-Dump {
    param(
        [string] $SubPath,   # e.g. "docs" or "apps/client-tauri/src"
        [string] $OutputFile # e.g. "bf42lite_docs_dump.txt"
    )

    $FullRoot = Join-Path $RepoRoot $SubPath

    if (-not (Test-Path $FullRoot)) {
        Write-Host "Skipping $SubPath (not found)..."
        return
    }

    # Only export real script/code/text formats
    $AllowedExtensions = @(
        ".ts", ".tsx",
        ".js",
        ".rs",
        ".toml",
        ".json",
        ".ps1",
        ".md"
    )

    # Skip lock / huge JSON-style files
    $ExcludedNames = @(
        "package-lock.json",
        "pnpm-lock.yaml",
        "yarn.lock",
        "Cargo.lock"
    )

    # Remove old dump if present
    if (Test-Path $OutputFile) {
        Remove-Item $OutputFile
    }

    # Get only the files we care about, and ignore build/vendor folders
    $files = Get-ChildItem -Path $FullRoot -Recurse -File |
        Where-Object {
            # Allowed extension
            ($AllowedExtensions -contains $_.Extension.ToLower()) -and
            # Exclude build/vendor directories
            ($_.FullName -notmatch "node_modules|dist|build|\.git") -and
            # Exclude lock files / special names
            ($ExcludedNames -notcontains $_.Name)
        }

    foreach ($file in $files) {
        "====================================" |
            Out-File $OutputFile -Append -Encoding UTF8
        "FILE: $($file.FullName.Replace($RepoRoot,''))" |
            Out-File $OutputFile -Append -Encoding UTF8
        "====================================" |
            Out-File $OutputFile -Append -Encoding UTF8
        "" |
            Out-File $OutputFile -Append -Encoding UTF8

        Get-Content $file.FullName -Raw |
            Out-File $OutputFile -Append -Encoding UTF8

        "" |
            Out-File $OutputFile -Append -Encoding UTF8
    }

    Write-Host "Exported $($files.Count) files from $SubPath -> $OutputFile"
}

function Export-TauriDump {
    # Slimmed Tauri dump: only key config/data files
    $OutputFile = "bf42lite_tauri_dump.txt"

    if (Test-Path $OutputFile) {
        Remove-Item $OutputFile
    }

    # Only the files we actually care about
    $tauriFiles = @(
        "apps/client-tauri/src-tauri/Cargo.toml",
        "apps/client-tauri/src-tauri/tauri.conf.json",
        "apps/client-tauri/src-tauri/game_config.toml",
        "apps/client-tauri/src-tauri/weapons.json",
        "apps/client-tauri/src-tauri/classes.json",
        "apps/client-tauri/src-tauri/capabilities/default.json",
        "apps/client-tauri/src-tauri/capabilities/migrated.json"
    )

    foreach ($relativePath in $tauriFiles) {
        $fullPath = Join-Path $RepoRoot $relativePath

        if (-not (Test-Path $fullPath)) {
            Write-Host "Skipping missing Tauri file: $relativePath"
            continue
        }

        "====================================" |
            Out-File $OutputFile -Append -Encoding UTF8
        "FILE: $relativePath" |
            Out-File $OutputFile -Append -Encoding UTF8
        "====================================" |
            Out-File $OutputFile -Append -Encoding UTF8
        "" |
            Out-File $OutputFile -Append -Encoding UTF8

        Get-Content $fullPath -Raw |
            Out-File $OutputFile -Append -Encoding UTF8

        "" |
            Out-File $OutputFile -Append -Encoding UTF8
    }

    Write-Host "Exported slim Tauri dump -> $OutputFile"
}

# ====== RUN EXPORTS ======

Export-Dump "docs"                        "bf42lite_docs_dump.txt"
Export-Dump "apps/client-tauri/src"       "bf42lite_client_dump.txt"
Export-TauriDump                          # slim Tauri dump
Export-Dump "packages/sim"                "bf42lite_sim_dump.txt"
Export-Dump "packages/protocol"           "bf42lite_protocol_dump.txt"
Export-Dump "packages/net"                "bf42lite_net_dump.txt"
