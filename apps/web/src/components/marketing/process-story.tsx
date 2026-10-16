"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import "./process-story.css";
import { ProcessMachine } from "./process-machine";

const phases = [
  { nav: "Conectar", title: "Tu tienda, tus anuncios y tus emails, juntos.", text: "Conecta Shopify, Meta y Klaviyo en unos minutos. E-NORA reúne lo que pasa en cada uno para que dejes de saltar entre pestañas y de copiar cifras en una hoja de cálculo.", note: "Tú decides qué conectas. Cuanto más histórico tenga cada cuenta, más completa será la lectura.", caption: "Tu tienda, tus anuncios y tu buzón de emails llegan al mismo sitio." },
  { nav: "Tus números", title: "Los números, por fin claros.", text: "Ventas, costes y margen en el mismo sitio y con las mismas fechas. Comparas este mes con el anterior sin hacer cuentas a mano.", note: "Para ver lo que de verdad te queda, añade una vez tus costes de producto y envío.", caption: "Ventas, costes y fechas, ordenados para comparar." },
  { nav: "Tu tienda", title: "Qué se vende y qué te queda.", text: "Mira qué productos tiran, quién vuelve a comprar y cuánto ganas en cada pedido. Y te enteras antes de quedarte sin stock, no después.", note: "La conversión necesita que Shopify comparta las visitas de tu tienda.", caption: "Tu escaparate, tus clientes y tu almacén, de un vistazo." },
  { nav: "Anuncios", title: "Qué anuncio vende y cuál solo gasta.", text: "Cuánto inviertes, cuántas compras trae cada anuncio y qué imagen o vídeo funciona mejor, sin perderte en el administrador de anuncios.", note: "Las ventas que Meta se atribuye se muestran aparte: nunca se suman a las de tu tienda.", caption: "Cada euro en anuncios, junto a lo que ha traído." },
  { nav: "Emails", title: "Emails que se abren y venden.", text: "Descubre qué campañas y automatizaciones traen ventas, cuáles se ignoran y en qué correo se da de baja la gente.", note: "Algunos móviles marcan los correos como abiertos sin que nadie los lea; por eso miramos también los clics.", caption: "Cada correo de la secuencia, con su resultado." },
  { nav: "Avisos IA", title: "Te avisa de lo que importa.", text: "E-NORA vigila tus cifras y te señala lo que se sale de lo normal: qué ha pasado, por qué ha podido pasar y qué harías a continuación.", note: "Ninguna propuesta se aplica sola. Tú decides.", caption: "Una lupa sobre tus cifras que levanta la mano si algo se tuerce." },
  { nav: "Copiloto", title: "Pregunta como a un compañero.", text: "«¿Por qué han bajado las ventas esta semana?» Escríbelo tal cual. El copiloto responde con tus datos y te prepara un informe para compartir.", note: "Responde con la información de tu espacio. Si le falta un dato, te lo dice.", caption: "Preguntas con tus palabras, respuestas con tus datos." },
  { nav: "Tu plan", title: "Un plan, paso a paso.", text: "Convierte tus objetivos en etapas, hitos y tareas concretas. Sabes qué toca hoy y qué viene después.", note: "Tú y tu equipo revisáis el plan antes de ponerlo en marcha.", caption: "Cada paso te acerca a la meta." },
  { nav: "Campañas", title: "Tu próxima campaña, lista.", text: "Crea un email o un anuncio desde cero, con una plantilla o con ayuda de la IA. Revisa el diseño y a quién va antes de enviarlo.", note: "Los emails se preparan en Klaviyo; los anuncios de Meta quedan listos para que los revises.", caption: "Del boceto a la campaña, sin cambiar de herramienta." },
  { nav: "Equipo", title: "Tu equipo y tu consultor, en la misma mesa.", text: "Tareas, fechas y comentarios en un solo sitio. Lo que acordáis en cada llamada queda apuntado, y después medís juntos si ha funcionado.", note: "Disponible para las personas que invites a tu espacio.", caption: "Todos miran los mismos números y deciden juntos." },
];

const appData = [
  { name: "Shopify", color: "#008060", lead: "Pedidos, productos y clientes", metrics: ["Ventas", "Ticket medio", "Margen", "Stock"] },
  { name: "Meta Ads", color: "#0866ff", lead: "Campañas, anuncios e imágenes", metrics: ["Inversión", "Retorno (ROAS)", "Coste por compra", "Clics"] },
  { name: "Klaviyo", color: "#343231", lead: "Campañas, automatizaciones y listas", metrics: ["Ventas atribuidas", "Aperturas", "Clics", "Bajas"] },
];

const explorers: Record<number, Array<{ name: string; summary: string; metrics: string[] }>> = {
  2: [
    { name: "Ventas", summary: "Cuánto vendes, cuántos pedidos entran y cuánto gasta cada cliente de media.", metrics: ["Pedidos", "Ticket medio", "Descuentos"] },
    { name: "Margen", summary: "Lo que te queda después de pagar producto, envío y comisiones.", metrics: ["Costes", "Margen", "Beneficio"] },
    { name: "Clientes", summary: "Quién compra por primera vez y quién repite.", metrics: ["Nuevos", "Recurrentes", "Recompra"] },
    { name: "Stock", summary: "Qué se va a agotar pronto y qué lleva tiempo parado.", metrics: ["Unidades", "Rotación", "Días de stock"] },
  ],
  3: [
    { name: "Resultados", summary: "Cuánto inviertes, cuántas compras trae y cuánto te cuesta cada una.", metrics: ["Inversión", "Retorno", "Coste por compra"] },
    { name: "Creatividades", summary: "Qué imágenes y vídeos consiguen clics y compras.", metrics: ["Impresiones", "Clics", "Coste por clic"] },
    { name: "Medición", summary: "Si Meta está registrando bien las compras de tu tienda.", metrics: ["Eventos", "Ventana", "Cobertura"] },
  ],
  4: [
    { name: "Resultados", summary: "Ventas atribuidas, entregas, clics y bajas de cada envío.", metrics: ["Ventas", "Entregas", "Clics"] },
    { name: "Correos", summary: "Asunto, contenido y botón de cada email, con sugerencias de mejora.", metrics: ["Asunto", "Contenido", "Botón"] },
    { name: "Automatizaciones", summary: "Bienvenida, carrito abandonado y el resto de secuencias, paso a paso.", metrics: ["Pasos", "Esperas", "Audiencia"] },
  ],
};

function SourceDetails({ selected, onSelect }: { selected: number | null; onSelect: (index: number | null) => void }) {
  const app = appData[selected ?? 0]!;
  return <div className="enoraPhase_sourcePanel">
    <div className="enoraPhase_sourceTabs" role="group" aria-label="Qué trae cada aplicación">
      {appData.map((item,i)=><button key={item.name} type="button" aria-pressed={selected===i} style={{"--source-color":item.color} as React.CSSProperties} onClick={()=>onSelect(selected===i?null:i)}>{item.name}</button>)}
    </div>
    <div aria-live="polite"><p className="enoraPhase_sourceLead" style={{"--source-color":app.color} as React.CSSProperties}>{app.lead}</p>
    <ul className="enoraPhase_metrics" aria-label={`Qué ves de ${app.name}`}>{app.metrics.map(metric=><li key={metric}>{metric}</li>)}</ul></div>
  </div>;
}

function Explorer({ app, items, selected, onSelect }: { app: number; items: Array<{ name: string; summary: string; metrics: string[] }>; selected: number; onSelect: (index: number) => void }) {
  const current = items[selected]!;
  return <div className="enoraPhase_explorer" data-app={app}>
    <div className="enoraPhase_explorerTabs" role="group" aria-label="Explorar esta aplicación">
      {items.map((item,index)=><button key={item.name} type="button" aria-pressed={selected===index} onClick={()=>onSelect(index)}>{item.name}</button>)}
    </div>
    <div aria-live="polite"><p>{current.summary}</p>
    <ul aria-label={`Qué ves: ${current.name}`}>{current.metrics.map(metric=><li key={metric}>{metric}</li>)}</ul></div>
  </div>;
}

export function ProcessStory() {
  const root = useRef<HTMLElement>(null);
  const [active,setActive] = useState(0);
  const [selectedSource,setSelectedSource] = useState<number|null>(null);
  const [selectedExplorers,setSelectedExplorers] = useState<Record<number,number>>({});
  const [paused,setPaused] = useState(false);
  useEffect(()=>{
    let frame=0;
    const update=()=>{
      if(frame)return;
      frame=window.requestAnimationFrame(()=>{
        frame=0;
        const sections=[...(root.current?.querySelectorAll<HTMLElement>("[data-phase]")??[])];
        const center=window.innerHeight/2;
        let nearest:HTMLElement|undefined;
        let distance=Infinity;
        for(const section of sections){
          const bounds=section.getBoundingClientRect();
          const next=Math.abs(bounds.top+bounds.height/2-center);
          if(next<distance){nearest=section;distance=next;}
        }
        if(nearest)setActive(Number(nearest.dataset.phase));
      });
    };
    update();
    window.addEventListener("scroll",update,{passive:true});
    window.addEventListener("resize",update);
    return()=>{window.cancelAnimationFrame(frame);window.removeEventListener("scroll",update);window.removeEventListener("resize",update);};
  },[]);
  const last=phases.length-1;
  return <section ref={root} className="enoraProcess_story" aria-label="Cómo funciona E-NORA" data-active={active} data-motion-paused={paused}>
    <nav className="enoraPhase_index" aria-label="Capítulos">{phases.map((phase,i)=><a key={phase.nav} href={`#proceso-${i}`} aria-current={active===i?"step":undefined} aria-label={`Capítulo ${i+1}: ${phase.nav}`}><span>{String(i+1).padStart(2,"0")}</span><span className="enoraPhase_indexLabel">{phase.nav}</span></a>)}</nav>
    <div className="enoraProcess_visual">
      <div className="enoraPhase_art" aria-hidden="true"><ProcessMachine stage={active} selectedSource={selectedSource} motionPaused={paused}/></div>
      <p className="enoraProcess_caption"><span>{String(active+1).padStart(2,"0")} · {phases[active]!.nav}</span><em>{phases[active]!.caption}</em></p>
      <div className="enoraProcess_progress" aria-hidden="true"><i style={{width:`${((active+1)/phases.length)*100}%`}}/></div>
    </div>
    <div className="enoraProcess_steps">
    {phases.map((phase,i)=><section key={phase.nav} id={`proceso-${i}`} data-phase={i} data-phase-active={active===i} className="enoraPhase_scene" aria-labelledby={`fase-title-${i}`}>
      <div className="enoraPhase_copy">
        {i===0&&<p className="enoraPhase_kicker">Cómo funciona E-NORA</p>}
        {i===0?<h1 id={`fase-title-${i}`}>{phase.title}</h1>:<h2 id={`fase-title-${i}`}>{phase.title}</h2>}
        <p className="enoraPhase_text">{phase.text}</p>
        {i===0&&<SourceDetails selected={selectedSource} onSelect={setSelectedSource}/>}
        {explorers[i]&&<Explorer app={i} items={explorers[i]!} selected={selectedExplorers[i]??0} onSelect={index=>setSelectedExplorers(current=>({...current,[i]:index}))}/>}
        {i===8&&<div className="enoraPhase_facts"><span>Diseño libre</span><span>Plantillas</span><span>Con IA</span></div>}
        <p className="enoraPhase_note">{phase.note}</p>
        {i===0&&<button className="enoraPhase_motion" type="button" onClick={()=>setPaused(value=>!value)}>{paused?"Reanudar animación":"Pausar animación"}</button>}
        {i===last&&<div className="enoraPhase_actions"><Link className="enoraPhase_login" href="/login">Entrar en E-NORA</Link><a className="enoraPhase_secondary" href="#proceso-0">Volver a empezar</a></div>}
      </div>
      {i<last&&<a className="enoraPhase_next" href={`#proceso-${i+1}`} aria-label={`Siguiente: ${phases[i+1]!.nav}`}><span>{phases[i+1]!.nav}</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v13m-5-5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg></a>}
    </section>)}
    </div>
  </section>;
}
