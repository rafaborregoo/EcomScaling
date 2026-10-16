import { useEffect, useRef } from "react";
import { View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { c } from "../lib/theme";

// Lienzo del editor: el email tal como saldrá, y tocar un bloque lo selecciona.
// El HTML es el generado por el estudio (con data-block en cada fila). Una política de contenido bloquea cualquier
// script de la propia pieza (p. ej. un bloque de código HTML); el único JavaScript que corre es el que inyecta la app.

const CSP = `<meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'; form-action 'none'">`;
const STYLE = `<style>[data-block]{cursor:pointer}a{pointer-events:none}.nora-sel{outline:3px solid #1d4ed8;outline-offset:-3px;position:relative}html{-webkit-tap-highlight-color:transparent}</style>`;

const withCanvasHead = (html: string) => html.replace("</head>", `${CSP}${STYLE}</head>`);

const mark = (id: string | null, scroll: boolean) =>
  `(function(){document.querySelectorAll('.nora-sel').forEach(function(e){e.classList.remove('nora-sel')});${
    id ? `var el=document.querySelector('[data-block="${id.replace(/[^a-zA-Z0-9_-]/g, "")}"]');if(el){el.classList.add('nora-sel');${scroll ? "el.scrollIntoView({block:'center',behavior:'smooth'});" : ""}}` : ""
  }})();true;`;

const LISTENER = `(function(){if(window.__nora)return;window.__nora=1;
document.addEventListener('click',function(e){var el=e.target.closest('[data-block]');if(el){e.preventDefault();window.ReactNativeWebView.postMessage(JSON.stringify({t:'tap',id:el.getAttribute('data-block')}));}},true);
var t;window.addEventListener('scroll',function(){clearTimeout(t);t=setTimeout(function(){window.ReactNativeWebView.postMessage(JSON.stringify({t:'scroll',y:window.scrollY}));},150);});
})();`;

export function Canvas({ html, selectedId, onSelect }: { html: string; selectedId: string | null; onSelect: (id: string) => void }) {
  const web = useRef<WebView>(null);
  const scrollY = useRef(0);
  const selected = useRef(selectedId);
  selected.current = selectedId;

  // Al cambiar la selección (sin recargar la página) se resalta y se centra el bloque.
  useEffect(() => {
    web.current?.injectJavaScript(mark(selectedId, true));
  }, [selectedId]);

  function onMessage(e: WebViewMessageEvent) {
    try {
      const m = JSON.parse(e.nativeEvent.data) as { t: string; id?: string; y?: number };
      if (m.t === "tap" && m.id) onSelect(m.id);
      else if (m.t === "scroll" && typeof m.y === "number") scrollY.current = m.y;
    } catch {
      /* mensaje ajeno */
    }
  }

  return (
    <WebView
      ref={web}
      originWhitelist={["about:*"]}
      source={{ html: withCanvasHead(html) }}
      javaScriptEnabled
      // Cada vez que cambia el HTML la página se recarga: se vuelve al mismo punto y se mantiene la selección.
      injectedJavaScript={`${LISTENER}window.scrollTo(0,${Math.round(scrollY.current)});${mark(selected.current, false)}`}
      onMessage={onMessage}
      onShouldStartLoadWithRequest={(r) => r.url === "about:blank"}
      style={{ flex: 1, backgroundColor: "#fff" }}
    />
  );
}

/** Miniatura de un email: la página real a 600 px de ancho, encogida. No se toca ni se desplaza. */
export function MiniPreview({ html, width = 72, height = 96 }: { html: string; width?: number; height?: number }) {
  const W = 600;
  const scale = width / W;
  const H = height / scale;
  return (
    <View pointerEvents="none" style={{ width, height, borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: c.edge, backgroundColor: "#fff" }}>
      <View style={{ width: W, height: H, transform: [{ scale }], transformOrigin: "top left" }}>
        <WebView originWhitelist={["about:*"]} source={{ html: html.replace("</head>", `${CSP}<style>html,body{overflow:hidden}</style></head>`) }} javaScriptEnabled={false} scrollEnabled={false} style={{ width: W, height: H, backgroundColor: "#fff" }} />
      </View>
    </View>
  );
}
