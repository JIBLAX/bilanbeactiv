const { test, expect } = require('@playwright/test');

function cohortClientsPayload() {
  const year = new Date().getFullYear();
  const dateStr = `${year}-06-15`;
  return {
    year,
    dateStr,
    json: JSON.stringify([
      { id: 't1', prenom: 'A', nom: 'Open', statut: 'Contact', date: dateStr, first_contact_date: dateStr },
      {
        id: 't2',
        prenom: 'B',
        nom: 'Closed',
        statut: 'Closé',
        date: dateStr,
        montant: 100,
        sig_offre_id: 'o4',
        offres: 'Libellé périmé',
      },
      {
        id: 't3',
        prenom: 'C',
        nom: 'Ancien',
        statut: 'Ancien Client',
        date: dateStr,
        montant: 50,
        sig_offre_id: 'o1',
        offres: 'Vieux',
      },
    ]),
  };
}

test.describe('BILAN CRM — KPI', () => {
  test('Stats: 1ers contacts, volume RDV, closings + offres catalogue', async ({ page, context }) => {
    const { json } = cohortClientsPayload();
    await context.addInitScript((payload) => {
      sessionStorage.setItem('ba_pin', '1');
      localStorage.setItem('ba_clients_v8', payload);
      localStorage.setItem('ba_rdvs_v8', '[]');
    }, json);

    await page.goto('/index.html');
    await page.waitForFunction(() => typeof window.showPg === 'function');
    await page.evaluate(() => {
      window.showPg('stats');
      window.renderStats();
    });

    await expect(page.locator('#st-p')).toHaveText('1');
    await expect(page.locator('#st-r')).toHaveText('3');
    await expect(page.locator('#st-c')).toHaveText('2');
    await expect(page.locator('#st-p-lbl')).toHaveText('1er contact');
    await expect(page.locator('#stat-closing-pct')).toContainText('67');

    const off = page.locator('#stats-offres');
    await expect(off).toContainText('JM PASS');
    await expect(off).toContainText('ACTIV RESET ONLINE');
    await expect(off).not.toContainText('Libellé périmé');
  });

  test('Accueil: objectif du mois (funnel)', async ({ page, context }) => {
    const { json } = cohortClientsPayload();
    await context.addInitScript((payload) => {
      sessionStorage.setItem('ba_pin', '1');
      localStorage.setItem('ba_clients_v8', payload);
      localStorage.setItem('ba_rdvs_v8', '[]');
      localStorage.removeItem('ba_home_funnel_v1');
    }, json);

    await page.goto('/index.html');
    await page.waitForFunction(() => typeof window.updateKPIs === 'function');
    await page.evaluate(() => window.updateKPIs());

    await expect(page.locator('#home-objectif-funnel')).toContainText('CA cible');
    await expect(page.locator('#home-objectif-funnel')).toContainText('Plan par offre');
  });

  test('Wrapped: closings = Closé + Ancien', async ({ page, context }) => {
    const { json, year } = cohortClientsPayload();
    await context.addInitScript((payload) => {
      sessionStorage.setItem('ba_pin', '1');
      localStorage.setItem('ba_clients_v8', payload);
      localStorage.setItem('ba_rdvs_v8', '[]');
    }, json);

    await page.goto('/index.html');
    await page.waitForFunction(() => typeof window.openWrapped === 'function');
    await page.evaluate((y) => {
      ST.statsYear = y;
      openWrapped();
    }, year);

    const closingsVal = page.locator('.wr-kpi').nth(2).locator('.wr-kpi-v');
    await expect(closingsVal).toHaveText('2');
  });

  test('Navigation Contacts sans erreur', async ({ page, context }) => {
    await context.addInitScript(() => {
      sessionStorage.setItem('ba_pin', '1');
      localStorage.setItem('ba_clients_v8', '[]');
      localStorage.setItem('ba_rdvs_v8', '[]');
    });
    await page.goto('/index.html');
    await page.waitForFunction(() => typeof window.showPg === 'function');
    await page.evaluate(() => window.showPg('clients'));
    await expect(page.locator('#clients-list')).toBeVisible();
  });
});
