param(
    [string]$JavaHome = '',
    [string]$ProjectRoot = $PSScriptRoot,
    [switch]$DebugBuild
)
$ErrorActionPreference = 'Stop'
$project = $ProjectRoot
$workspace = Split-Path -Parent $project
# Android's Windows packaging tools need ASCII relative arguments in a Chinese path.
Push-Location -LiteralPath $project
$previousDirectory = [Environment]::CurrentDirectory
[Environment]::CurrentDirectory = (Get-Location).Path
try {
$project = '.'
$toolsRoot = '..\.android-tools'
if (-not $JavaHome) {
    $candidates = @($env:JAVA_HOME,'D:\Softwares\IntelliJ IDEA 2025.1.3\jbr','C:\Program Files\Java\latest\jdk-26')
    # Prefer JDK 21; the legacy JAVA_HOME on this machine points to Java 8.
    $JavaHome = $candidates | Where-Object { $_ -and (Test-Path (Join-Path $_ 'bin\javac.exe')) -and $_ -notmatch 'jdk1\.8' } | Select-Object -First 1
}
if (-not $JavaHome) { throw 'Provide -JavaHome with a JDK 17 or newer installation.' }
$java = Join-Path $JavaHome 'bin\java.exe'
$javac = Join-Path $JavaHome 'bin\javac.exe'
$jar = Join-Path $JavaHome 'bin\jar.exe'
if (-not (Test-Path $jar)) { $jar = (Get-Command jar.exe -ErrorAction Stop).Source }
$keytool = Join-Path $JavaHome 'bin\keytool.exe'
$androidJar = Join-Path $toolsRoot 'platform\android-36\android.jar'
$buildTools = Join-Path $toolsRoot 'build-tools\android-16'
if (-not (Test-Path $androidJar) -or -not (Test-Path (Join-Path $buildTools 'aapt2.exe'))) { throw 'Missing Android SDK components; see README.md.' }
function Run-Tool([string]$File, [string[]]$Arguments) {
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Tool failed ($LASTEXITCODE): $File" }
}
$flavor = if ($DebugBuild) { 'debug' } else { 'release' }
# A fresh directory for each build avoids stale generated resources and classes.
$build = Join-Path $project ('build\' + $flavor + '-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
$assets = Join-Path $build 'assets'
$generated = Join-Path $build 'generated'
$classes = Join-Path $build 'classes'
$dex = Join-Path $build 'dex'
$dist = Join-Path $project 'dist'
@($build,$assets,$generated,$classes,$dex,$dist) | ForEach-Object { New-Item -ItemType Directory -Force -Path $_ | Out-Null }
$utf8 = New-Object System.Text.UTF8Encoding($false)
$html = [IO.File]::ReadAllText((Join-Path $workspace '股票与期货仓位计算器.html'))
$hook = '  resetStocks();resetFutures();loadLink();'
if (-not $html.Contains($hook)) { throw 'HTML startup hook changed; update the Android adapter insertion.' }
$adapter = [IO.File]::ReadAllText((Join-Path $project 'android-adapter.js'))
$html = $html.Replace($hook, $adapter + [Environment]::NewLine + $hook)
$exportHook = "    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});"
if (-not $html.Contains($exportHook)) { throw 'HTML export hook changed; update the Android CSV adapter.' }
$nativeExport = '    AndroidApp.exportCsv(csv,''股票仓位计算表_''+currentDateTime().replace(/[-:]/g,'''').replace(''T'',''_'')+''.csv''); return;'
$html = $html.Replace($exportHook,$nativeExport + [Environment]::NewLine + $exportHook)
[IO.File]::WriteAllText((Join-Path $assets 'index.html'),$html,$utf8)
$manifest = [IO.File]::ReadAllText((Join-Path $project 'app\src\main\AndroidManifest.xml'))
if ($DebugBuild) { $manifest = $manifest.Replace('<application ', '<application android:debuggable="true" ') }
$manifestPath = Join-Path $build 'AndroidManifest.xml'
[IO.File]::WriteAllText($manifestPath,$manifest,$utf8)
$res = Join-Path $project 'app\src\main\res'
$compiled = Join-Path $build 'resources.zip'
$unsigned = Join-Path $build 'unsigned.apk'
Run-Tool (Join-Path $buildTools 'aapt2.exe') @('compile','--dir',$res,'-o',$compiled)
Run-Tool (Join-Path $buildTools 'aapt2.exe') @('link','-I',$androidJar,'--manifest',$manifestPath,'--java',$generated,'-A',$assets,'--min-sdk-version','26','--target-sdk-version','36','-o',$unsigned,$compiled)
$sourceFiles = @(Get-ChildItem -LiteralPath (Join-Path $project 'app\src\main\java'),$generated -Filter '*.java' -Recurse | ForEach-Object { Resolve-Path -LiteralPath $_.FullName -Relative })
Run-Tool $javac (@('-J-Dfile.encoding=UTF-8','-encoding','UTF-8','-source','8','-target','8','-Xlint:-options','-bootclasspath',($androidJar + ';' + (Join-Path $buildTools 'core-lambda-stubs.jar')),'-d',$classes) + $sourceFiles)
$classesJar = Join-Path $build 'classes.jar'
Run-Tool $jar @('cf',$classesJar,'-C',$classes,'.')
Run-Tool $java @('-cp',(Join-Path $buildTools 'lib\d8.jar'),'com.android.tools.r8.D8','--lib',$androidJar,'--min-api','26','--output',$dex,$classesJar)
Run-Tool $jar @('uf',$unsigned,'-C',$dex,'classes.dex')
$aligned = Join-Path $build 'aligned.apk'
Run-Tool (Join-Path $buildTools 'zipalign.exe') @('-f','-p','4',$unsigned,$aligned)
$signing = Join-Path $project 'signing'
New-Item -ItemType Directory -Force -Path $signing | Out-Null
$keystore = Join-Path $signing 'position-calculator.p12'
$passwordFile = Join-Path $signing 'keystore-password.txt'
if (-not (Test-Path $keystore)) {
    if (Test-Path $passwordFile) { throw 'Signing password exists without keystore. Restore the matching keystore before building.' }
    [IO.File]::WriteAllText($passwordFile,([Guid]::NewGuid().ToString('N')),$utf8)
    Run-Tool $keytool @('-genkeypair','-keystore',$keystore,'-storetype','PKCS12','-storepass:file',$passwordFile,'-alias','position-calculator','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=Position Calculator, OU=Personal Apps, O=Columbus, C=CN')
}
if (-not (Test-Path $passwordFile)) { throw 'Signing password missing. Restore signing/keystore-password.txt.' }
$apk = Join-Path $dist ("position-calculator-1.4.2-$flavor.apk")
$apksigner = Join-Path $buildTools 'lib\apksigner.jar'
Run-Tool $java @('-jar',$apksigner,'sign','--ks',$keystore,'--ks-key-alias','position-calculator','--ks-pass',"file:$passwordFile",'--v4-signing-enabled','false','--out',$apk,$aligned)
Run-Tool $java @('-jar',$apksigner,'verify','--verbose',$apk)
Run-Tool (Join-Path $buildTools 'zipalign.exe') @('-c','4',$apk)
if (-not $DebugBuild) {
    $friendlyApk = Join-Path $workspace '仓位计算器-v1.4.2.apk'
    Copy-Item -LiteralPath $apk -Destination $friendlyApk -Force
    $hash = (Get-FileHash -LiteralPath $friendlyApk -Algorithm SHA256).Hash
    [IO.File]::WriteAllText((Join-Path $dist 'SHA256.txt'),"$hash  position-calculator-1.4.2-release.apk`n",$utf8)
    Write-Output "Installable APK: $friendlyApk"
}
Write-Output "Build complete: $apk"
} finally {
    [Environment]::CurrentDirectory = $previousDirectory
    Pop-Location
}
