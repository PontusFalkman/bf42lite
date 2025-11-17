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

    Write-Host "Exporting $SubPath -> $OutputFile"

    if (Test-Path $OutputFile) {
        Remove-Item $OutputFile
    }

    # Header
    "===============================" | Out-File $OutputFile -Encoding UTF8
    " DUMP FOR: $SubPath"            | Out-File $OutputFile -Append -Encoding UTF8
    "===============================" | Out-File $OutputFile -Append -Encoding UTF8
    ""                                | Out-File $OutputFile -Append -Encoding UTF8

    # 1) Directory tree
    "---------- DIRECTORY TREE ----------" | Out-File $OutputFile -Append -Encoding UTF8
    ""                                      | Out-File $OutputFile -Append -Encoding UTF8

    # Use `tree` for a quick view
    tree $FullRoot /F | Out-File $OutputFile -Append -Encoding UTF8

    ""                                      | Out-File $OutputFile -Append -Encoding UTF8
    "---------- FILE CONTENTS ----------"   | Out-File $OutputFile -Append -Encoding UTF8
    ""                                      | Out-File $OutputFile -Append -Encoding UTF8

    # 2) File contents
    Get-ChildItem $FullRoot -Recurse -File |
        Where-Object {
            # Exclude typical build / tooling folders and existing dump files
            $_.FullName -notmatch '\\node_modules\\|\\dist\\|\\.git\\|\\target\\' -and
            $_.Name -notmatch 'dump\.txt$'
        } |
        ForEach-Object {
            $file = $_
            # Make path relative to repo root for readability
            $relativePath = $file.FullName.Substring($RepoRoot.Length + 1)

            "## FILE: $relativePath"       | Out-File $OutputFile -Append -Encoding UTF8
            "---------------------------"  | Out-File $OutputFile -Append -Encoding UTF8

            Get-Content $file.FullName -Raw | Out-File $OutputFile -Append -Encoding UTF8

            ""                              | Out-File $OutputFile -Append -Encoding UTF8
        }
}

# ====== RUN EXPORTS ======

Export-Dump "docs"                   "bf42lite_docs_dump.txt"
Export-Dump "apps/client-tauri/src"  "bf42lite_client_dump.txt"
Export-Dump "apps/client-tauri/src-tauri" "bf42lite_tauri_dump.txt"
Export-Dump "packages/sim"           "bf42lite_sim_dump.txt"
Export-Dump "packages/protocol"      "bf42lite_protocol_dump.txt"
Export-Dump "packages/net"           "bf42lite_net_dump.txt"
