# ============================================
# Build and Export Docker Image
# ============================================
# Usage: .\build-docker.ps1
# ============================================

$ErrorActionPreference = "Stop"

$VERSION = "1.0.0"
$IMAGE_NAME = "api-gateway"
$FULL_TAG = "${IMAGE_NAME}:${VERSION}"
$OUTPUT_FILE = "${IMAGE_NAME}-${VERSION}.tar.gz"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Building API Gateway Docker Image" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build the image
Write-Host "[1/3] Building Docker image..." -ForegroundColor Yellow
docker build -t $FULL_TAG .

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Docker build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "SUCCESS: Image built: $FULL_TAG" -ForegroundColor Green
Write-Host ""

# Step 2: Show image size
Write-Host "[2/3] Image details:" -ForegroundColor Yellow
docker images $IMAGE_NAME --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
Write-Host ""

# Step 3: Export to file
Write-Host "[3/3] Exporting to file..." -ForegroundColor Yellow
docker save $FULL_TAG | gzip > $OUTPUT_FILE

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Export failed!" -ForegroundColor Red
    exit 1
}

$fileSize = (Get-Item $OUTPUT_FILE).Length / 1MB
Write-Host "SUCCESS: Exported to: $OUTPUT_FILE ($([math]::Round($fileSize, 2)) MB)" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "BUILD COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Files to send to sysadmin:" -ForegroundColor Yellow
Write-Host "  1. $OUTPUT_FILE (Docker image)" -ForegroundColor White
Write-Host "  2. gateway.yaml (configuration)" -ForegroundColor White
Write-Host "  3. docker-compose.prod.yml (deployment)" -ForegroundColor White
Write-Host ""
Write-Host "Sysadmin commands:" -ForegroundColor Yellow
Write-Host "  # Load image:" -ForegroundColor Gray
Write-Host "  gunzip -c $OUTPUT_FILE | docker load" -ForegroundColor White
Write-Host ""
Write-Host "  # Run:" -ForegroundColor Gray
Write-Host "  docker compose -f docker-compose.prod.yml up -d" -ForegroundColor White
Write-Host ""
