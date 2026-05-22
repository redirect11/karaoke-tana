(() => {
  const PRODUCTION_HOSTNAME = 'www.ilkaraokedellatana.it';
  const TEST_HOSTNAME = 'test.ilkaraokedellatana.it';
  const BANNER_ID = 'kt-test-banner';
  const STYLE_ID = 'kt-test-banner-style';

  function shouldShowBanner(hostname) {
    if (!hostname) return false;
    return hostname === TEST_HOSTNAME || hostname !== PRODUCTION_HOSTNAME;
  }

  function injectBanner() {
    const hostname = window.location.hostname.toLowerCase();
    if (!shouldShowBanner(hostname)) return;
    if (!document.body || document.getElementById(BANNER_ID)) return;

    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        #${BANNER_ID} {
          width: 100%;
          align-self: stretch;
          padding: 10px 16px;
          background: linear-gradient(90deg, #9b1c2e 0%, #d4a017 100%);
          color: #fff7e6;
          text-align: center;
          font-size: 0.82rem;
          font-weight: 700;
          letter-spacing: 0.03em;
          border-bottom: 1px solid rgba(255, 255, 255, 0.18);
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
        }
        #${BANNER_ID} strong {
          color: #ffffff;
        }
      `;
      document.head.appendChild(style);
    }

    const banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.innerHTML = '<strong>Ambiente di test</strong> · Questa non è la versione pubblica del sito.';
    document.body.prepend(banner);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectBanner, { once: true });
  } else {
    injectBanner();
  }
})();
