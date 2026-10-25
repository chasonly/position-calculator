package com.columbus.positioncalculator;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Insets;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.charset.Charset;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

/** Only packaged HTML executes; provider data is fetched as text by native HTTPS. */
public final class MainActivity extends Activity {
    private WebView webView;
    private SharedPreferences preferences;
    private static final int EXPORT_CSV = 1001;
    private byte[] pendingCsv;
    private volatile boolean destroyed;
    private final ThreadPoolExecutor network = new ThreadPoolExecutor(4,4,30,TimeUnit.SECONDS,new ArrayBlockingQueue<Runnable>(64));
    private static final String BASE_URL = "https://appassets.androidplatform.net/";

    @Override public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (savedInstanceState != null) pendingCsv = savedInstanceState.getByteArray("pendingCsv");
        preferences = getSharedPreferences("calculator", MODE_PRIVATE);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(243,245,248));
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(243,245,248));
        root.addView(webView, new FrameLayout.LayoutParams(-1,-1));
        setContentView(root);
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            getWindow().setStatusBarColor(Color.TRANSPARENT);
            getWindow().setNavigationBarColor(Color.TRANSPARENT);
            root.setOnApplyWindowInsetsListener((view,insets) -> {
                Insets safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(safe.left,safe.top,safe.right,safe.bottom);
                return insets;
            });
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) controller.setSystemBarsAppearance(
                WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
                WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
            root.requestApplyInsets();
        }
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setBlockNetworkLoads(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        // Debug inspection is limited to a separately built debuggable test APK.
        WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags & 2) != 0);
        webView.addJavascriptInterface(new AppBridge(), "AndroidApp");
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return true; }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) { return true; }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]));
            }
        });
        try (InputStream input = getAssets().open("index.html"); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer,0,count);
            String html = new String(output.toByteArray(), StandardCharsets.UTF_8);
            webView.loadDataWithBaseURL(BASE_URL,html,"text/html",null,BASE_URL);
        } catch (Exception error) {
            new AlertDialog.Builder(this).setTitle("无法打开计算器").setMessage("应用资源读取失败，请重新安装。").setPositiveButton("关闭",(dialog,which)->finish()).show();
        }
    }

    public final class AppBridge {
        @JavascriptInterface public void requestData(String requestId,String kind,String key) {
            if(requestId==null||!requestId.matches("[A-Za-z0-9-]{1,64}")||kind==null||key==null||key.length()>80)return;
            final String endpoint;
            final String encoding;
            if(kind.equals("stock")&&key.matches("(?:sh|sz|bj)[0-9]{6}")) {
                endpoint="https://qt.gtimg.cn/q="+key;encoding="GBK";
            } else if(kind.equals("search")&&key.matches("[A-Za-z0-9]{1,24}")) {
                endpoint="https://smartbox.gtimg.cn/s3/?q="+key+"&t=all";encoding="GBK";
            } else if(kind.equals("directory")&&key.matches("(?:113|114|115|142|220|225)_[0-9]{1,3}(?:_info)?")) {
                endpoint="https://futsse-static.eastmoney.com/redis?msgid="+key;encoding="UTF-8";
            } else if(kind.equals("future")&&key.matches("(?:113|114|115|142|220|225)_[A-Za-z]{1,3}[0-9]{3,4}")) {
                endpoint="https://futsseapi.eastmoney.com/static/"+key+"_qt?callbackName=receive&field=name,sc,dm,p,zsjd,utime&token=1101ffec61617c99be287c1bec3085ff";encoding="UTF-8";
            } else {replyData(requestId,null,"行情请求参数无效。");return;}
            try {network.execute(()->{
                HttpsURLConnection connection=null;
                try {
                    connection=(HttpsURLConnection)new URL(endpoint).openConnection();
                    connection.setConnectTimeout(5000);connection.setReadTimeout(5000);connection.setInstanceFollowRedirects(false);
                    connection.setRequestProperty("User-Agent","Mozilla/5.0 (Linux; Android) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36");
                    if(connection.getResponseCode()!=200)throw new java.io.IOException("HTTP "+connection.getResponseCode());
                    try(InputStream input=connection.getInputStream();ByteArrayOutputStream output=new ByteArrayOutputStream()) {
                        byte[] buffer=new byte[8192];int count,total=0;
                        while((count=input.read(buffer))!=-1){total+=count;if(total>2000000)throw new java.io.IOException("Response too large");output.write(buffer,0,count);}
                        replyData(requestId,new String(output.toByteArray(),Charset.forName(encoding)),null);
                    }
                } catch(Exception error){
                    android.util.Log.w("PositionQuote",kind+" "+key,error);
                    String message="网络不可用或行情请求失败，请稍后重试。";
                    if(error instanceof java.net.UnknownHostException)message="无法解析行情服务器地址，请检查网络连接。";
                    else if(error instanceof java.net.SocketTimeoutException)message="行情服务器连接超时，请稍后重试。";
                    else if(error instanceof javax.net.ssl.SSLException)message="安全连接失败，请检查设备日期与网络。";
                    else if(error instanceof java.net.ConnectException)message="无法连接行情服务器，请检查网络连接。";
                    else if(error instanceof SecurityException)message="联网权限不可用，请重新安装应用。";
                    else if(error.getMessage()!=null&&error.getMessage().startsWith("HTTP "))message="行情服务暂不可用（"+error.getMessage()+"），请稍后重试。";
                    replyData(requestId,null,message);
                }
                finally {if(connection!=null)connection.disconnect();}
            });} catch(java.util.concurrent.RejectedExecutionException error){replyData(requestId,null,"请求较多，请稍后重试。");}
        }
        @JavascriptInterface public String getInitialState() { return preferences.getString("state", ""); }
        @JavascriptInterface public void saveState(String state) {
            if (state == null || state.length() > 200000) return;
            try {
                JSONObject data = new JSONObject(state);
                int version = data.optInt("version");
                if (version >= 1 && version <= 5) preferences.edit().putString("state",state).apply();
            } catch (Exception ignored) { /* Keep the last valid state. */ }
        }
        @JavascriptInterface public void shareText(String text) {
            if (text == null || text.length() > 100000) return;
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Intent.ACTION_SEND);
                    intent.setType("text/plain");
                    intent.putExtra(Intent.EXTRA_SUBJECT,"仓位计算结果");
                    intent.putExtra(Intent.EXTRA_TEXT,text);
                    startActivity(Intent.createChooser(intent,"分享计算结果"));
                } catch (Exception error) { Toast.makeText(MainActivity.this,"未找到可用的分享应用",Toast.LENGTH_SHORT).show(); }
            });
        }
        @JavascriptInterface public void exportCsv(String csv, String filename) {
            if (csv == null || csv.length() > 200000) return;
            runOnUiThread(() -> {
                if (pendingCsv != null) return;
                pendingCsv = ("\uFEFF" + csv).getBytes(StandardCharsets.UTF_8);
                try {
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("text/csv");
                    intent.putExtra(Intent.EXTRA_TITLE,filename);
                    startActivityForResult(intent,EXPORT_CSV);
                } catch (Exception error) {
                    pendingCsv = null;
                    Toast.makeText(MainActivity.this,"无法打开文件保存窗口",Toast.LENGTH_SHORT).show();
                }
            });
        }
    }

    private void replyData(String requestId,String data,String error) {
        final String script="if(window.receiveAndroidData)window.receiveAndroidData("+JSONObject.quote(requestId)+","+(data==null?"null":JSONObject.quote(data))+","+(error==null?"null":JSONObject.quote(error))+");";
        runOnUiThread(()->{if(!destroyed&&webView!=null)webView.evaluateJavascript(script,null);});
    }

    @Override protected void onSaveInstanceState(Bundle state) {
        if (pendingCsv != null) state.putByteArray("pendingCsv",pendingCsv);
        super.onSaveInstanceState(state);
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode,resultCode,data);
        if (requestCode != EXPORT_CSV) return;
        byte[] contents = pendingCsv;
        pendingCsv = null;
        if (resultCode != RESULT_OK || data == null || data.getData() == null || contents == null) return;
        try (OutputStream output = getContentResolver().openOutputStream(data.getData(),"wt")) {
            if (output == null) throw new java.io.IOException("No output stream");
            output.write(contents);
            Toast.makeText(this,"CSV 文件已保存",Toast.LENGTH_SHORT).show();
        } catch (Exception error) {
            Toast.makeText(this,"保存失败，请重新导出",Toast.LENGTH_LONG).show();
        }
    }

    @Override protected void onPause() {
        if (webView != null) webView.evaluateJavascript("if(window.saveAndroidState) window.saveAndroidState();",null);
        super.onPause();
    }
    @Override protected void onDestroy() {
        destroyed=true;network.shutdownNow();
        if (webView != null) {
            ((FrameLayout)webView.getParent()).removeView(webView);
            webView.removeJavascriptInterface("AndroidApp");
            webView.destroy();
        }
        super.onDestroy();
    }
}
