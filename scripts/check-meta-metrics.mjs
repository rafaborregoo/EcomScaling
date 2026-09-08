/**
 * Comprobacion de las funciones de metricas de Meta contra el esquema real.
 *
 * Monta un fixture completo (cuenta, campaña, conjunto, anuncios, insights con
 * TRES ventanas de atribucion, pixel, publicos, un cambio en el registro),
 * llama a las seis funciones, comprueba la aritmetica y HACE ROLLBACK.
 *
 * Nunca hace commit: no hay ninguna ruta en este fichero que lo llame. Las
 * fechas van a 2030 para no cruzarse con la seed aunque algo fallara.
 *
 *   npm run check:meta-metrics
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pg = require("pg");

const ORG = "0e9e1986-4d83-4ef6-98d4-72a4c9e4b91c";
const CONNECTION = "039f3583-407b-4c2e-860f-e31ba6d90345";
const FROM = "2030-01-01";
const TO = "2030-01-20";

const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

const checks = [];
const check = (name, fn) => checks.push([name, fn]);

await client.connect();
await client.query("begin");

try {
  const q = async (sql, params) => (await client.query(sql, params)).rows;

  // --- Fixture --------------------------------------------------------------

  const [account] = await q(
    `insert into public.meta_ad_accounts
       (organization_id, connection_id, external_ad_account_id, account_name,
        currency_code, timezone_name, canonical_purchase_action_type, is_selected, is_active)
     values ($1, $2, 'act_fixture', 'Cuenta fixture', 'EUR', 'Europe/Madrid', 'omni_purchase', true, true)
     returning id`,
    [ORG, CONNECTION],
  );

  const [campaign] = await q(
    `insert into public.meta_campaigns
       (organization_id, ad_account_id, external_campaign_id, name, objective)
     values ($1, $2, 'c_fix', 'Campaña fixture', 'OUTCOME_SALES')
     returning id`,
    [ORG, account.id],
  );

  const [adSet] = await q(
    `insert into public.meta_ad_sets
       (organization_id, campaign_id, external_ad_set_id, name, effective_status,
        optimization_goal, daily_budget, learning_stage_status, learning_conversions,
        learning_conversions_needed, targeting_data)
     values ($1, $2, 's_fix', 'Conjunto fixture', 'ACTIVE', 'OFFSITE_CONVERSIONS',
             30, 'LEARNING', 12, 50,
             '{"geo_locations":{"countries":["ES"]},"custom_audiences":[{"id":"aud_usado","name":"Compradores"}]}'::jsonb)
     returning id`,
    [ORG, campaign.id],
  );

  const [creative] = await q(
    `insert into public.meta_creatives
       (organization_id, ad_account_id, external_creative_id, name)
     values ($1, $2, 'cr_fix', 'Creatividad fixture') returning id`,
    [ORG, account.id],
  );

  const ads = {};
  for (const [key, name] of [
    ["video", "Anuncio video"],
    ["imagen", "Anuncio imagen"],
    ["poco", "Anuncio sin volumen"],
  ]) {
    const [row] = await q(
      `insert into public.meta_ads
         (organization_id, ad_set_id, current_creative_id, external_ad_id, name, effective_status)
       values ($1, $2, $3, $4, $5, 'ACTIVE') returning id`,
      [ORG, adSet.id, creative.id, `ad_${key}`, name],
    );
    ads[key] = row.id;
  }

  // Veinte dias de insights. El anuncio de video lleva la curva completa; el de
  // imagen la deja en null (no es cero: no hay video); el tercero apenas tiene
  // impresiones, para probar el corte por volumen.
  const perfil = {
    video: { impressions: 500, spend: 20, plays: 250, p100: 50, thruplays: 120, quality: "ABOVE_AVERAGE" },
    imagen: { impressions: 250, spend: 10, plays: null, p100: null, thruplays: null, quality: "BELOW_AVERAGE_10" },
    poco: { impressions: 5, spend: 1, plays: 2, p100: 1, thruplays: 1, quality: null },
  };

  const insightIds = [];
  for (let day = 1; day <= 20; day += 1) {
    const fecha = `2030-01-${String(day).padStart(2, "0")}`;
    for (const [key, p] of Object.entries(perfil)) {
      const [row] = await q(
        `insert into public.meta_insight_rows_daily
           (organization_id, ad_account_id, campaign_id, ad_set_id, ad_id, level,
            external_entity_id, metric_date, breakdown_hash, attribution_hash,
            action_report_time, spend, impressions, reach, clicks, unique_clicks,
            inline_link_clicks, outbound_clicks, video_plays, video_p100_watched,
            video_thruplays, quality_ranking)
         values ($1,$2,$3,$4,$5,'ad',$6,$7,'none','default','default',
                 $8,$9,$9,10,10,8,25,$10,$11,$12,$13)
         returning id`,
        [ORG, account.id, campaign.id, adSet.id, ads[key], `ad_${key}`, fecha,
          p.spend, p.impressions, p.plays, p.p100, p.thruplays, p.quality],
      );
      insightIds.push([key, row.id]);
    }
  }

  // La trampa: Meta devuelve la MISMA compra en tres ventanas. Sumarlas triplica.
  for (const [key, id] of insightIds) {
    if (key !== "video") continue;
    for (const [ventana, compras, valor] of [
      ["1d_click", 1, 40],
      ["7d_click", 2, 100],
      ["1d_view", 3, 150],
    ]) {
      await q(
        `insert into public.meta_insight_action_metrics
           (organization_id, insight_row_id, metric_name, action_type, value, attribution_window, raw_value)
         values ($1,$2,'actions','omni_purchase',$3,$4,'{}'::jsonb),
                ($1,$2,'action_values','omni_purchase',$5,$4,'{}'::jsonb)`,
        [ORG, id, compras, ventana, valor],
      );
    }
  }

  // Pixel: PageView todos los dias, Purchase deja de dispararse los ultimos 5.
  const [pixel] = await q(
    `insert into public.meta_pixels
       (organization_id, ad_account_id, external_pixel_id, name, last_fired_at)
     values ($1,$2,'px_fix','Pixel fixture', now() - interval '3 hours') returning id`,
    [ORG, account.id],
  );
  for (let day = 1; day <= 20; day += 1) {
    const fecha = `2030-01-${String(day).padStart(2, "0")}`;
    await q(
      `insert into public.meta_pixel_daily_stats (organization_id, pixel_id, metric_date, event_name, event_count)
       values ($1,$2,$3,'PageView',1000)`,
      [ORG, pixel.id, fecha],
    );
    if (day <= 15) {
      await q(
        `insert into public.meta_pixel_daily_stats (organization_id, pixel_id, metric_date, event_name, event_count)
         values ($1,$2,$3,'Purchase',20)`,
        [ORG, pixel.id, fecha],
      );
    }
  }

  // Publicos: uno usado en el targeting del conjunto, otro olvidado.
  await q(
    `insert into public.meta_custom_audiences
       (organization_id, ad_account_id, external_audience_id, name, subtype,
        approximate_count_lower, approximate_count_upper, delivery_status)
     values ($1,$2,'aud_usado','Compradores','CUSTOM',9000,10000,'{"code":200,"description":"Listo"}'::jsonb),
            ($1,$2,'aud_olvidado','Visitantes 2024','CUSTOM',400,500,'{"code":300,"description":"Muy pequeño"}'::jsonb)`,
    [ORG, account.id],
  );

  // Un cambio a mitad de ventana: 10 dias antes y 10 despues dentro del fixture.
  await q(
    `insert into public.meta_account_activities
       (organization_id, ad_account_id, event_time, event_type, translated_event_type,
        actor_id, actor_name, object_type, object_external_id, object_name)
     values ($1,$2,'2030-01-10T12:00:00+01:00','update_ad_set_budget','Cambio de presupuesto',
             'u1','Rafa','ADSET','s_fix','Conjunto fixture')`,
    [ORG, account.id],
  );

  // --- Comprobaciones -------------------------------------------------------

  check("las tres ventanas de atribucion no se suman", async () => {
    const [row] = await q(
      `select purchases, purchase_value from public.meta_spend_summary($1,$2,$3,$4)`,
      [ORG, FROM, TO, account.store_id ?? null],
    );
    // 20 dias x 2 compras de la ventana 7d_click. Si se sumaran las tres
    // ventanas saldrian 120 compras y 5800 EUR.
    assert.equal(Number(row.purchases), 40, "deberia coger solo 7d_click");
    assert.equal(Number(row.purchase_value), 2000);
  });

  check("un anuncio de imagen no tiene hook rate del 0%", async () => {
    const rows = await q(
      `select ad_name, has_video, hook_rate, hold_rate, enough_volume, impressions
       from public.meta_creative_performance($1,$2,$3)`,
      [ORG, FROM, TO],
    );
    const byName = Object.fromEntries(rows.map((r) => [r.ad_name, r]));

    assert.equal(byName["Anuncio imagen"].has_video, false);
    assert.equal(byName["Anuncio imagen"].hook_rate, null, "sin video no hay hook rate");

    assert.equal(byName["Anuncio video"].has_video, true);
    // 250 plays / 500 impresiones cada dia -> 5000/10000
    assert.equal(Number(byName["Anuncio video"].hook_rate), 0.5);
    // 1000 completos / 5000 plays
    assert.equal(Number(byName["Anuncio video"].hold_rate), 0.2);
  });

  check("sin volumen no se publican tasas", async () => {
    const rows = await q(
      `select ad_name, enough_volume, hook_rate, video_plays
       from public.meta_creative_performance($1,$2,$3)`,
      [ORG, FROM, TO],
    );
    const poco = rows.find((r) => r.ad_name === "Anuncio sin volumen");
    assert.equal(poco.enough_volume, false, "100 impresiones no llegan al minimo");
    assert.equal(poco.hook_rate, null, "la tasa de 40 impresiones seria ruido ordenado primero");
    assert.equal(Number(poco.video_plays), 40, "el recuento crudo si se publica");
  });

  check("el reparto de gasto por veredicto suma uno", async () => {
    const rows = await q(
      `select dimension, ranking_value, spend, spend_share
       from public.meta_creative_ranking_distribution($1,$2,$3)`,
      [ORG, FROM, TO],
    );
    const calidad = rows.filter((r) => r.dimension === "calidad");
    const total = calidad.reduce((sum, r) => sum + Number(r.spend_share), 0);
    assert.ok(Math.abs(total - 1) < 0.001, `las cuotas suman ${total}`);

    const malo = calidad.find((r) => r.ranking_value === "BELOW_AVERAGE_10");
    // El anuncio de imagen: 10 EUR x 20 dias de 620 totales.
    assert.equal(Number(malo.spend), 200);

    const sinVeredicto = calidad.find((r) => r.ranking_value === "SIN_VEREDICTO");
    assert.ok(sinVeredicto, "el anuncio sin ranking no se cuenta como malo");
  });

  check("la fase de aprendizaje dice cuantas conversiones faltan", async () => {
    const [row] = await q(
      `select ad_set_name, learning_stage_status, conversions_missing,
              last_significant_change, spend_in_period
       from public.meta_learning_phase_status($1,$2,$3)`,
      [ORG, FROM, TO],
    );
    assert.equal(row.learning_stage_status, "LEARNING");
    assert.equal(row.conversions_missing, 38, "50 necesarias menos 12 hechas");
    assert.ok(row.last_significant_change, "trae el ultimo cambio al lado");
    assert.equal(Number(row.spend_in_period), 620);
  });

  check("un evento que deja de dispararse se cuenta como dias sin el", async () => {
    const rows = await q(
      `select event_name, events_total, days_with_events, days_in_period, days_missing, last_event_date
       from public.meta_pixel_health($1,$2,$3)`,
      [ORG, FROM, TO],
    );
    const compra = rows.find((r) => r.event_name === "Purchase");
    const vista = rows.find((r) => r.event_name === "PageView");

    assert.equal(compra.days_missing, 5, "Purchase falta los ultimos cinco dias");
    assert.equal(vista.days_missing, 0, "PageView sigue vivo, que es lo que engaña");
    assert.equal(Number(compra.events_total), 300);
  });

  check("un publico olvidado se distingue de uno en uso", async () => {
    const rows = await q(
      `select audience_name, ad_sets_using, delivery_status_code
       from public.meta_audience_overview($1)`,
      [ORG],
    );
    const usado = rows.find((r) => r.audience_name === "Compradores");
    const olvidado = rows.find((r) => r.audience_name === "Visitantes 2024");

    assert.equal(Number(usado.ad_sets_using), 1);
    assert.equal(Number(olvidado.ad_sets_using), 0);
    assert.equal(usado.delivery_status_code, 200);
  });

  check("el impacto de un cambio excluye el dia del cambio", async () => {
    const rows = await q(
      `select object_name, entity_level, spend_before, spend_after,
              days_before, days_after, purchases_before, purchases_after,
              purchase_attribution_window
       from public.meta_change_impact($1,$2,$3,null,7,50)`,
      [ORG, FROM, TO],
    );
    assert.equal(rows.length, 1, "un cambio, una fila");
    const row = rows[0];

    assert.equal(row.entity_level, "adset", "resuelve s_fix contra el conjunto");
    // Ventana de 7 dias a cada lado del 10 de enero, sin contar el 10.
    assert.equal(Number(row.days_before), 7);
    assert.equal(Number(row.days_after), 7);
    // 31 EUR por dia entre los tres anuncios.
    assert.equal(Number(row.spend_before), 217);
    assert.equal(Number(row.spend_after), 217);
    // 2 compras por dia (ventana 7d_click), nunca 6.
    assert.equal(Number(row.purchases_before), 14);
    assert.equal(row.purchase_attribution_window, "7d_click");
  });

  let fallos = 0;
  for (const [name, fn] of checks) {
    try {
      await fn();
      console.log(`  ok  ${name}`);
    } catch (error) {
      fallos += 1;
      console.log(`FALLO  ${name}`);
      console.log(`       ${error.message}`);
    }
  }
  console.log(fallos === 0 ? `\n${checks.length} comprobaciones, todas pasan.` : `\n${fallos} fallo(s).`);
  process.exitCode = fallos === 0 ? 0 : 1;
} finally {
  // Sin ruta de commit en todo el fichero.
  await client.query("rollback");
  await client.end();
  console.log("rollback hecho: la base queda como estaba.");
}
