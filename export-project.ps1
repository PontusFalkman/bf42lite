# === Settings ===
$Root = "."                     # The project root
$Output = "bf42lite_dump.txt"  # Output file

# === Start clean ===
if (Test-Path $Output) {
    Remove-Item $Output
}

# === 1. Write folder structure ===
"===============================" | Out-File $Output -Encoding UTF8
" PROJECT DIRECTORY TREE"         | Out-File $Output -Append -Encoding UTF8
"===============================" | Out-File $Output -Append -Encoding UTF8
""                                | Out-File $Output -Append -Encoding UTF8

tree $Root /F | Out-File $Output -Append -Encoding UTF8

""                                | Out-File $Output -Append -Encoding UTF8
"===============================" | Out-File $Output -Append -Encoding UTF8
" FILE CONTENTS"                  | Out-File $Output -Append -Encoding UTF8
"===============================" | Out-File $Output -Append -Encoding UTF8
""                                | Out-File $Output -Append -Encoding UTF8

# === 2. Dump all files recursively ===
Get-ChildItem $Root -Recurse -File | ForEach-Object {

    $Path = $_.FullName

    # Add header
    "## FILE: $Path"        | Out-File $Output -Append -Encoding UTF8
    "---------------------" | Out-File $Output -Append -Encoding UTF8

    # Add file contents
    Get-Content $Path -Raw | Out-File $Output -Append -Encoding UTF8

    ""                     | Out-File $Output -Append -Encoding UTF8
}
