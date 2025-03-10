# AIModel Test Script (PowerShell)
# This script runs tests for OpenAI, Anthropic, and Google AI models

# Color definitions
$GREEN = "Green"
$YELLOW = "Yellow"
$RED = "Red"
$BLUE = "Cyan"

Write-Host "========================================" -ForegroundColor $BLUE
Write-Host "      AI Model Test Runner Script      " -ForegroundColor $BLUE
Write-Host "========================================" -ForegroundColor $BLUE
Write-Host ""

# Environment variable check function
function Check-EnvVar {
    param (
        [string]$VarName
    )
    
    if ([string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable($VarName))) {
        Write-Host "Warning: $VarName environment variable is not set. Some tests may be skipped." -ForegroundColor $YELLOW
        return $false
    } else {
        Write-Host "√ $VarName environment variable is set" -ForegroundColor $GREEN
        return $true
    }
}

# Check required environment variables
Write-Host "Checking environment variables..."
$OPENAI_OK = Check-EnvVar "OPENAI_API_KEY"
$ANTHROPIC_OK = Check-EnvVar "ANTHROPIC_API_KEY"
$GOOGLE_OK = Check-EnvVar "GOOGLE_API_KEY"

Write-Host ""

# Run tests
Write-Host "Running tests..." -ForegroundColor $BLUE

# Option to run only specific tests
if ($args.Count -gt 0) {
    $TEST_PATTERN = $args[0]
    Write-Host "Will only run tests matching pattern: '$TEST_PATTERN'" -ForegroundColor $YELLOW
    Write-Host ""
    npx jest --testPathPattern="$TEST_PATTERN" --verbose
    exit $LASTEXITCODE
}

# Run all model tests
Write-Host "Running all model tests" -ForegroundColor $BLUE

# Variables to store results
$OPENAI_RESULT = 0
$ANTHROPIC_RESULT = 0
$GOOGLE_RESULT = 0

# OpenAI model tests
Write-Host "`nOpenAI Model Tests:" -ForegroundColor $BLUE
if ($OPENAI_OK) {
    npx jest --testPathPattern="openai-model.test" --verbose
    $OPENAI_RESULT = $LASTEXITCODE
} else {
    Write-Host "OpenAI API key is not set. Some tests may be skipped." -ForegroundColor $YELLOW
    npx jest --testPathPattern="openai-model.test" --verbose
    $OPENAI_RESULT = $LASTEXITCODE
}

# Anthropic model tests
Write-Host "`nAnthropic Model Tests:" -ForegroundColor $BLUE
if ($ANTHROPIC_OK) {
    npx jest --testPathPattern="anthropic-model.test" --verbose
    $ANTHROPIC_RESULT = $LASTEXITCODE
} else {
    Write-Host "Anthropic API key is not set. Some tests may be skipped." -ForegroundColor $YELLOW
    npx jest --testPathPattern="anthropic-model.test" --verbose
    $ANTHROPIC_RESULT = $LASTEXITCODE
}

# Google model tests
Write-Host "`nGoogle Model Tests:" -ForegroundColor $BLUE
if ($GOOGLE_OK) {
    npx jest --testPathPattern="google-model.test" --verbose
    $GOOGLE_RESULT = $LASTEXITCODE
} else {
    Write-Host "Google API key is not set. Some tests may be skipped." -ForegroundColor $YELLOW
    npx jest --testPathPattern="google-model.test" --verbose
    $GOOGLE_RESULT = $LASTEXITCODE
}

# Results summary
Write-Host "`n========================================" -ForegroundColor $BLUE
Write-Host "            Test Results Summary           " -ForegroundColor $BLUE
Write-Host "========================================" -ForegroundColor $BLUE

if ($OPENAI_RESULT -eq 0) {
    Write-Host "√ OpenAI Model Tests: Success" -ForegroundColor $GREEN
} else {
    Write-Host "× OpenAI Model Tests: Failed (Code: $OPENAI_RESULT)" -ForegroundColor $RED
}

if ($ANTHROPIC_RESULT -eq 0) {
    Write-Host "√ Anthropic Model Tests: Success" -ForegroundColor $GREEN
} else {
    Write-Host "× Anthropic Model Tests: Failed (Code: $ANTHROPIC_RESULT)" -ForegroundColor $RED
}

if ($GOOGLE_RESULT -eq 0) {
    Write-Host "√ Google Model Tests: Success" -ForegroundColor $GREEN
} else {
    Write-Host "× Google Model Tests: Failed (Code: $GOOGLE_RESULT)" -ForegroundColor $RED
}

# Overall result
if (($OPENAI_RESULT -eq 0) -and ($ANTHROPIC_RESULT -eq 0) -and ($GOOGLE_RESULT -eq 0)) {
    Write-Host "`nAll tests passed successfully!" -ForegroundColor $GREEN
    exit 0
} else {
    Write-Host "`nSome tests failed. See details in the output above." -ForegroundColor $RED
    exit 1
} 