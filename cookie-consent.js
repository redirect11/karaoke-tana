/**
 * Vanilla CookieConsent v3 (orestbida) – inizializzazione condivisa
 * https://cookieconsent.orestbida.com
 *
 * Questo sito utilizza solo cookie tecnici strettamente necessari.
 * I cookie tecnici non richiedono consenso; il banner è puramente informativo.
 */

// Tema scuro del sito applicato alle variabili CSS di CookieConsent
(function () {
  const s = document.createElement('style');
  s.textContent = [
    '#cc-main {',
    "  --cc-font-family: 'Segoe UI', system-ui, sans-serif;",
    '  --cc-modal-border-radius: 14px;',
    '  --cc-btn-border-radius: 999px;',
    '  --cc-bg: #2a1650;',
    '  --cc-secondary-color: #f0e6d3;',
    '  --cc-primary-color: #d4a017;',
    '  --cc-btn-primary-bg: #d4a017;',
    '  --cc-btn-primary-color: #12071f;',
    '  --cc-btn-secondary-bg: #1e0f35;',
    '  --cc-btn-secondary-color: #f0e6d3;',
    '  --cc-btn-secondary-border-color: #3d2366;',
    '  --cc-separator-border-color: #3d2366;',
    '  --cc-cookie-category-block-bg: #1e0f35;',
    '  --cc-cookie-category-block-border: 1px solid #3d2366;',
    '  --cc-overlay-bg: rgba(0,0,0,0.55);',
    '  --cc-toggle-readonly-bg: #4b356f;',
    '  --cc-toggle-on-bg: #d4a017;',
    '  --cc-toggle-off-bg: #3d2366;',
    '}',
  ].join('\n');
  document.head.appendChild(s);
}());

CookieConsent.run({

  // ── Opzioni UI ──────────────────────────────────────────
  guiOptions: {
    consentModal: {
      layout: 'bar',
      position: 'bottom',
      equalWeightButtons: false,
      flipButtons: false,
    },
    preferencesModal: {
      layout: 'box',
      equalWeightButtons: true,
      flipButtons: false,
    },
  },

  // ── Categorie cookie ─────────────────────────────────────
  categories: {
    necessary: {
      enabled: true,
      readOnly: true,
    },
  },

  // ── Lingua ───────────────────────────────────────────────
  language: {
    default: 'it',
    autoDetect: 'browser',
    translations: {
      it: {
        consentModal: {
          title: '🍪 Questo sito usa i cookie',
          description:
            'Utilizziamo solo cookie tecnici strettamente necessari al funzionamento ' +
            'del servizio (prenotazione, sessione). Non raccogliamo dati per ' +
            'profilazione o marketing. ' +
            '<a href="cookie-policy.html" class="cc__link">Leggi la Cookie Policy</a>.',
          acceptAllBtn: 'Accetto',
          footer:
            '<a href="cookie-policy.html" class="cc__link">Cookie Policy</a>',
        },
        preferencesModal: {
          title: 'Impostazioni cookie',
          acceptAllBtn: 'Accetto tutto',
          savePreferencesBtn: 'Salva impostazioni',
          closeIconLabel: 'Chiudi',
          sections: [
            {
              title: 'Cookie strettamente necessari',
              description:
                'Questi cookie sono indispensabili per il corretto funzionamento del sito ' +
                '(es. stato della prenotazione, sessione Instagram) e non possono essere disattivati. ' +
                '<a href="cookie-policy.html" class="cc__link">Cookie Policy completa</a>.',
              linkedCategory: 'necessary',
            },
          ],
        },
      },
    },
  },
});
