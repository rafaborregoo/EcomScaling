"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";

const WHOP_ACCOUNT_ID = "biz_HL6dBbRpFBs2LJ";

/**
 * Snippet oficial del pixel de Whop, literal. Inyecta su propio <script> con
 * `async=1`, encola las llamadas en `whop.q` y las manda cuando carga `s.js`;
 * por eso `afterInteractive` no le quita nada frente a ponerlo en el <head>.
 */
const SNIPPET = `!function(w,d,s,u,n,a,b){if(w[n])return;a=w[n]={q:[],t:+new Date,s:[],o:u,track:function(){a.q.push([+new Date].concat([].slice.call(arguments)))},setScope:function(){a.s=[].slice.call(arguments).filter(function(x){return typeof x==="string"});a.q.push([+new Date,"setScope"].concat(a.s))},scope:function(){var c=[].slice.call(arguments);return{track:function(){a.q.push([+new Date].concat([].slice.call(arguments)).concat([{__scope:c}]))}}}};b=d.createElement(s);b.async=1;b.src=u+"/s.js";d.getElementsByTagName(s)[0].parentNode.insertBefore(b,d.getElementsByTagName(s)[0])}(window,document,"script","https://t.whop.tw","whop");whop.setScope("${WHOP_ACCOUNT_ID}");whop.track("page");`;

declare global {
  interface Window {
    whop?: { track: (event: string, ...rest: unknown[]) => void };
  }
}

/**
 * El portal es una SPA: el router de Next cambia de pantalla sin recargar, asi
 * que el `track("page")` del snippet solo cuenta la primera. Esto cuenta las
 * demas.
 *
 * La primera se salta a proposito -- el snippet ya la ha mandado, y contarla
 * dos veces infla las visitas justo en la pantalla de entrada, que es la que
 * mas se mira.
 */
export function WhopPixel() {
  const pathname = usePathname();
  const primeraCarga = useRef(true);

  useEffect(() => {
    if (primeraCarga.current) {
      primeraCarga.current = false;
      return;
    }
    // Si el snippet aun no ha corrido (`afterInteractive`), `whop` no existe y
    // esa visita se pierde en vez de romper la navegacion. Una vez ha corrido
    // ya no hace falta esperar a `s.js`: el propio snippet encola.
    window.whop?.track("page");
  }, [pathname]);

  return (
    <Script id="whop-pixel" strategy="afterInteractive">
      {SNIPPET}
    </Script>
  );
}
