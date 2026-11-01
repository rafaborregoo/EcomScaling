"use client";

import { buttonVariants } from "@/components/ui/button";
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

  // Se parte del beneficio real por pedido y se le suma solo lo que se mueve:
  // recomponerlo desde las partes redondeadas daba +10 € sin tocar nada.
  const real = p.profit;
  const perOrder = real + (aov - p.aov_ex_tax) - (ads - p.ads);
  const margin = aov > 0 ? (perOrder / aov) * 100 : 0;
  const monthly = perOrder * row.orders;
  const changed = Math.abs(ads - p.ads) > 0.01 || Math.abs(aov - p.aov_ex_tax) > 0.01;
  const gain = changed ? (perOrder - real) * row.orders : 0;

  return (
    <Section
      id="simulador"
      title="Simulador de palancas"
      lead="Prueba un escenario antes de proponérselo al cliente. El resto de costes por pedido se mantiene."
    >
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
              className={buttonVariants()}
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
              className={buttonVariants({ variant: "secondary" })}
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

    </Section>
  );
}
