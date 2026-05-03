const { test, expect } = require('@playwright/test');

/** Séquence navigateur : 4 étapes signature + versements si échéant (même logique que l’UI). */
function signAllStepsScript() {
  return String(function signAll(clientId, offerId) {
    var c = ST.clients.find(function (x) {
      return String(x.id) === String(clientId);
    });
    if (!c) return { ok: false, err: 'client introuvable' };
    c.sig_offre_id = offerId;
    c.moyen_paiement = 'cb';
    var o = loadOffres().find(function (x) {
      return x.id === offerId;
    });
    if (o && (c.montant == null || c.montant === '') && !c.actual_amount) {
      c.montant = o.price;
      c.actual_amount = o.price;
    }
    initSigSteps(c);
    validateSigStep(clientId, 0);
    validateSigStep(clientId, 1);
    c = ST.clients.find(function (x) {
      return String(x.id) === String(clientId);
    });
    var multi = c.versements && c.versements.length > 1;
    if (multi) {
      c.versements.forEach(function (v) {
        validateVersement(clientId, v.num);
      });
    } else {
      validateSigStep(clientId, 2);
    }
    validateSigStep(clientId, 3);
    c = ST.clients.find(function (x) {
      return String(x.id) === String(clientId);
    });
    var all = c.sig_steps && c.sig_steps.every(function (s) {
      return s.done;
    });
    return {
      ok: !!all,
      versements: (c.versements || []).length,
      multi: !!multi,
      sig_offre_id: c.sig_offre_id,
      offres: c.offres,
      business_offer_name: c.business_offer_name,
    };
  });
}

test.describe.configure({ mode: 'serial' });

test.describe('Vie dossier — chaîne complète', () => {
  test('JM PASS (o4) : signature 1× → closing → parcours initialisé', async ({ page, context }) => {
    const year = new Date().getFullYear();
    const d = year + '-07-01';
    const id = 'life-jm-' + Date.now();
    await context.addInitScript(
      (payload) => {
        sessionStorage.setItem('ba_pin', '1');
        localStorage.setItem(
          'ba_clients_v8',
          JSON.stringify([
            {
              id: payload.id,
              prenom: 'Jean',
              nom: 'JMTest',
              statut: 'Attente RDV',
              sig_started: true,
              date: payload.d,
              source: 'E2E',
            },
          ])
        );
        localStorage.setItem('ba_rdvs_v8', '[]');
      },
      { id, d }
    );

    await page.goto('/index.html');
    await page.waitForFunction(() => typeof validateSigStep === 'function');

    const signAll = signAllStepsScript();
    const r1 = await page.evaluate(
      ([fnBody, cid, oid]) => {
        var signAll = eval('(' + fnBody + ')');
        return signAll(cid, oid);
      },
      [signAll, id, 'o4']
    );
    expect(r1.ok).toBe(true);
    expect(r1.multi).toBe(false);
    expect(r1.versements).toBe(1);

    await page.evaluate((cid) => finalizeClosing(cid), id);
    const snap = await page.evaluate((cid) => {
      var c = ST.clients.find(function (x) {
        return String(x.id) === String(cid);
      });
      if (!c) return null;
      var sd = getActiveStageDefs(c);
      if (sd && sd.length) {
        migrateClientModeStagesToNewDefs(c, sd);
        initModeStages(c, sd);
      }
      return {
        statut: c.statut,
        msLen: (c.mode_stages || []).length,
        offres: c.offres,
        sig: c.sig_offre_id,
      };
    }, id);
    expect(snap.statut).toBe('Closé');
    expect(snap.msLen).toBeGreaterThan(0);
    expect(snap.offres).toContain('JM PASS');
    expect(snap.sig).toBe('o4');
  });

  test('ACTIV RESET ONLINE (o1) : 3 versements → signature complète', async ({ page, context }) => {
    const year = new Date().getFullYear();
    const id = 'life-reset-' + Date.now();
    await context.addInitScript(
      (payload) => {
        sessionStorage.setItem('ba_pin', '1');
        localStorage.setItem(
          'ba_clients_v8',
          JSON.stringify([
            {
              id: payload.id,
              prenom: 'R',
              nom: 'ResetTest',
              statut: 'Attente RDV',
              sig_started: true,
              date: payload.d,
              source: 'E2E',
            },
          ])
        );
        localStorage.setItem('ba_rdvs_v8', '[]');
      },
      { id, d: year + '-07-02' }
    );

    await page.goto('/index.html');
    await page.waitForFunction(() => typeof validateVersement === 'function');
    const signAll = signAllStepsScript();
    const r1 = await page.evaluate(
      ([fnBody, cid, oid]) => {
        var signAll = eval('(' + fnBody + ')');
        return signAll(cid, oid);
      },
      [signAll, id, 'o1']
    );
    expect(r1.ok).toBe(true);
    expect(r1.multi).toBe(true);
    expect(r1.versements).toBe(3);

    await page.evaluate((cid) => finalizeClosing(cid), id);
    const snap = await page.evaluate((cid) => {
      var c = ST.clients.find(function (x) {
        return String(x.id) === String(cid);
      });
      return c ? { statut: c.statut, offres: c.offres } : null;
    }, id);
    expect(snap.statut).toBe('Closé');
    expect(snap.offres).toMatch(/RESET/i);
  });

  test('Deux offres successives sur le même dossier', async ({ page, context }) => {
    const year = new Date().getFullYear();
    const id = 'life-2off-' + Date.now();
    await context.addInitScript(
      (payload) => {
        sessionStorage.setItem('ba_pin', '1');
        localStorage.setItem(
          'ba_clients_v8',
          JSON.stringify([
            {
              id: payload.id,
              prenom: 'Double',
              nom: 'Offre',
              statut: 'Attente RDV',
              sig_started: true,
              date: payload.d,
              source: 'E2E',
            },
          ])
        );
        localStorage.setItem('ba_rdvs_v8', '[]');
      },
      { id, d: year + '-07-03' }
    );

    await page.goto('/index.html');
    await page.waitForFunction(() => typeof openNewOffreForClient === 'function');
    const signAll = signAllStepsScript();

    let r = await page.evaluate(
      ([fnBody, cid, oid]) => {
        var signAll = eval('(' + fnBody + ')');
        return signAll(cid, oid);
      },
      [signAll, id, 'o4']
    );
    expect(r.ok).toBe(true);
    await page.evaluate((cid) => finalizeClosing(cid), id);

    await page.evaluate((cid) => openNewOffreForClient(cid), id);
    await page.waitForTimeout(900);

    r = await page.evaluate(
      ([fnBody, cid, oid]) => {
        var signAll = eval('(' + fnBody + ')');
        return signAll(cid, oid);
      },
      [signAll, id, 'o1']
    );
    expect(r.ok).toBe(true);

    await page.evaluate((cid) => finalizeClosing(cid), id);

    const snap = await page.evaluate((cid) => {
      var c = ST.clients.find(function (x) {
        return String(x.id) === String(cid);
      });
      return c
        ? {
            statut: c.statut,
            sig: c.sig_offre_id,
            offres: c.offres,
            business: c.business_offer_name,
          }
        : null;
    }, id);
    expect(snap.statut).toBe('Closé');
    expect(snap.sig).toBe('o1');
    expect(snap.offres).toMatch(/RESET/i);
  });

  test('Duo (2 membres même groupe) : liste + fiche sans erreur', async ({ page, context }) => {
    const gid = 'g_e2e_' + Date.now();
    const year = new Date().getFullYear();
    const d = year + '-07-04';
    const suf = String(Date.now());
    await context.addInitScript(
      (payload) => {
        sessionStorage.setItem('ba_pin', '1');
        localStorage.setItem(
          'ba_clients_v8',
          JSON.stringify([
            {
              id: 'g1-' + payload.suf,
              prenom: 'A',
              nom: 'Duo1',
              statut: 'Contact',
              date: payload.d,
              groupId: payload.gid,
              group_name: 'Test Duo',
              is_group_leader: true,
            },
            {
              id: 'g2-' + payload.suf,
              prenom: 'B',
              nom: 'Duo2',
              statut: 'Contact',
              date: payload.d,
              groupId: payload.gid,
              group_name: 'Test Duo',
              is_group_leader: false,
            },
          ])
        );
        localStorage.setItem('ba_rdvs_v8', '[]');
      },
      { gid, d, suf }
    );

    await page.goto('/index.html');
    await page.waitForFunction(() => typeof renderClients === 'function');
    await page.evaluate(() => {
      renderClients();
    });
    const list = await page.locator('#clients-list').innerText();
    expect(list).toMatch(/DUO|GROUPE|Test Duo/i);
  });

  test('Structure pro (isPro) : closing + nom affichage Business', async ({ page, context }) => {
    const year = new Date().getFullYear();
    const id = 'life-pro-' + Date.now();
    await context.addInitScript(
      (payload) => {
        sessionStorage.setItem('ba_pin', '1');
        localStorage.setItem(
          'ba_clients_v8',
          JSON.stringify([
            {
              id: payload.id,
              prenom: 'Contact',
              nom: 'Pro',
              structureName: 'Gym Test SARL',
              isPro: true,
              statut: 'Attente RDV',
              sig_started: true,
              date: payload.d,
              source: 'E2E',
            },
          ])
        );
        localStorage.setItem('ba_rdvs_v8', '[]');
      },
      { id, d: year + '-07-05' }
    );

    await page.goto('/index.html');
    const signAll = signAllStepsScript();
    const r1 = await page.evaluate(
      ([fnBody, cid, oid]) => {
        var signAll = eval('(' + fnBody + ')');
        return signAll(cid, oid);
      },
      [signAll, id, 'o9']
    );
    expect(r1.ok).toBe(true);
    await page.evaluate((cid) => finalizeClosing(cid), id);

    const nameBiz = await page.evaluate((cid) => {
      var c = ST.clients.find(function (x) {
        return String(x.id) === String(cid);
      });
      if (!c) return '';
      var fullName = ((c.prenom || '') + ' ' + (c.nom || '')).trim();
      if (c.isPro) fullName = c.structureName || fullName;
      return fullName;
    }, id);
    expect(nameBiz).toBe('Gym Test SARL');
  });

  test('VISIO (o_vis) + CARDIO PACK (o8) : closings catalogue', async ({ page, context }) => {
    const year = new Date().getFullYear();
    const d = year + '-07-06';
    const cases = [
      { id: 'v-' + Date.now(), oid: 'o_vis' },
      { id: 'c-' + (Date.now() + 1), oid: 'o8' },
    ];
    await context.addInitScript(
      (payload) => {
        sessionStorage.setItem('ba_pin', '1');
        var arr = payload.rows.map(function (r) {
          return {
            id: r.id,
            prenom: 'X',
            nom: r.id,
            statut: 'Attente RDV',
            sig_started: true,
            date: payload.d,
            source: 'E2E',
          };
        });
        localStorage.setItem('ba_clients_v8', JSON.stringify(arr));
        localStorage.setItem('ba_rdvs_v8', '[]');
      },
      { rows: cases, d }
    );

    await page.goto('/index.html');
    const signAll = signAllStepsScript();
    for (const row of cases) {
      const r = await page.evaluate(
        ([fnBody, cid, oid]) => {
          var signAll = eval('(' + fnBody + ')');
          return signAll(cid, oid);
        },
        [signAll, row.id, row.oid]
      );
      expect(r.ok).toBe(true);
      await page.evaluate((cid) => finalizeClosing(cid), row.id);
    }

    const closed = await page.evaluate((ids) => {
      return ids.every(function (id) {
        var c = ST.clients.find(function (x) {
          return String(x.id) === String(id);
        });
        return c && c.statut === 'Closé';
      });
    }, cases.map((c) => c.id));
    expect(closed).toBe(true);
  });
});
