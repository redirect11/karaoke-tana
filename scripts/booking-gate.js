(function (global) {
  function createBookingGate(options) {
    const opts = options || {};
    const modalEl = opts.modalEl || null;
    const messageEl = modalEl ? modalEl.querySelector('[data-booking-gate-message]') : null;
    const adPreviewEl = modalEl ? modalEl.querySelector('[data-booking-gate-ad]') : null;
    const cancelBtn = modalEl ? modalEl.querySelector('[data-booking-gate-action="cancel"]') : null;
    const continueBtn = modalEl ? modalEl.querySelector('[data-booking-gate-action="continue"]') : null;
    const renderAdContent = typeof opts.renderAdContent === 'function' ? opts.renderAdContent : null;

    function setMessage(policy) {
      if (!messageEl) return;
      const sponsorLabel = policy.provider === 'adsense' ? 'sponsor AdSense' : 'sponsor breve';
      messageEl.textContent = `Prima della conferma, visualizza un ${sponsorLabel} per supportare Karaoke Tana.`;
    }

    function preparePreview(policy) {
      if (!adPreviewEl) return;
      adPreviewEl.innerHTML = '';
      if (renderAdContent) {
        renderAdContent(adPreviewEl, policy);
        return;
      }
      const fallback = document.createElement('div');
      fallback.className = 'ads-placeholder';
      fallback.textContent = 'Anteprima sponsor';
      adPreviewEl.appendChild(fallback);
    }

    function closeModal(resolve, result) {
      if (!modalEl) {
        resolve(result);
        return;
      }
      modalEl.classList.remove('open');
      resolve(result);
    }

    async function requestConfirmation(policy) {
      if (!policy || !policy.requireBeforeBooking) return true;
      if (!modalEl || !cancelBtn || !continueBtn) return true;

      setMessage(policy);
      preparePreview(policy);
      modalEl.classList.add('open');

      return new Promise((resolve) => {
        const cleanup = () => {
          cancelBtn.removeEventListener('click', onCancel);
          continueBtn.removeEventListener('click', onContinue);
          modalEl.removeEventListener('click', onBackdrop);
        };

        const onCancel = () => {
          cleanup();
          closeModal(resolve, false);
        };

        const onContinue = () => {
          cleanup();
          closeModal(resolve, true);
        };

        const onBackdrop = (event) => {
          if (event.target === modalEl) onCancel();
        };

        cancelBtn.addEventListener('click', onCancel);
        continueBtn.addEventListener('click', onContinue);
        modalEl.addEventListener('click', onBackdrop);
      });
    }

    return { requestConfirmation };
  }

  global.KaraokeBookingGate = { createBookingGate };
})(window);
