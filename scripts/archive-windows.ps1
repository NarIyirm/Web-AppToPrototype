param([Parameter(Mandatory=$true)][string]$Source, [Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference = 'Stop'
$resolvedSource = (Resolve-Path -LiteralPath $Source).Path
$resolvedDestination = [IO.Path]::GetFullPath($Destination)
if (Test-Path -LiteralPath $resolvedDestination) { throw 'Archive already exists' }
Compress-Archive -LiteralPath $resolvedSource -DestinationPath $resolvedDestination -CompressionLevel Optimal
Write-Output $resolvedDestination
