(function () {
  'use strict';

  // Le backlog, repris de docs/user-stories.md. Si une story change là-bas,
  // la corriger ici : la carte des épics et l'annexe sont générées à partir de cette liste.
  // Format : [identifiant, titre, priorité, état] avec état = fait | cours | afaire.
  var EPICS = [
    ['CPT', 'Compte et sécurité'],
    ['EXT', 'Comptes externes'],
    ['COL', 'Collection'],
    ['STA', 'Statut et progression'],
    ['TIM', 'Timeline et suivi'],
    ['ALE', 'Alertes'],
    ['REC', 'Recommandations'],
    ['SOC', 'Social'],
    ['PRO', 'Profil'],
    ['ACT', "Fil d'actualité"],
    ['ADM', 'Administration']
  ];

  var STORIES = [
    ['CPT-01', 'Créer un compte avec mon email', 'Indispensable', 'fait'],
    ['CPT-02', 'Valider mon adresse email', 'Indispensable', 'afaire'],
    ['CPT-03', 'Me connecter par email, Google ou Microsoft', 'Indispensable', 'fait'],
    ['CPT-04', 'Me connecter avec Apple', 'Important', 'cours'],
    ['CPT-05', 'Réinitialiser mon mot de passe oublié', 'Indispensable', 'afaire'],
    ['CPT-06', 'Me déconnecter', 'Indispensable', 'fait'],
    ['CPT-07', 'Supprimer mon compte et toutes mes données', 'Indispensable', 'cours'],
    ['CPT-08', 'Gérer mes consentements et exporter mes données', 'Important', 'afaire'],
    ['CPT-09', 'Consulter les mentions légales et la confidentialité', 'Important', 'afaire'],
    ['EXT-01', 'Lier mon compte Steam', 'Indispensable', 'fait'],
    ['EXT-02', 'Importer ma bibliothèque Steam', 'Indispensable', 'fait'],
    ['EXT-03', 'Importer ma bibliothèque PlayStation', 'Important', 'afaire'],
    ['EXT-04', 'Importer ma bibliothèque Xbox', 'Important', 'afaire'],
    ['EXT-05', 'Importer ma bibliothèque Nintendo', 'Important', 'afaire'],
    ['EXT-06', 'Importer ma bibliothèque Epic Games', 'Important', 'afaire'],
    ['EXT-07', 'Garder mes données à jour automatiquement', 'Important', 'afaire'],
    ['COL-01', 'Parcourir et rechercher ma collection', 'Indispensable', 'fait'],
    ['COL-02', 'Ajouter un jeu à la main', 'Indispensable', 'fait'],
    ['COL-03', "Consulter la fiche d'un jeu", 'Indispensable', 'fait'],
    ['COL-04', 'Retirer ou ignorer un jeu', 'Important', 'fait'],
    ['COL-05', 'Consulter ma collection sur téléphone', 'Important', 'afaire'],
    ['COL-06', 'Ajouter un jeu à ma wishlist', 'Important', 'afaire'],
    ['COL-07', 'Ajouter un jeu absent du catalogue', 'Important', 'afaire'],
    ['STA-01', "Changer le statut d'un jeu", 'Indispensable', 'fait'],
    ['STA-02', 'Filtrer ma collection par statut', 'Indispensable', 'fait'],
    ['TIM-01', 'Voir les prochaines sorties', 'Important', 'fait'],
    ['TIM-02', 'Filtrer les sorties par genre', 'Important', 'fait'],
    ['TIM-03', 'Filtrer les sorties par plateforme et par date', 'Important', 'cours'],
    ['TIM-04', 'Suivre un jeu à venir', 'Important', 'cours'],
    ['TIM-05', 'Filtrer les sorties par studio ou éditeur', 'Important', 'afaire'],
    ['ALE-01', "Être alerté de la sortie d'un jeu de ma wishlist", 'Important', 'afaire'],
    ['ALE-02', 'Régler mes préférences de notification', 'Important', 'afaire'],
    ['ALE-03', 'Recevoir une notification push sur mon téléphone', 'Important', 'afaire'],
    ['ALE-04', 'Être alerté des mises à jour importantes de mes jeux', 'Important', 'afaire'],
    ['REC-01', 'Obtenir des recommandations personnalisées', 'Indispensable', 'fait'],
    ['REC-02', 'Dire si une recommandation me plaît', 'Indispensable', 'fait'],
    ['REC-03', 'Recevoir mes recommandations sur téléphone', 'Important', 'afaire'],
    ['REC-04', 'Obtenir des suggestions de jeux courts', 'Important', 'afaire'],
    ['SOC-01', 'Ajouter un ami', 'Bonus', 'afaire'],
    ['SOC-02', 'Échanger des messages avec mes amis', 'Bonus', 'afaire'],
    ['SOC-03', 'Partager un jeu avec un ami', 'Bonus', 'afaire'],
    ['SOC-04', 'Signaler un utilisateur ou un message', 'Bonus', 'afaire'],
    ['SOC-05', 'Voir ce que mes amis jouent en ce moment', 'Bonus', 'afaire'],
    ['SOC-06', 'Bloquer un utilisateur', 'Bonus', 'afaire'],
    ['PRO-01', 'Modifier ma bio et la visibilité de mon profil', 'Important', 'fait'],
    ['PRO-02', 'Choisir mon avatar', 'Important', 'cours'],
    ['PRO-03', 'Voir mes statistiques de jeu', 'Important', 'afaire'],
    ['PRO-04', 'Gagner des badges', 'Bonus', 'afaire'],
    ['PRO-05', "Suivre mon parcours d'accueil", 'Indispensable', 'fait'],
    ['PRO-06', "Choisir la langue de l'application", 'Important', 'cours'],
    ['PRO-07', 'Voir mes succès', 'Plus tard', 'afaire'],
    ['PRO-08', 'Présenter mes jeux joués et mon activité récente', 'Important', 'afaire'],
    ['ACT-01', "Suivre l'activité de mes amis", 'Bonus', 'afaire'],
    ['ACT-02', "Lire les actualités des jeux qui m'intéressent", 'Bonus', 'afaire'],
    ['ACT-03', 'Suivre un studio et lire ses actualités', 'Bonus', 'afaire'],
    ['ADM-01', 'Enrichir le catalogue de jeux', 'Important', 'cours']
  ];

  var STATE = {
    fait: { cls: 'stitch--done', label: 'Fait' },
    cours: { cls: 'stitch--wip', label: 'En cours' },
    afaire: { cls: 'stitch--todo', label: 'À faire' }
  };
  var ORDER = { fait: 0, cours: 1, afaire: 2 };

  var STEPS = ["S'inscrire", 'Importer Steam', 'Ranger sa collection', 'Suivre les sorties', 'Prochaine quête'];

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function storiesOf(code) {
    return STORIES.filter(function (s) { return s[0].indexOf(code) === 0; });
  }

  // Carte des épics : une ligne par épic, un point de couture par story.
  function renderEpics() {
    var root = document.getElementById('epics');
    EPICS.forEach(function (epic) {
      var list = storiesOf(epic[0]).slice().sort(function (a, b) { return ORDER[a[3]] - ORDER[b[3]]; });
      var count = { fait: 0, cours: 0, afaire: 0 };
      var row = el('div', 'epic');
      row.appendChild(el('span', 'epic-code', epic[0]));
      row.appendChild(el('span', 'epic-name', epic[1]));
      var stitches = el('span', 'epic-stitches');
      list.forEach(function (s) {
        count[s[3]] += 1;
        var st = el('span', 'stitch ' + STATE[s[3]].cls);
        st.title = s[0] + ' : ' + s[1] + ' (' + STATE[s[3]].label + ')';
        stitches.appendChild(st);
      });
      stitches.setAttribute('role', 'img');
      stitches.setAttribute('aria-label', count.fait + ' faites, ' + count.cours + ' en cours, ' + count.afaire + ' à faire');
      row.appendChild(stitches);
      row.appendChild(el('span', 'epic-count', count.fait + ' sur ' + list.length));
      root.appendChild(row);
    });
  }

  // Annexe : le backlog complet, découpé en deux diapositives.
  function renderAnnex(id, columns) {
    var root = document.getElementById(id);
    columns.forEach(function (codes) {
      var col = el('div', 'annex-col');
      codes.forEach(function (code) { col.appendChild(annexGroup(code)); });
      root.appendChild(col);
    });
  }

  function annexGroup(code) {
    var epic = EPICS.filter(function (e) { return e[0] === code; })[0];
    var group = el('section', 'annex-group');
    group.appendChild(el('h3', '', epic[1]));
    var ul = el('ul');
    storiesOf(code).forEach(function (s) {
      var li = el('li');
      var st = el('span', 'stitch ' + STATE[s[3]].cls);
      st.setAttribute('role', 'img');
      st.setAttribute('aria-label', STATE[s[3]].label);
      li.appendChild(st);
      li.appendChild(el('span', 'annex-id', s[0]));
      li.appendChild(el('span', 'annex-title', s[1]));
      li.appendChild(el('span', 'annex-prio', s[2]));
      ul.appendChild(li);
    });
    group.appendChild(ul);
    return group;
  }

  // Le fil du parcours, en bas des cinq diapositives d'étape.
  function renderThreads() {
    document.querySelectorAll('.slide--step').forEach(function (slide) {
      var current = Number(slide.getAttribute('data-step'));
      var ol = el('ol', 'thread');
      ol.setAttribute('aria-label', 'Étapes du parcours');
      STEPS.forEach(function (name, i) {
        var li = el('li', i + 1 < current ? 'is-past' : i + 1 === current ? 'is-current' : '');
        if (i + 1 === current) li.setAttribute('aria-current', 'step');
        li.appendChild(el('span', 'knot', String(i + 1)));
        li.appendChild(el('span', 'knot-label', name));
        ol.appendChild(li);
      });
      slide.appendChild(ol);
    });
  }

  // Une capture absente laisse un cadre qui dit quel écran est attendu, plutôt qu'une image cassée.
  function watchShots() {
    document.querySelectorAll('.shot img').forEach(function (img) {
      function missing() { img.closest('.shot').classList.add('is-missing'); }
      img.addEventListener('error', missing);
      if (img.complete && img.naturalWidth === 0) missing();
    });
  }

  renderEpics();
  renderAnnex('annex-1', [['CPT', 'EXT'], ['COL', 'STA', 'TIM']]);
  renderAnnex('annex-2', [['ALE', 'REC', 'SOC'], ['PRO', 'ACT', 'ADM']]);
  renderThreads();
  watchShots();

  // ── Navigation ──
  var stage = document.getElementById('stage');
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var currentEl = document.getElementById('current');
  var speakerEl = document.getElementById('speaker');
  var index = 0;

  document.getElementById('total').textContent = String(slides.length);

  function show(i) {
    index = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach(function (s, n) { s.classList.toggle('is-active', n === index); });
    currentEl.textContent = String(index + 1);
    // qui parle sur cette diapositive : discret, pour nous, pas pour la salle
    speakerEl.textContent = slides[index].getAttribute('data-speaker') || '';
    if (location.hash !== '#' + (index + 1)) history.replaceState(null, '', '#' + (index + 1));
  }

  // La scène fait 1920 x 1080 et se met à l'échelle de la fenêtre : rien ne déborde, quel que soit l'écran.
  function fit() {
    var scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    stage.style.setProperty('--scale', String(scale));
  }

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key) {
      case 'ArrowRight': case 'PageDown': case ' ': e.preventDefault(); show(index + 1); break;
      case 'ArrowLeft': case 'PageUp': e.preventDefault(); show(index - 1); break;
      case 'Home': e.preventDefault(); show(0); break;
      case 'End': e.preventDefault(); show(slides.length - 1); break;
      case 'f': case 'F':
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
        break;
      default:
    }
  });

  document.getElementById('prev').addEventListener('click', function () { show(index - 1); });
  document.getElementById('next').addEventListener('click', function () { show(index + 1); });
  window.addEventListener('resize', fit);
  window.addEventListener('hashchange', function () {
    var n = parseInt(location.hash.slice(1), 10);
    if (n && n - 1 !== index) show(n - 1);
  });

  fit();
  show((parseInt(location.hash.slice(1), 10) || 1) - 1);
})();
