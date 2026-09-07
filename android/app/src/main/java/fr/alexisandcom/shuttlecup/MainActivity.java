package fr.alexisandcom.shuttlecup;

import android.content.Context;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebView;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.CapacitorWebView;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Garde l'écran allumé pendant l'usage arbitre — pas de mise en veille
        // au milieu d'un match. Aucune permission requise (FLAG, pas WAKE_LOCK).
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        // Zoom texte système (ex. 110% sur Samsung) : neutralisé — l'app a déjà
        // sa propre typographie massive (titres 42px, scores 56px) et le zoom
        // système agrandissait tout de façon incohérente avec le design system.
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().getSettings().setTextZoom(100);
        }
        // Edge-to-edge (targetSdk 35) : le listener Capacitor est posé après le
        // premier dispatch des insets (Bridge.java:1623) et peut ne jamais se
        // déclencher → on applique les marges système nous-mêmes, AVANT le
        // premier layout, pour que le WebView ne passe jamais sous les barres.
        applySystemBarInsets();

        // Pont JS → impression native : window.print() ne fait rien dans un
        // WebView Android. Le PrintManager système imprime le contenu du WebView
        // (ou l'enregistre en PDF), piloté depuis JS via window.AndroidBridge.
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(new NativeBridge(this), "AndroidBridge");
        }
    }

    /**
     * Applique les insets système (barre de statut, navigation, encoche) en
     * marges du WebView. Listener posé dans onCreate → garanti appelé au
     * premier layout, contrairement au handler Capacitor posé trop tard.
     */
    private void applySystemBarInsets() {
        ViewCompat.setOnApplyWindowInsetsListener(getWindow().getDecorView(), (v, windowInsets) -> {
            androidx.core.graphics.Insets insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars()
                    | WindowInsetsCompat.Type.displayCutout()
            );
            // getBridge() est prêt après super.onCreate() — le WebView est la vue racine
            if (getBridge() != null && getBridge().getWebView() instanceof CapacitorWebView webView) {
                ViewGroup.MarginLayoutParams mlp =
                    (ViewGroup.MarginLayoutParams) webView.getLayoutParams();
                mlp.topMargin = insets.top;
                mlp.bottomMargin = insets.bottom;
                mlp.leftMargin = insets.left;
                mlp.rightMargin = insets.right;
                webView.setLayoutParams(mlp);
            }
            return WindowInsetsCompat.CONSUMED;
        });
    }

    /**
     * Impression native du contenu du WebView (dialogue système Android :
     * imprimer ou « Enregistrer en PDF »). Appelé depuis JS :
     * window.AndroidBridge.print() — @JavascriptInterface obligatoire.
     */
    private void printWebView() {
        runOnUiThread(() -> {
            try {
                WebView webView = getBridge().getWebView();
                PrintManager printManager = (PrintManager) getSystemService(Context.PRINT_SERVICE);
                String jobName = getString(getApplicationInfo().labelRes) + " — Document";
                PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(jobName);
                printManager.print(jobName, adapter, new PrintAttributes.Builder().build());
            } catch (Exception e) {
                // Impression indisponible (rare) : silencieux — l'export CSV reste disponible
            }
        });
    }

    /** Pont JS exposé au WebView sous window.AndroidBridge. */
    private class NativeBridge {
        private final MainActivity activity;

        NativeBridge(MainActivity activity) {
            this.activity = activity;
        }

        @android.webkit.JavascriptInterface
        public void print() {
            activity.printWebView();
        }
    }
}
