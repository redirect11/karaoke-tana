(function (global) {
  const adsenseScriptClients = new Set();

  function ensureAdSenseScript(clientId) {
    if (!clientId) return;
    if (adsenseScriptClients.has(clientId)) return;
    const existing = document.querySelector('script[data-karaoke-adsense-client]');
    if (existing) {
      adsenseScriptClients.add(clientId);
      return;
    }
    adsenseScriptClients.add(clientId);
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
    script.setAttribute('data-karaoke-adsense-client', clientId);
    document.head.appendChild(script);
  }

  function setIntrusiveBodyPadding(intrusive) {
    document.body.classList.toggle('ads-intrusive-active', Boolean(intrusive));
  }

  function renderPlaceholder(container, text) {
    const placeholder = document.createElement('div');
    placeholder.className = 'ads-placeholder';
    placeholder.textContent = text || 'Spazio sponsor';
    container.appendChild(placeholder);
  }

  function renderAdSense(container, policy) {
    if (!policy.adsenseReady) {
      renderPlaceholder(container, 'Spazio sponsor (configurazione AdSense incompleta)');
      return;
    }
    ensureAdSenseScript(policy.adsenseClientId);
    const slot = document.createElement('ins');
    slot.className = 'adsbygoogle karaoke-adsense-slot';
    slot.style.display = 'block';
    slot.setAttribute('data-ad-client', policy.adsenseClientId);
    slot.setAttribute('data-ad-slot', policy.adsenseBannerSlot);
    slot.setAttribute('data-ad-format', 'auto');
    slot.setAttribute('data-full-width-responsive', 'true');
    container.appendChild(slot);
    try {
      (global.adsbygoogle = global.adsbygoogle || []).push({});
    } catch (error) {
      console.warn('AdSense slot push failed, using placeholder fallback.', error);
      renderPlaceholder(container, 'Spazio sponsor');
    }
  }

  function renderProvider(container, policy) {
    if (!policy || policy.provider === 'none') {
      renderPlaceholder(container, 'Supporta Karaoke Tana');
      return;
    }
    if (policy.provider === 'adsense') {
      renderAdSense(container, policy);
      return;
    }
    renderPlaceholder(container, 'Spazio sponsor personalizzato');
  }

  function renderInlineAd(container, policy) {
    container.innerHTML = '';
    renderProvider(container, policy);
  }

  function renderBanner(container, policy) {
    if (!container) return;
    container.innerHTML = '';

    if (!policy || !policy.bannerEnabled) {
      setIntrusiveBodyPadding(false);
      return;
    }

    const banner = document.createElement('aside');
    banner.className = `ads-banner ads-banner--${policy.mode}`;

    const label = document.createElement('div');
    label.className = 'ads-banner-label';
    label.textContent = 'Sponsor';
    banner.appendChild(label);

    const content = document.createElement('div');
    content.className = 'ads-banner-content';
    renderProvider(content, policy);
    banner.appendChild(content);

    container.appendChild(banner);
    setIntrusiveBodyPadding(policy.intrusive);
  }

  global.KaraokeAdsBanner = {
    renderBanner,
    renderInlineAd,
  };
})(window);
