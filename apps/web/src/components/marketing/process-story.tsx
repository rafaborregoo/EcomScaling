"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import "./process-story.css";
import { ProcessMachine } from "./process-machine";

const phases = [
  { nav: "Conectar", title: "Shopify, Meta y Klaviyo en una infraestructura", text: "Conecta Shopify, Meta y Klaviyo en unos minutos. E-NORA reúne lo que pasa en cada uno para que dejes de saltar entre pestañas y de copiar cifras en una hoja de cálculo.", note: "Tú decides qué conectas. Cuanto más histórico tenga cada cuenta, más completa será la lectura.", caption: "Tu tienda, tus anuncios y tu buzón de emails llegan al mismo sitio." },
  { nav: "Tus números", title: "Control de todos tus números", text: "", note: "", caption: "Ventas, costes y fechas, ordenados para comparar." },
  { nav: "Tu tienda", title: "Gestión y predicción de stock", text: "", note: "", caption: "Tu escaparate, tus clientes y tu almacén, de un vistazo." },
  { nav: "Anuncios", title: "Menos gasto, más compras", text: "", note: "", caption: "Cada euro en anuncios, junto a lo que ha traído." },
  { nav: "Emails", title: "Qué email vende y cuál se ignora", text: "", note: "", caption: "Cada correo de la secuencia, con su resultado." },
  { nav: "Avisos IA", title: "Qué pasó, por qué y qué hacer", text: "", note: "", caption: "Una lupa sobre tus cifras que levanta la mano si algo se tuerce." },
  { nav: "Copiloto", title: "Tu consultor, siempre a mano", text: "", note: "", caption: "Preguntas con tus palabras, respuestas con tus datos." },
  { nav: "Tu plan", title: "Tu camino, paso a paso", text: "", note: "", caption: "Cada paso te acerca a la meta." },
  { nav: "Campañas", title: "Desde cero, con plantilla o con IA", text: "", note: "", caption: "Del boceto a la campaña, sin cambiar de herramienta." },
  { nav: "Equipo", title: "Toda tu organización en E-NORA", text: "", note: "", caption: "Todos miran los mismos números y deciden juntos." },
];


export function ProcessStory() {
  const root = useRef<HTMLElement>(null);
  const [active,setActive] = useState(0);
  const selectedSource: number | null = null;
  const paused = false;
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
        {i===0?<h1 id={`fase-title-${i}`} aria-label={phase.title}><span className="enoraPhase_line"><b style={{color:"#3d3b3a"}}>Shopify</b>, <b style={{color:"#0866ff"}}>Meta</b> y <b style={{color:"#343231"}}>Klaviyo</b></span><span className="enoraPhase_line">en una</span><span className="enoraPhase_line">infraestructura</span></h1>:<h2 id={`fase-title-${i}`}>{i===9?<><span className="enoraPhase_line">Toda tu organización</span><span className="enoraPhase_line">en E-NORA</span></>:i===8?<><span className="enoraPhase_line">Desde cero, con plantilla</span><span className="enoraPhase_line">o con <b style={{color:"#3d3b3a",fontWeight:800}}>IA</b></span></>:i===7?<><span className="enoraPhase_line">Tu camino,</span><span className="enoraPhase_line"><b style={{color:"#3d3b3a"}}>paso</b> a <b style={{color:"#8b5a2b"}}>paso</b></span></>:i===6?<><span className="enoraPhase_line">Tu consultor,</span><span className="enoraPhase_line"><b style={{color:"#e3b38f"}}>siempre a mano</b></span></>:i===5?<><span className="enoraPhase_line">Qué pasó, <b style={{color:"#dc2626"}}>por qué</b></span><span className="enoraPhase_line">y qué hacer</span></>:i===4?<><span className="enoraPhase_line">Qué email <b style={{fontWeight:800}}>vende</b></span><span className="enoraPhase_line">y cuál se <b style={{color:"#dc2626"}}>ignora</b></span></>:i===3?<><span className="enoraPhase_line">Menos gasto,</span><span className="enoraPhase_line">más <b style={{color:"#0866ff"}}>compras</b></span></>:i===2?<><span className="enoraPhase_line">Gestión y predicción</span><span className="enoraPhase_line">de <b style={{color:"#c99a6b"}}>stock</b></span></>:i===1?<><span className="enoraPhase_line">Control de todos</span><span className="enoraPhase_line">tus <b style={{color:"#e8b94a"}}>números</b></span></>:phase.title}</h2>}
        {phase.text&&<p className="enoraPhase_text">{phase.text}</p>}
        {phase.note&&i>0&&<p className="enoraPhase_note">{phase.note}</p>}
        {i===last&&<div className="enoraPhase_actions"><Link className="enoraPhase_login" href="/registro">Inicia tu prueba gratuita</Link></div>}
      </div>
      {i<last&&<a className="enoraPhase_next" href={`#proceso-${i+1}`} aria-label={`Siguiente: ${phases[i+1]!.nav}`}><span>{phases[i+1]!.nav}</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v13m-5-5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg></a>}
    </section>)}
    </div>
  </section>;
}
