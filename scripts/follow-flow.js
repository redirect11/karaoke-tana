/*
 * follow-flow.js — Logica centralizzata per la visibilità del widget degli step.
 *
 * Fornisce funzioni pure che calcolano lo stato UI del flusso di follow/prenotazione
 * in base allo stato dell'utente. Usato da index.html per decidere cosa mostrare
 * al caricamento e durante i refresh realtime/polling.
 *
 * Esportazioni:
 *   FollowFlow.computeFollowFlowVisibility(params)
 *     Calcola la visibilità del widget step in base a followedAtPageLoad e followedInSession.
 *
 *   FollowFlow.shouldRestoreFollowFlow(params)
 *     Restituisce true solo se il flusso di follow va ripristinato (es. dopo che le
 *     prenotazioni tornano abilitate), false se l'utente è già in uno stato attivo.
 *
 *   FollowFlow.shouldShowVoteLink(params)
 *     Restituisce true quando il link "Vota" deve essere visibile nel flusso follow.
 *
 * Compatibile con browser (window global) e Node.js (module.exports).
 */
(function (global) {
  'use strict';

  /**
   * Calcola la visibilità del widget degli step e del box Segui.
   *
   * Regole:
   * - followedAtPageLoad=true  → steps nascosti, form visibile (ha già seguito prima del reload)
   * - followedInSession=true   → steps visibili step 2, form visibile (ha appena seguito senza reload)
   * - entrambi false           → steps visibili step 1, box Segui visibile (non ha mai seguito)
   *
   * @param {object} [params]
   * @param {boolean} [params.followedAtPageLoad=false] Cookie ig_followed era presente al caricamento
   * @param {boolean} [params.followedInSession=false]  Utente ha cliccato Segui in questa sessione
   * @returns {{ showSteps: boolean, showFollowBox: boolean, showForm: boolean, activeStep: number }}
   */
  function computeFollowFlowVisibility(params) {
    var p = params || {};
    var followedAtPageLoad = Boolean(p.followedAtPageLoad);
    var followedInSession  = Boolean(p.followedInSession);

    if (followedAtPageLoad) {
      // Ha già seguito prima del reload: nascondi il widget step, mostra direttamente il form.
      return { showSteps: false, showFollowBox: false, showForm: true, activeStep: 0 };
    }
    if (followedInSession) {
      // Ha appena cliccato Segui senza ricaricare: step 1 completato, step 2 attivo.
      return { showSteps: true, showFollowBox: false, showForm: true, activeStep: 2 };
    }
    // Primo accesso o reload senza follow: step 1, box Segui visibile.
    return { showSteps: true, showFollowBox: true, showForm: false, activeStep: 1 };
  }

  /**
   * Determina se il flusso di follow/form va ripristinato durante un evento
   * realtime/refresh/focus/pageshow.
   *
   * Restituisce false quando l'utente è già in uno stato attivo del flusso di
   * prenotazione (waiting, success, form visibile, o box Segui visibile):
   * in tal caso non occorre e non si deve ri-renderizzare il widget.
   *
   * @param {object} [params]
   * @param {boolean} [params.isWaiting=false]       Schermata di attesa prenotazione visibile
   * @param {boolean} [params.isSuccess=false]       Schermata di successo prenotazione visibile
   * @param {boolean} [params.isInBookingFlow=false] Form o box Segui già visibili
   * @returns {boolean}
   */
  function shouldRestoreFollowFlow(params) {
    var p = params || {};
    return !p.isWaiting && !p.isSuccess && !p.isInBookingFlow;
  }

  /**
   * Determina se mostrare il link "Vota" nel box follow.
   *
   * @param {object} [params]
   * @param {boolean} [params.voteOpen=false] Votazioni aperte
   * @param {boolean} [params.followedAtPageLoad=false] Cookie ig_followed era presente al caricamento
   * @param {boolean} [params.followedInSession=false]  Utente ha cliccato Segui in questa sessione
   * @returns {boolean}
   */
  function shouldShowVoteLink(params) {
    var p = params || {};
    var hasCompletedFollow = Boolean(p.followedAtPageLoad) || Boolean(p.followedInSession);
    return Boolean(p.voteOpen) && hasCompletedFollow;
  }

  var FollowFlow = {
    computeFollowFlowVisibility: computeFollowFlowVisibility,
    shouldRestoreFollowFlow: shouldRestoreFollowFlow,
    shouldShowVoteLink: shouldShowVoteLink,
  };

  /* Compatibilità UMD: Node.js (require) e browser (window global). */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = FollowFlow;
  } else {
    global.FollowFlow = FollowFlow;
  }
}(typeof window !== 'undefined' ? window : globalThis));
