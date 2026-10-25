# 仓位计算器 Android 版

当前版本：1.4.1 / versionCode 6。包名：com.columbus.positioncalculator。支持 Android 8.0 及以上。1.4.1 删除首页右上角状态文字，保留自动保存与行情功能。

## 安装

安装项目根目录的“仓位计算器-v1.4.1.apk”。沿用原签名，可直接覆盖旧版。卸载或清除应用数据会清除已保存内容；覆盖安装会保留应用数据。

## 自动记忆

输入内容修改后自动保存至设备本地，下次打开恢复上次的股票列表、代码和名称、账户资金、投入比例、买入价格、止损价格、期货代码和名称、开多/开空方向、风险比例、合约乘数、保证金率及当前市场。自动止损与手动止损状态也会恢复；不会在启动时自动取价覆盖已保存价格。重置只影响当前市场并立即保存。

每个品种的手动保证金率会保留，优先于资料基准比例。记忆依靠 Android SharedPreferences；网页 localStorage 中的品种偏好也会在应用快照中备份。账号资金、仓位和止损参数仅保存在本机，不发送给行情服务。

## 本次同步

同步最新主 HTML 的股票等止损风险分配、股票代码和简拼候选、ETF 支持、重复代码拦截、买入价刷新、止损归零，以及期货候选、开多/开空止损方向校验、开仓价刷新、止损清空、合约资料自动填入等功能。刷新价格不改动已有止损。按钮顺序和行情详情位置与当前 HTML 一致。

安卓提供受限的原生 HTTPS 数据请求，只访问腾讯股票报价、检索及东方财富期货报价和合约资料。远端响应作为文本解析，不执行行情服务脚本。WebView 禁止远程加载、混合内容和文件访问；正式版关闭调试。仅新增 INTERNET 普通权限，不需要存储权限。离线时仍可手动填价并计算，行情功能需要可用的网络与 DNS。

保证金参考值是合约资料的基准比例，并非当日交易所实际保证金或期货公司客户比例；页面保留口径说明和来源。手动比例按品种记忆。

分享打开系统分享面板；CSV 使用系统文件保存窗口。

## 文件与构建

- ../股票与期货仓位计算器.html：独立网页主文件。
- android-adapter.js：打包时注入的原生取价、自动保存恢复、分享适配。
- app/src/main/java/com/columbus/positioncalculator/MainActivity.java：安卓入口、原生数据请求、保存、分享和导出桥接。
- dist/position-calculator-1.4.1-release.apk：正式安装包。
- dist/SHA256.txt：正式包校验值。
- signing/：沿用的项目私有签名材料，不随 APK 分发。

本机使用 JDK 21、Platform 36 和 Build Tools 36.0.0，无 Gradle 依赖。PowerShell 7 可直接运行 build.ps1；Windows PowerShell 5 为避免中文脚本的编码问题，可在项目根目录执行：

~~~powershell
& ([scriptblock]::Create((Get-Content -LiteralPath '.\android-app\build.ps1' -Raw -Encoding UTF8))) -ProjectRoot (Join-Path (Get-Location) 'android-app')
~~~

## 验证记录

- test-memory-adapter.cjs：最新打包资源，原生桥接模拟测试，覆盖检索与报价解析、合约参数、输入和删股保存、方向和手动止损恢复、品种偏好恢复、独立重置、分享与 CSV、手机宽度布局。
- test-native-smoke.cjs：MuMu Android 15 上正式 APK 安装、版本检查、进程重启及关闭调试状态检查。
- test-native-memory.cjs：实际修改账户资金为 234567，强制停止后重启；memory-edited.png 和 memory-restarted.png 经目视确认内容一致。最终包覆盖安装后仍保留该值。
- test-native-quotes.cjs：模拟器实际检索，确认能调用原生数据请求；本机模拟器 DNS 无法解析行情域名，故未完成安卓环境中的真实成功报价验证。网络错误已正确显示；原生数据格式和页面行为使用模拟响应验证。
- tests/test-quotes.cjs：独立 HTML 功能回归测试。
- test-web-adapter.cjs 和 test-android.cjs 为旧版历史验证脚本，不适用于 1.4.0 的空白默认参数与最新交互。

本次没有操作 Android 系统分享选择或文件保存确认对话框；其内容与桥接调用在浏览器测试中验证。
