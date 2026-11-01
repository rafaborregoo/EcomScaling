import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import test from "node:test";

// Optional embedded PostgreSQL runner: no project dependency and no remote DB access.
// A27_PGLITE_MODULE must point to an installed @electric-sql/pglite/dist/index.js.
test(
  "A27 migration and state transitions on isolated PostgreSQL",
  {
    skip: !process.env.A27_PGLITE_MODULE,
  },
  async (t) => {
    const { PGlite } = await import(
      pathToFileURL(process.env.A27_PGLITE_MODULE).href
    );
    const db = new PGlite();
    t.after(() => db.close());
    await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema private;
    create function private.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
    create function private.can_access_org(uuid) returns boolean language sql as $$ select false $$;
    create table organizations(id uuid primary key);
    create table profiles(id uuid primary key);
    create table shopify_stores(id uuid primary key);
    create table agent_definitions(id uuid primary key, code text);
    create table agent_versions(id uuid primary key, definition_id uuid);
    create table agent_runs(id uuid primary key, organization_id uuid, store_id uuid, agent_version_id uuid,
      status text, trigger_type text, started_at timestamptz default now());
    create table agent_outputs(id uuid primary key, organization_id uuid, run_id uuid, status text, output jsonb);
    create table agent_approvals(output_id uuid, organization_id uuid, decision text, decided_by uuid, reason text);
    create table agent_manual_refresh_reservations(run_id uuid primary key, organization_id uuid, agent_code text,
      request_key text, store_id uuid, reserved_at timestamptz default now());
    create table marketing_content_drafts(id uuid primary key, organization_id uuid, status text, request jsonb, scheduled_for timestamptz,
      agent_output_id uuid, decided_at timestamptz, decision_reason text, version integer not null default 1);
    create table integration_connections(id uuid primary key, organization_id uuid, status text);
    create table klaviyo_accounts(id uuid primary key, organization_id uuid, store_id uuid, connection_id uuid, is_active boolean, external_account_id text default 'account');
    create table klaviyo_campaigns(id uuid primary key, organization_id uuid, account_id uuid, external_campaign_id text,
      status text default 'Sent', send_time timestamptz default '2000-01-01');
    create table klaviyo_campaign_messages(id uuid primary key, organization_id uuid, campaign_id uuid, channel text,
      external_message_id text, sent_at timestamptz, updated_at timestamptz not null default now());
    create table klaviyo_flows(id uuid primary key, organization_id uuid, account_id uuid, external_flow_id text);
    create table klaviyo_report_runs(id uuid primary key, organization_id uuid, account_id uuid);
    create table klaviyo_report_values(organization_id uuid, report_run_id uuid, entity_type text, variation_id text,
      external_entity_id text, period_start timestamptz, period_end timestamptz, currency_code text, revenue numeric, raw_data jsonb);
    create table fixture_report(bucket_month date, entity_type text, entity_id uuid, entity_name text, subject text,
      send_time timestamptz, trigger_type text, revenue numeric, conversions numeric, recipients numeric, delivered numeric,
      opens_unique numeric, clicks_unique numeric, unsubscribes numeric, bounced numeric, spam_complaints numeric);
    create function klaviyo_email_report(uuid,date,date,uuid) returns setof public.fixture_report language sql stable set search_path = '' as $$ select * from public.fixture_report $$;
    create function finalize_a11_marketing_generation(uuid,uuid,uuid,text,jsonb,jsonb,jsonb) returns jsonb language sql as $$ select '{"saved":true}'::jsonb $$;
  `);
    const readMigration = (name) =>
      readFile(
        new URL(`../supabase/migrations/${name}`, import.meta.url),
        "utf8",
      );
    await db.exec(
      await readMigration("20261115590000_a27_weekly_mailing_resume.sql"),
    );
    await db.exec(
      await readMigration("20261209100000_mailing_campaign_graph.sql"),
    );
    await db.exec(
      await readMigration(
        "20261210100000_mailing_campaign_graph_hardening.sql",
      ),
    );
    const migration = await readMigration(
      "20270109191233_a27_mailing_execution_integrity.sql",
    );
    await db.exec(migration);
    await db.exec(migration); // Reapplying the migration must preserve the contract.

    const id = (number) =>
      `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
    const org = id(1),
      store = id(2),
      actor = id(3),
      output = id(4),
      run = id(5);
    const revision = id(6),
      tokenA = id(7),
      tokenB = id(8);
    await db.query("insert into organizations values ($1)", [org]);
    await db.query("insert into shopify_stores values ($1)", [store]);
    await db.query("insert into profiles values ($1)", [actor]);
    await db.query("insert into agent_runs(id) values ($1)", [run]);
    const plan = {
      decision: "ready",
      emails: [{ sequence_number: 1 }, { sequence_number: 2 }],
    };
    const schedule = ["2099-01-01T09:00:00Z", "2099-01-02T09:00:00Z"];
    const request = { scheduled_for: schedule, store_connection_id: id(9) };
    await db.query("insert into agent_outputs values($1,$2,$3,$4,$5)", [
      output,
      org,
      run,
      "pending_approval",
      plan,
    ]);
    const seed = async (sequenceId, extra = {}) => {
      await db.query(
        `insert into marketing_mailing_sequences(id, organization_id, store_id, status, request, plan,
      client_state, revision, agent_run_id, agent_output_id) values($1,$2,$3,'planned',$4,$5,'{}',$6,$7,$8)`,
        [
          sequenceId,
          org,
          store,
          request,
          plan,
          revision,
          extra.linkOutput ? run : null,
          extra.linkOutput ? output : null,
        ],
      );
    };
    const approve = (sequenceId, mode = "browser") =>
      db.query("select approve_mailing_sequence($1,$2,$3,$4,$5,$6) as result", [
        org,
        sequenceId,
        revision,
        actor,
        mode,
        mode === "graph"
          ? {
              sequence_id: sequenceId,
              organization_id: org,
              store_id: store,
              emails: [],
            }
          : null,
      ]);
    const mutate = async (sequenceId, token, operation, payload = {}) =>
      (
        await db.query("select mutate_mailing_graph($1,$2,$3,$4) as result", [
          sequenceId,
          token,
          operation,
          payload,
        ])
      ).rows[0].result;

    await t.test(
      "approval binds exact output and revision and is idempotent",
      async () => {
        const sequenceId = id(10);
        await seed(sequenceId, { linkOutput: true });
        await assert.rejects(
          db.query("select approve_mailing_sequence($1,$2,$3,$4,$5,null)", [
            org,
            sequenceId,
            id(999),
            actor,
            "browser",
          ]),
          /revision_conflict/,
        );
        await approve(sequenceId);
        await approve(sequenceId);
        assert.equal(
          (
            await db.query("select status from agent_outputs where id=$1", [
              output,
            ])
          ).rows[0].status,
          "approved",
        );
        assert.equal(
          (await db.query("select count(*)::int as n from agent_approvals"))
            .rows[0].n,
          1,
        );
      },
    );

    await t.test(
      "bootstrap survives before checkpoint, stale owner cannot write or release the new lease",
      async () => {
        const sequenceId = id(11);
        await seed(sequenceId);
        await approve(sequenceId, "graph");
        assert.equal(
          (
            await db.query(
              "select graph_bootstrap->>'sequence_id' as id from marketing_mailing_sequences where id=$1",
              [sequenceId],
            )
          ).rows[0].id,
          sequenceId,
        );
        assert.equal(await mutate(sequenceId, tokenA, "claim"), true);
        assert.equal(await mutate(sequenceId, tokenB, "claim"), false);
        await db.query(
          "update marketing_mailing_sequences set graph_lease_until = now() - interval '1 minute' where id=$1",
          [sequenceId],
        );
        assert.equal(await mutate(sequenceId, tokenB, "claim"), true);
        const checkpoint = {
          checkpoint_ns: "",
          checkpoint_id: "001",
          parent_checkpoint_id: null,
          checkpoint_type: "json",
          checkpoint: "e30=",
          metadata_type: "json",
          metadata: "e30=",
        };
        assert.equal(
          await mutate(sequenceId, tokenA, "checkpoint", checkpoint),
          false,
        );
        assert.equal(await mutate(sequenceId, tokenA, "release"), false);
        assert.equal(
          await mutate(sequenceId, tokenB, "checkpoint", checkpoint),
          true,
        );
        assert.equal(await mutate(sequenceId, tokenB, "renew"), true);
        const draft = {
          idempotency_key: `${sequenceId}:1`,
          request: {
            store_id: request.store_connection_id,
            mailing_sequence: {
              sequence_id: sequenceId,
              revision,
              email_number: 1,
              scheduled_for: schedule[0],
            },
          },
        };
        const finalize = (token) =>
          db.query(
            "select finalize_a27_mailing_generation($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as saved",
            [
              sequenceId,
              revision,
              token,
              run,
              org,
              actor,
              "email-v2",
              {},
              draft,
              {},
            ],
          );
        await assert.rejects(finalize(tokenA), /lease_lost_or_cancelled/);
        assert.deepEqual((await finalize(tokenB)).rows[0].saved, {
          saved: true,
        });
        await db.query(
          "update marketing_mailing_sequences set status='abandoned', cancelled_at=now() where id=$1",
          [sequenceId],
        );
        assert.equal(
          await mutate(sequenceId, tokenB, "checkpoint", {
            ...checkpoint,
            checkpoint_id: "002",
          }),
          false,
        );
        assert.equal(await mutate(sequenceId, tokenB, "assert"), false);
        await assert.rejects(finalize(tokenB), /lease_lost_or_cancelled/);
        assert.equal(
          (
            await db.query(
              "select count(*)::int as n from mailing_campaign_checkpoints where sequence_id=$1",
              [sequenceId],
            )
          ).rows[0].n,
          1,
        );
      },
    );

    await t.test(
      "partial production closes as partial; the final checkpoint can still be committed",
      async () => {
        const sequenceId = id(12);
        await seed(sequenceId);
        await approve(sequenceId, "graph");
        await mutate(sequenceId, tokenA, "claim");
        for (const number of [1, 2])
          assert.equal(
            await mutate(sequenceId, tokenA, "project", {
              sequence_number: number,
              title: "Email",
              scheduled_for: schedule[number - 1],
              status: number === 1 ? "scheduled" : "rejected",
              attempt: 0,
              draft_id: null,
              auto_review_passed: true,
              rejections: [],
              last_error: null,
              decided_by: actor,
              decided_role: "client",
            }),
            true,
          );
        assert.equal(await mutate(sequenceId, tokenA, "close"), true);
        assert.equal(
          (
            await db.query(
              "select status from marketing_mailing_sequences where id=$1",
              [sequenceId],
            )
          ).rows[0].status,
          "partial",
        );
        assert.equal(
          await mutate(sequenceId, tokenA, "checkpoint", {
            checkpoint_ns: "",
            checkpoint_id: "final",
            checkpoint_type: "json",
            checkpoint: "e30=",
            metadata_type: "json",
            metadata: "e30=",
          }),
          true,
        );
      },
    );

    await t.test(
      "draft scheduling requires exact approved revision and calendar",
      async () => {
        const sequenceId = id(13),
          draftId = id(14);
        await seed(sequenceId);
        await approve(sequenceId);
        await db.query(
          "insert into marketing_content_drafts(id,organization_id,status,request,scheduled_for) values($1,$2,$3,$4,null)",
          [
            draftId,
            org,
            "pending_approval",
            {
              store_id: request.store_connection_id,
              mailing_sequence: {
                sequence_id: sequenceId,
                email_number: 1,
                revision,
              },
            },
          ],
        );
        const scheduleDraft = async (date) =>
          (
            await db.query(
              "select set_mailing_draft_schedule($1,$2,$3,null) as result",
              [org, draftId, date],
            )
          ).rows[0].result;
        assert.equal(await scheduleDraft("2099-03-01T09:00:00Z"), false);
        assert.equal(await scheduleDraft(schedule[0]), true);
        await db.query(
          "update marketing_content_drafts set status='rejected' where id=$1",
          [draftId],
        );
        assert.equal(await scheduleDraft(schedule[0]), false);
      },
    );

    await t.test(
      "SQL observations preserve account, interval and currency; mixed or absent currency redacts revenue",
      async () => {
        const connection = id(30),
          account = id(31),
          campaign = id(32),
          report = id(33);
        await db.query("insert into integration_connections values($1,$2,$3)", [
          connection,
          org,
          "connected",
        ]);
        await db.query(
          "insert into klaviyo_accounts(id,organization_id,store_id,connection_id,is_active) values($1,$2,$3,$4,true)",
          [account, org, store, connection],
        );
        await db.query(
          "insert into klaviyo_campaigns(id,organization_id,account_id,external_campaign_id) values($1,$2,$3,$4)",
          [campaign, org, account, "external-campaign"],
        );
        await db.query("insert into klaviyo_report_runs values($1,$2,$3)", [
          report,
          org,
          account,
        ]);
        await db.query(
          `insert into klaviyo_report_values values($1,$2,'campaign','','external-campaign',
      '2026-08-01','2026-08-31','EUR',50,'{}')`,
          [org, report],
        );
        await db.query(
          `insert into fixture_report(bucket_month,entity_type,entity_id,revenue,delivered) values('2026-08-01','campaign',$1,50,100)`,
          [campaign],
        );
        const observation = async () =>
          (
            await db.query(
              "select a27_mailing_report($1,'2026-08-01','2026-08-31',$2) as value",
              [org, store],
            )
          ).rows[0].value;
        const known = await observation();
        assert.equal(known.account_id, account);
        assert.equal(known.currency_code, "EUR");
        assert.equal(known.revenue, 50);
        assert.equal(known.opens_unique, null);
        assert.equal(known.period_end, "2026-08-31");
        await db.query(
          `insert into klaviyo_report_values values($1,$2,'campaign','','external-campaign',
      '2026-08-01','2026-08-31','USD',100,'{}')`,
          [org, report],
        );
        assert.equal((await observation()).revenue, null);
        assert.equal((await observation()).currency_code, null);
        await db.exec("update klaviyo_report_values set currency_code=null");
        assert.equal((await observation()).revenue, null);
        const sequence = id(34),
          draft = id(35),
          message = id(36);
        await seed(sequence);
        await approve(sequence);
        await db.query(
          "update marketing_mailing_sequences set approved_at='1999-01-01' where id=$1",
          [sequence],
        );
        await db.query(
          "insert into marketing_content_drafts(id,organization_id,status,request) values($1,$2,$3,$4)",
          [
            draft,
            org,
            "approved",
            {
              store_id: request.store_connection_id,
              mailing_sequence: {
                sequence_id: sequence,
                revision,
                email_number: 1,
              },
            },
          ],
        );
        await db.query(
          "insert into klaviyo_campaign_messages(id,organization_id,campaign_id,channel,external_message_id) values($1,$2,$3,'email','message')",
          [message, org, campaign],
        );
        const link = async (version = 1) =>
          (
            await db.query(
              "select link_mailing_delivery($1,$2,$3,1,$4,$5,$6,$7) as receipt",
              [org, sequence, revision, draft, version, message, actor],
            )
          ).rows[0].receipt;
        await assert.rejects(link(99), /draft_conflict/);
        const receipt = await link();
        assert.equal(receipt.provider_campaign_id, campaign);
        assert.equal(receipt.content_match_status, "unverified");
        assert.equal(
          (await link()).id,
          receipt.id,
          "receipt retries are idempotent",
        );
        await db.query("update klaviyo_accounts set store_id=$1 where id=$2", [
          id(999),
          account,
        ]);
        await assert.rejects(link(), /scope_invalid/);
        await db.query("update klaviyo_accounts set store_id=$1 where id=$2", [
          store,
          account,
        ]);
        await db.query(
          "update integration_connections set status='disconnected' where id=$1",
          [connection],
        );
        assert.equal((await observation()).account_status, "inactive");
      },
    );

    await t.test(
      "quota is atomic per store and request, and functions are service-only invokers",
      async () => {
        const reserve = async (requestKey, storeId = store) =>
          (
            await db.query(
              "select reserve_a27_manual_refresh($1,$2,$3,$4,$5,$6) as result",
              [
                crypto.randomUUID(),
                org,
                "a27_planificador_mailing",
                1,
                requestKey,
                storeId,
              ],
            )
          ).rows[0].result;
        assert.equal(await reserve("one"), "reserved");
        assert.equal(await reserve("one"), "duplicate");
        assert.equal(await reserve("two"), "limit");
        assert.equal(await reserve("two", id(100)), "reserved");
        const acl =
          await db.query(`select proname, prosecdef, has_function_privilege('authenticated', oid, 'execute') as exposed
      from pg_proc where proname in ('approve_mailing_sequence','mutate_mailing_graph','set_mailing_draft_schedule','a27_mailing_report','reserve_a27_manual_refresh','link_mailing_delivery','finalize_a27_mailing_generation')`);
        assert.equal(acl.rows.length, 7);
        assert.ok(
          acl.rows.every(
            (row) => row.prosecdef === false && row.exposed === false,
          ),
        );
        await db.exec("set role authenticated");
    await assert.rejects(db.query("select * from marketing_mailing_campaign_emails"), /permission denied/);
        await assert.rejects(
          db.query("select mutate_mailing_graph($1,$2,'claim','{}')", [
            id(11),
            tokenA,
          ]),
          /permission denied/,
        );
        await db.exec("reset role");
      },
    );
  },
);
