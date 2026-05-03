const { test, expect } = require('@playwright/test');

async function gotoContactsOpenCard(page, fullName) {
  await page.locator('.sb-ni[data-pg="clients"]').click();
  await expect(page.locator('#clients-list .ccrd')).toHaveCount(1);
  await page.getByText(fullName, { exact: true }).click();
  const modal = page.locator('#m-client');
  await expect(modal).toHaveClass(/open/);
  return { modal, body: page.locator('#m-client-body') };
}

async function assertClosingReopenAndStat(page, modal, body, id, expectSig) {
  await expect(modal).not.toHaveClass(/open/, { timeout: 5000 });
  await expect(modal).toHaveClass(/open/, { timeout: 20000 });
  await expect(body.locator('.cm-meta, .pm-meta').first()).toContainText('Closé');

  const closed = await page.evaluate((cid) => {
    var c = ST.clients.find(function (x) {
      return String(x.id) === String(cid);
    });
    if (!c) return null;
    var o = loadOffres().find(function (x) {
      return x.id === c.sig_offre_id;
    });
    var offFirst = String(c.offres || '')
      .split(',')[0]
      .trim();
    return {
      statut: c.statut,
      sig: c.sig_offre_id,
      offFirst: offFirst,
      catName: o ? String(o.name || '').trim() : '',
    };
  }, id);
  expect(closed.statut).toBe('Closé');
  expect(closed.sig).toBe(expectSig);
  expect(closed.catName).toBeTruthy();
  expect(closed.offFirst).toBe(closed.catName);
}

/**
 * Parcours nominal entièrement piloté par l’UI (clics / listes),
 * complémentaire aux tests lifecycle qui appellent les globales en evaluate().
 */
test('Golden path UI : JM PASS (o4) paiement unique → Closé', async ({
  page,
  context,
}) => {
  const year = new Date().getFullYear();
  const dateStr = `${year}-08-10`;
  const id = `golden-ui-${Date.now()}`;
  const nomTag = `GoldenUI${Date.now()}`;
  const fullName = `E2E ${nomTag}`;

  await context.addInitScript(
    (payload) => {
      sessionStorage.setItem('ba_pin', '1');
      localStorage.removeItem('ba_offres_v8');
      localStorage.setItem(
        'ba_clients_v8',
        JSON.stringify([
          {
            id: payload.id,
            prenom: 'E2E',
            nom: payload.nomTag,
            statut: 'Attente RDV',
            sig_started: true,
            date: payload.dateStr,
            source: 'E2E-UI',
          },
        ])
      );
      localStorage.setItem('ba_rdvs_v8', '[]');
    },
    { id, nomTag, dateStr }
  );

  await page.goto('/index.html');
  await page.waitForFunction(() => typeof window.showPg === 'function');

  const { modal, body } = await gotoContactsOpenCard(page, fullName);
  await expect(body).toContainText('Signature & Paiement');

  await body.locator('.cm-sig-form select').first().selectOption('o4');
  await expect(body.locator('.cm-sig-form select')).toHaveCount(2);
  await body.locator('.cm-sig-form select').nth(1).selectOption('cb');

  for (let step = 0; step < 4; step++) {
    const chk = body.locator('.cm-step-check:not(.locked):not(.done)').first();
    await expect(chk).toBeVisible({ timeout: 10000 });
    await chk.click();
  }

  await body.getByRole('button', { name: /Signé \+ Payé/i }).click();
  await assertClosingReopenAndStat(page, modal, body, id, 'o4');
});

test('Golden path UI : ACTIV RESET ONLINE (o1) 3 versements → Closé', async ({
  page,
  context,
}) => {
  const year = new Date().getFullYear();
  const dateStr = `${year}-08-11`;
  const id = `golden-3x-${Date.now()}`;
  const nomTag = `ResetUI${Date.now()}`;
  const fullName = `E2E ${nomTag}`;

  await context.addInitScript(
    (payload) => {
      sessionStorage.setItem('ba_pin', '1');
      localStorage.removeItem('ba_offres_v8');
      localStorage.setItem(
        'ba_clients_v8',
        JSON.stringify([
          {
            id: payload.id,
            prenom: 'E2E',
            nom: payload.nomTag,
            statut: 'Attente RDV',
            sig_started: true,
            date: payload.dateStr,
            source: 'E2E-UI',
          },
        ])
      );
      localStorage.setItem('ba_rdvs_v8', '[]');
    },
    { id, nomTag, dateStr }
  );

  await page.goto('/index.html');
  await page.waitForFunction(() => typeof window.showPg === 'function');

  const { modal, body } = await gotoContactsOpenCard(page, fullName);
  await expect(body).toContainText('Signature & Paiement');

  await body.locator('.cm-sig-form select').first().selectOption('o1');
  await expect(body.locator('.cm-sig-form select')).toHaveCount(2);
  await body.locator('.cm-sig-form select').nth(1).selectOption('cb');

  for (let step = 0; step < 2; step++) {
    const chk = body.locator('.cm-step-check:not(.locked):not(.done)').first();
    await expect(chk).toBeVisible({ timeout: 10000 });
    await chk.click();
  }

  for (let v = 0; v < 3; v++) {
    const vchk = body.locator('.cm-versement-check:not(.done)').first();
    await expect(vchk).toBeVisible({ timeout: 10000 });
    await vchk.click();
  }

  const lastStep = body.locator('.cm-step-check:not(.locked):not(.done)').first();
  await expect(lastStep).toBeVisible({ timeout: 10000 });
  await lastStep.click();

  await body.getByRole('button', { name: /Signé \+ Payé/i }).click();
  await assertClosingReopenAndStat(page, modal, body, id, 'o1');
});

test('Golden path UI : Pro — Démarrer Signature → à la carte (o9) → Closé', async ({
  page,
  context,
}) => {
  const year = new Date().getFullYear();
  const dateStr = `${year}-08-12`;
  const id = `golden-pro-${Date.now()}`;
  const nomTag = `ProUI${Date.now()}`;
  const fullName = `Contact ${nomTag}`;
  const structureName = 'E2E Pro SARL UI';

  await context.addInitScript(
    (payload) => {
      sessionStorage.setItem('ba_pin', '1');
      localStorage.removeItem('ba_offres_v8');
      localStorage.setItem(
        'ba_clients_v8',
        JSON.stringify([
          {
            id: payload.id,
            prenom: 'Contact',
            nom: payload.nomTag,
            structureName: payload.structureName,
            isPro: true,
            statut: 'Contact',
            sig_started: false,
            date: payload.dateStr,
            source: 'E2E-UI',
          },
        ])
      );
      localStorage.setItem('ba_rdvs_v8', '[]');
    },
    { id, nomTag, dateStr, structureName }
  );

  await page.goto('/index.html');
  await page.waitForFunction(() => typeof window.showPg === 'function');

  const { modal, body } = await gotoContactsOpenCard(page, fullName);
  await expect(body.getByRole('button', { name: /Démarrer Signature/i })).toBeVisible();
  await body.getByRole('button', { name: /Démarrer Signature/i }).click();

  await expect(modal).not.toHaveClass(/open/, { timeout: 5000 });
  await expect(modal).toHaveClass(/open/, { timeout: 20000 });
  await expect(body).toContainText('Signature & Paiement');

  await body.locator('.cm-sig-form select').first().selectOption('o9');
  await expect(body.locator('.cm-sig-form select')).toHaveCount(2);
  await body.locator('.cm-sig-form select').nth(1).selectOption('cb');

  for (let step = 0; step < 4; step++) {
    const chk = body.locator('.cm-step-check:not(.locked):not(.done)').first();
    await expect(chk).toBeVisible({ timeout: 10000 });
    await chk.click();
  }

  await body.getByRole('button', { name: /Signé \+ Payé/i }).click();
  await assertClosingReopenAndStat(page, modal, body, id, 'o9');

  const displayName = await page.evaluate((cid) => {
    var c = ST.clients.find(function (x) {
      return String(x.id) === String(cid);
    });
    if (!c) return '';
    var fullName = ((c.prenom || '') + ' ' + (c.nom || '')).trim();
    if (c.isPro) fullName = c.structureName || fullName;
    return fullName;
  }, id);
  expect(displayName).toBe(structureName);
});
