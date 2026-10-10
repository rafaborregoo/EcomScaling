"use client";

import { useState } from "react";
import { panelMoney, panelPct, type ProfitStoreRow } from "@e-nora/contracts";
import { Panel, Section, cx } from "./panel-parts";
import s from "./panel.module.css";

/**
 * Simulador de palancas de una tienda: mueve la publicidad por pedido y el
 * ticket medio y recalcula lo que queda, manteniendo el resto de costes por
 * pedido. Es aritmética sobre las cifras que ya trae la fila; no escribe nada
 * salvo la tarea que el consultor decida crear con el escenario.
 */
export function StoreSimulator({
  row,
  onCreateTask,
  creating,
}: {
  row: ProfitStoreRow;
  onCreateTask: (title: string, description: string) => void;
  creating: boolean;
}) {
  const p = row.per_order;
  const cur = row.currency_code;
  const money = (value: number, digits = 0) => panelMoney(value, cur, digits);
  const adsMax = Math.max(p.ads * 1.5, 1);
  const aovMax = Math.max(p.aov_ex_tax * 1.4, 1);
  const [ads, setAds] = useState(p.ads);
  const [aov, setAov] = useState(p.aov_ex_tax);

  const others = p.cogs + p.shipping + p.fees + p.fixed;
  const perOrder = aov - others - ads;
  const margin = aov > 0 ? (perOrder / aov) * 100 : 0;
  const monthly = perOrder * row.orders;
  const real = p.profit;
  const changed = Math.abs(ads - p.ads) > 0.01 || Math.abs(aov - p.aov_ex_tax) > 0.01;
  const gain = (perOrder - real) * row.orders;

  const steps: Array<{ label: string; value: number; cls?: string }> = [
    { label: "Ticket", value: aov, cls: s.total },
    { label: "− Producto", value: p.cogs },
    { label: "− Envío", value: p.shipping },
    { label: "− Comisiones", value: p.fees },
    { label: "− Publicidad", value: ads, cls: s.ads },
    { label: "− Gastos fijos", value: p.fixed },
    { label: "= Te queda", value: perOrder, cls: s.end },
  ];
  const scale = Math.max(aov, 1);

  return (
    <Section
      id="simulador"
      title="Simulador de palancas"
      lead="Prueba un escenario antes de proponérselo al cliente. El resto de costes por pedido se mantiene."
    >
      <div className={s.eq}>
        <Panel title="Mueve las palancas" sub={`${row.orders} pedidos en el periodo · cifras por pedido sin IVA`}>
          <div className={s.simCtl}>
            <label>
              <span>
                Publicidad por pedido <b>{money(ads, 1)}</b>
              </span>
              <input
                type="range"
                min={0}
                max={adsMax}
                step={0.5}
                value={ads}
                onChange={(event) => setAds(Number(event.target.value))}
              />
            </label>
            <label>
              <span>
                Ticket medio <b>{money(aov, 1)}</b>
              </span>
              <input
                type="range"
                min={0}
                max={aovMax}
                step={0.5}
                value={aov}
                onChange={(event) => setAov(Number(event.target.value))}
              />
            </label>
          </div>
          <div className={s.mini}>
            <div>
              <small>Deja por pedido</small>
              <b className={perOrder < 0 ? s.neg : undefined}>{money(perOrder, 2)}</b>
              <em>ahora {money(real, 2)}</em>
            </div>
            <div>
              <small>Margen</small>
              <b>{panelPct(margin)}</b>
              <em>{row.margin_target !== null ? `objetivo ${panelPct(row.margin_target)}` : "sin objetivo"}</em>
            </div>
            <div className={cx(changed && s.simHot)}>
              <small>Diferencia en el periodo</small>
              <b className={gain < 0 ? s.neg : gain > 0 ? s.pos : undefined}>
                {gain > 0 ? "+" : gain < 0 ? "−" : ""}
                {money(Math.abs(gain))}
              </b>
              <em>{money(monthly)} de beneficio</em>
            </div>
          </div>
          <div className={s.actions}>
            <button
              type="button"
              className={cx(s.btn, s.acc)}
              disabled={!changed || creating}
              onClick={() =>
                onCreateTask(
                  `${row.shop_name} · escenario: publicidad ${money(ads, 1)}/pedido y ticket ${money(aov, 1)}`,
                  `Escenario simulado en el panel: dejaría ${money(perOrder, 2)} por pedido (ahora ${money(real, 2)}) y un margen del ${panelPct(margin)}.`,
                )
              }
            >
              Crear tarea con este escenario
            </button>
            <button
              type="button"
              className={cx(s.btn, s.ghost)}
              disabled={!changed}
              onClick={() => {
                setAds(p.ads);
                setAov(p.aov_ex_tax);
              }}
            >
              Volver a los valores reales
            </button>
          </div>
        </Panel>

        <Panel title={`Un pedido de ${money(aov, 1)}`} sub="De lo que paga el cliente a lo que te queda">
          {steps.map((step) => (
            <div key={step.label} className={cx(s.wfR, s.wfSolo, step.cls)}>
              <span>{step.label}</span>
              <div className={s.t}>
                <i style={{ left: 0, width: `${Math.max(0, Math.min(100, (step.value / scale) * 100))}%` }} />
              </div>
              <span className={s.v}>{money(step.value, 2)}</span>
            </div>
          ))}
        </Panel>
      </div>
    </Section>
  );
}
