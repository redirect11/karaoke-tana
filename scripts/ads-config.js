(function (global) {
  const VALID_MODES = ['off', 'soft', 'intrusive'];
  const VALID_PROVIDERS = ['none', 'adsense', 'custom'];

  function normalizeBoolean(value, fallback) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
      if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    }
    return Boolean(fallback);
  }

  function normalizeMode(value, fallback) {
    const normalized = String(value || '').trim().toLowerCase();
    if (VALID_MODES.includes(normalized)) return normalized;
    return fallback || 'off';
  }

  function normalizeProvider(value, fallback) {
    const normalized = String(value || '').trim().toLowerCase();
    if (VALID_PROVIDERS.includes(normalized)) return normalized;
    return fallback || 'none';
  }

  function asTrimmedString(value) {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  function buildPolicy(baseConfig, overrides) {
    const merged = Object.assign({}, baseConfig || {}, overrides || {});
    const enabled = normalizeBoolean(merged.ADS_ENABLED, false);
    const mode = normalizeMode(merged.ADS_MODE, 'off');
    const provider = normalizeProvider(merged.ADS_PROVIDER, 'none');
    const adsenseClientId = asTrimmedString(merged.ADSENSE_CLIENT_ID);
    const adsenseBannerSlot = asTrimmedString(merged.ADSENSE_BANNER_SLOT);
    const bannerEnabled = enabled && mode !== 'off';
    const requireBeforeBooking = bannerEnabled && normalizeBoolean(merged.ADS_REQUIRE_BEFORE_BOOKING, false);
    const adsenseReady = provider === 'adsense' && Boolean(adsenseClientId && adsenseBannerSlot);

    return {
      enabled,
      mode,
      provider,
      intrusive: mode === 'intrusive',
      bannerEnabled,
      requireBeforeBooking,
      adsenseClientId,
      adsenseBannerSlot,
      adsenseReady,
      raw: merged,
    };
  }

  function createPolicyStore(baseConfig) {
    let runtimeOverrides = {};
    return {
      getPolicy() {
        return buildPolicy(baseConfig, runtimeOverrides);
      },
      setRuntimeOverrides(nextOverrides) {
        runtimeOverrides = Object.assign({}, runtimeOverrides, nextOverrides || {});
        return this.getPolicy();
      },
      clearRuntimeOverrides() {
        runtimeOverrides = {};
        return this.getPolicy();
      },
    };
  }

  global.KaraokeAdsConfig = {
    buildPolicy,
    createPolicyStore,
  };
})(window);
