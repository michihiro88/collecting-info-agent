Write-Host 'Running environment variable tests...'
Write-Host 'Testing EnvManager class...'
npx jest --testPathPattern='config/env-manager'
$ENV_MANAGER_RESULT = $LASTEXITCODE

Write-Host "`nTesting model-env integration..."
npx jest --testPathPattern='models/model-env'
$MODEL_ENV_RESULT = $LASTEXITCODE

if (($ENV_MANAGER_RESULT -eq 0) -and ($MODEL_ENV_RESULT -eq 0)) {
  Write-Host "`nAll tests passed successfully!" -ForegroundColor Green
} else {
  Write-Host "`nSome tests failed. Check details above." -ForegroundColor Red
}
