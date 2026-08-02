param(
  [Parameter(Mandatory = $true)]
  [string]$Path
)

$item = Get-Item -LiteralPath $Path -ErrorAction Stop
$version = [string]$item.VersionInfo.ProductVersion

if ([string]::IsNullOrWhiteSpace($version)) {
  throw "Executable ProductVersion is missing: $Path"
}

[Console]::Out.Write($version.Trim())
