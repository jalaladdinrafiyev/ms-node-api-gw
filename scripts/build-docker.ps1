# Build Docker image for API Gateway
# Usage: .\scripts\build-docker.ps1 [-Tag "latest"] [-Push] [-Registry "your-registry"]

param(
    [string]$Tag = "latest",
    [switch]$Push,
    [string]$Registry = "",
    [switch]$NoCache
)

$ErrorActionPreference = "Stop"
$ImageName = "ms-node-api-gw"

# Build full image name
if ($Registry) {
    $FullImageName = "$Registry/$ImageName`:$Tag"
} else {
    $FullImageName = "$ImageName`:$Tag"
}

Write-Host "Building Docker image: $FullImageName" -ForegroundColor Cyan

# Build arguments
$BuildArgs = @("build", "-t", $FullImageName)

if ($NoCache) {
    $BuildArgs += "--no-cache"
}

$BuildArgs += "."

# Build the image
Write-Host "Running: docker $($BuildArgs -join ' ')" -ForegroundColor Gray
& docker @BuildArgs

if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Successfully built: $FullImageName" -ForegroundColor Green

# Push if requested
if ($Push) {
    Write-Host "Pushing image to registry..." -ForegroundColor Cyan
    & docker push $FullImageName
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Docker push failed!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Successfully pushed: $FullImageName" -ForegroundColor Green
}

# Show image info
Write-Host "`nImage details:" -ForegroundColor Cyan
& docker images $FullImageName --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"

Write-Host "`nTo run the container:" -ForegroundColor Yellow
Write-Host "  docker run -p 3000:3000 --env-file .env $FullImageName" -ForegroundColor White

Write-Host "`nTo save for distribution:" -ForegroundColor Yellow
Write-Host "  docker save $FullImageName | gzip > ms-node-api-gw-$Tag.tar.gz" -ForegroundColor White
