# 縺吶∋縺ｦ縺ｮ繝・せ繝医ｒ螳溯｡後☆繧九◆繧√・繝｡繧､繝ｳ繧ｹ繧ｯ繝ｪ繝励ヨ
param (
    [Parameter(Mandatory = $false)]
    [switch]$SaveResults,
    
    [Parameter(Mandatory = $false)]
    [switch]$GenerateReport,
    
    [Parameter(Mandatory = $false)]
    [switch]$SkipRagTest,
    
    [Parameter(Mandatory = $false)]
    [switch]$SkipModelTest,
    
    [Parameter(Mandatory = $false)]
    [switch]$OpenReport
)

# 繧ｹ繧ｯ繝ｪ繝励ヨ繝・ぅ繝ｬ繧ｯ繝医Μ縺ｮ蜿門ｾ・
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir

# 繝ｦ繝ｼ繝・ぅ繝ｪ繝・ぅ繝｢繧ｸ繝･繝ｼ繝ｫ縺ｮ繧､繝ｳ繝昴・繝・
Import-Module (Join-Path $ScriptDir "TestUtility.psm1") -Force

# 繧ｹ繧ｯ繝ｪ繝励ヨ髢句ｧ・
$startTime = Get-Date

# 繝倥ャ繝繝ｼ陦ｨ遉ｺ
Write-TestLog "========================================" -Color $COLORS.INFO
Write-TestLog "        繝・せ繝医せ繧､繝ｼ繝亥ｮ溯｡碁幕蟋・         " -Color $COLORS.INFO
Write-TestLog "========================================" -Color $COLORS.INFO
Write-TestLog ""

# 迺ｰ蠅・､画焚縺ｮ隱ｭ縺ｿ霎ｼ縺ｿ
$envLoaded = Import-EnvFile (Join-Path $RootDir ".env")
if (-not $envLoaded) {
    Write-TestLog ".env繝輔ぃ繧､繝ｫ縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ縲・env.sample繧偵さ繝斐・縺励※險ｭ螳壹＠縺ｦ縺上□縺輔＞縲・ -Level ERROR -Color $COLORS.ERROR
    exit 1
}

# 萓晏ｭ倬未菫ゅ・遒ｺ隱・
$dependenciesOk = Test-Dependencies -RequiredCommands @('node', 'npx', 'jest')
if (-not $dependenciesOk) {
    Write-TestLog "蠢・ｦ√↑萓晏ｭ倥ヱ繝・こ繝ｼ繧ｸ縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ縲ゅう繝ｳ繧ｹ繝医・繝ｫ繧堤｢ｺ隱阪＠縺ｦ縺上□縺輔＞縲・ -Level ERROR -Color $COLORS.ERROR
    exit 1
}

# TypeScript繧ｳ繝ｳ繝代う繝ｫ
$compileSuccess = Invoke-TypeScriptCompile
if (-not $compileSuccess) {
    Write-TestLog "TypeScript縺ｮ繧ｳ繝ｳ繝代う繝ｫ縺ｫ螟ｱ謨励＠縺ｾ縺励◆縲ゅお繝ｩ繝ｼ繧剃ｿｮ豁｣縺励※縺上□縺輔＞縲・ -Level ERROR -Color $COLORS.ERROR
    exit 1
}

# 繝・せ繝育ｵ先棡霑ｽ霍｡
$allTestsPass = $true
$totalTests = 0
$passedTests = 0
$failedTests = 0
$skippedTests = 0

# 蜊倅ｽ薙ユ繧ｹ繝亥ｮ溯｡・
Write-TestLog "蜊倅ｽ薙ユ繧ｹ繝医ｒ螳溯｡御ｸｭ..." -Color $COLORS.INFO
try {
    $testStartTime = Get-Date
    
    # 讓呎ｺ悶お繝ｩ繝ｼ蜃ｺ蜉帙ｒ讓呎ｺ門・蜉帙↓繝ｪ繝繧､繝ｬ繧ｯ繝・
    $tempFile = [System.IO.Path]::GetTempFileName()
    Start-Process -FilePath "npx" -ArgumentList "jest --testPathPattern=`"^(?!.*e2e).*$`"" -NoNewWindow -Wait -RedirectStandardOutput $tempFile
    $exitCode = $LASTEXITCODE
    $output = Get-Content -Path $tempFile -Raw
    Remove-Item -Path $tempFile -Force
    
    $testEndTime = Get-Date
    $duration = $testEndTime - $testStartTime
    $durationMs = [math]::Round($duration.TotalMilliseconds)
    
    if ($exitCode -eq 0) {
        Write-TestLog "蜊倅ｽ薙ユ繧ｹ繝医′謌仙粥縺励∪縺励◆・域園隕∵凾髢・ $($duration.TotalSeconds)遘抵ｼ・ -Color $COLORS.SUCCESS
        $passedTests++
    } else {
        Write-TestLog "蜊倅ｽ薙ユ繧ｹ繝医′螟ｱ謨励＠縺ｾ縺励◆・域園隕∵凾髢・ $($duration.TotalSeconds)遘抵ｼ・ -Level ERROR -Color $COLORS.ERROR
        $allTestsPass = $false
        $failedTests++
    }
    
    if ($SaveResults) {
        $testResult = [PSCustomObject]@{
            test_name = "蜊倅ｽ薙ユ繧ｹ繝・
            success = ($exitCode -eq 0)
            exit_code = $exitCode
            duration_ms = $durationMs
            stdout = $output
        }
        
        Save-TestResult -TestName "unit-tests" -Result $testResult
    }
    
    $totalTests++
} catch {
    Write-TestLog "蜊倅ｽ薙ユ繧ｹ繝亥ｮ溯｡御ｸｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆: $_" -Level ERROR -Color $COLORS.ERROR
    $allTestsPass = $false
    $failedTests++
    $totalTests++
    
    if ($SaveResults) {
        $testResult = [PSCustomObject]@{
            test_name = "蜊倅ｽ薙ユ繧ｹ繝・
            success = $false
            error = $_.ToString()
            duration_ms = 0
        }
        
        Save-TestResult -TestName "unit-tests" -Result $testResult
    }
}

Write-TestLog ""

# RAG繝・せ繝亥ｮ溯｡鯉ｼ医が繝励す繝ｧ繝ｳ・・
if (-not $SkipRagTest) {
    Write-TestLog "RAG讖溯・繝・せ繝医ｒ螳溯｡御ｸｭ..." -Color $COLORS.INFO
    
    try {
        $testStartTime = Get-Date
        $ragParams = @{
            SaveResults = $SaveResults
        }
        
        & (Join-Path $ScriptDir "Test-Rag.ps1") @ragParams
        $exitCode = $LASTEXITCODE
        $testEndTime = Get-Date
        $duration = $testEndTime - $testStartTime
        
        if ($exitCode -eq 0) {
            Write-TestLog "RAG讖溯・繝・せ繝医′謌仙粥縺励∪縺励◆・域園隕∵凾髢・ $($duration.TotalSeconds)遘抵ｼ・ -Color $COLORS.SUCCESS
            $passedTests++
        } else {
            Write-TestLog "RAG讖溯・繝・せ繝医′螟ｱ謨励＠縺ｾ縺励◆・域園隕∵凾髢・ $($duration.TotalSeconds)遘抵ｼ・ -Level ERROR -Color $COLORS.ERROR
            $allTestsPass = $false
            $failedTests++
        }
        
        $totalTests++
    } catch {
        Write-TestLog "RAG讖溯・繝・せ繝亥ｮ溯｡御ｸｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆: $_" -Level ERROR -Color $COLORS.ERROR
        $allTestsPass = $false
        $failedTests++
        $totalTests++
    }
    
    Write-TestLog ""
} else {
    Write-TestLog "RAG讖溯・繝・せ繝医・繧ｹ繧ｭ繝・・縺輔ｌ縺ｾ縺励◆" -Level WARNING -Color $COLORS.WARNING
    $skippedTests++
    Write-TestLog ""
}

# AI繝｢繝・Ν繝・せ繝亥ｮ溯｡鯉ｼ医が繝励す繝ｧ繝ｳ・・
if (-not $SkipModelTest) {
    Write-TestLog "AI繝｢繝・Ν繝・せ繝医ｒ螳溯｡御ｸｭ..." -Color $COLORS.INFO
    
    try {
        $testStartTime = Get-Date
        $modelParams = @{
            Provider = "all"
        }
        
        if ($SaveResults) {
            $modelParams.Add("SaveResults", $true)
        }
        
        & (Join-Path $ScriptDir "Test-Models.ps1") @modelParams
        $exitCode = $LASTEXITCODE
        $testEndTime = Get-Date
        $duration = $testEndTime - $testStartTime
        
        if ($exitCode -eq 0) {
            Write-TestLog "AI繝｢繝・Ν繝・せ繝医′謌仙粥縺励∪縺励◆・域園隕∵凾髢・ $($duration.TotalSeconds)遘抵ｼ・ -Color $COLORS.SUCCESS
            $passedTests++
        } else {
            Write-TestLog "AI繝｢繝・Ν繝・せ繝医′螟ｱ謨励＠縺ｾ縺励◆・域園隕∵凾髢・ $($duration.TotalSeconds)遘抵ｼ・ -Level ERROR -Color $COLORS.ERROR
            $allTestsPass = $false
            $failedTests++
        }
        
        $totalTests++
    } catch {
        Write-TestLog "AI繝｢繝・Ν繝・せ繝亥ｮ溯｡御ｸｭ縺ｫ繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆: $_" -Level ERROR -Color $COLORS.ERROR
        $allTestsPass = $false
        $failedTests++
        $totalTests++
    }
    
    Write-TestLog ""
} else {
    Write-TestLog "AI繝｢繝・Ν繝・せ繝医・繧ｹ繧ｭ繝・・縺輔ｌ縺ｾ縺励◆" -Level WARNING -Color $COLORS.WARNING
    $skippedTests++
    Write-TestLog ""
}

# 邨先棡繧ｵ繝槭Μ繝ｼ
$endTime = Get-Date
$totalDuration = $endTime - $startTime

Write-TestLog "========================================" -Color $COLORS.INFO
Write-TestLog "           繝・せ繝育ｵ先棡繧ｵ繝槭Μ繝ｼ           " -Color $COLORS.INFO
Write-TestLog "========================================" -Color $COLORS.INFO
Write-TestLog "邱丞ｮ溯｡梧凾髢・ $($totalDuration.TotalSeconds)遘・ -Color $COLORS.INFO
Write-TestLog "蜷郁ｨ医ユ繧ｹ繝域焚: $totalTests" -Color $COLORS.INFO
Write-TestLog "謌仙粥: $passedTests" -Color $COLORS.SUCCESS
Write-TestLog "螟ｱ謨・ $failedTests" -Color (if ($failedTests -gt 0) { $COLORS.ERROR } else { $COLORS.INFO })
Write-TestLog "繧ｹ繧ｭ繝・・: $skippedTests" -Color (if ($skippedTests -gt 0) { $COLORS.WARNING } else { $COLORS.INFO })
Write-TestLog "謌仙粥邇・ $(if ($totalTests -gt 0) { [math]::Round(($passedTests / ($totalTests - $skippedTests)) * 100, 2) } else { 0 })%" -Color $COLORS.INFO

# 繝ｬ繝昴・繝育函謌撰ｼ医が繝励す繝ｧ繝ｳ・・
if ($GenerateReport) {
    Write-TestLog ""
    Write-TestLog "繝・せ繝育ｵ先棡繝ｬ繝昴・繝医ｒ逕滓・縺励※縺・∪縺・.." -Color $COLORS.INFO
    
    $reportParams = @{}
    
    if ($OpenReport) {
        $reportParams.Add("OpenReport", $true)
    }
    
    & (Join-Path $ScriptDir "Generate-TestReport.ps1") @reportParams
}

# 邨ゆｺ・さ繝ｼ繝・
if ($allTestsPass) {
    Write-TestLog "縺吶∋縺ｦ縺ｮ繝・せ繝医′謌仙粥縺励∪縺励◆・・ -Color $COLORS.SUCCESS
    exit 0
} else {
    Write-TestLog "縺・￥縺､縺九・繝・せ繝医′螟ｱ謨励＠縺ｾ縺励◆縲りｩｳ邏ｰ縺ｯ荳願ｨ倥ｒ遒ｺ隱阪＠縺ｦ縺上□縺輔＞縲・ -Level ERROR -Color $COLORS.ERROR
    exit 1
} 
