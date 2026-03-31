const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
        Header, Footer, PageNumber, LevelFormat } = require('docx');
const fs = require('fs');

const tableBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const cellBorders = { top: tableBorder, bottom: tableBorder, left: tableBorder, right: tableBorder };

const createTable = (headers, rows) => {
  const colWidth = Math.floor(9360 / headers.length);
  return new Table({
    columnWidths: headers.map(() => colWidth),
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map(h => new TableCell({
          borders: cellBorders,
          width: { size: colWidth, type: WidthType.DXA },
          shading: { fill: "0065FF", type: ShadingType.CLEAR },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: h, bold: true, color: "FFFFFF", size: 22 })]
          })]
        }))
      }),
      ...rows.map(row => new TableRow({
        children: row.map(cell => new TableCell({
          borders: cellBorders,
          width: { size: colWidth, type: WidthType.DXA },
          children: [new Paragraph({ children: [new TextRun({ text: cell, size: 22 })] })]
        }))
      }))
    ]
  });
};

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 24 } } },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal",
        run: { size: 56, bold: true, color: "0065FF", font: "Arial" },
        paragraph: { spacing: { before: 0, after: 240 }, alignment: AlignmentType.CENTER } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, color: "FF5D00", font: "Arial" },
        paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, color: "0065FF", font: "Arial" },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
    ]
  },
  numbering: {
    config: [
      { reference: "bullet-list",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }
    ]
  },
  sections: [{
    properties: {
      page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } }
    },
    headers: {
      default: new Header({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: "NextQuest.io - Justification des choix BDD", italics: true, size: 20, color: "666666" })]
      })] })
    },
    footers: {
      default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Page ", size: 20 }), new TextRun({ children: [PageNumber.CURRENT], size: 20 }), new TextRun({ text: " / ", size: 20 }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 20 })]
      })] })
    },
    children: [
      // Titre
      new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun("Justification des Choix de Conception")] }),
      new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: "Base de Donnees NextQuest.io", size: 40 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 480 }, children: [
        new TextRun({ text: "Jean-Baptiste Renart - Janvier 2026", italics: true, color: "666666" })
      ]}),

      // Introduction
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("1. Introduction")] }),
      new Paragraph({ spacing: { after: 200 }, children: [
        new TextRun("Ce document presente les choix de conception de la base de donnees pour NextQuest.io, une application de gestion de ludotheque videoludique. Chaque decision a ete prise en considerant les bonnes pratiques du secteur, la scalabilite, et les besoins specifiques du projet.")
      ]}),

      // Choix du SGBD
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("2. Choix du SGBD : PostgreSQL via Supabase")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Justification")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("PostgreSQL est une base relationnelle robuste et performante, ideale pour les donnees structurees")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Support natif du JSON (JSONB) pour les donnees flexibles comme les metadonnees de notifications")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Supabase offre l'authentification, le Realtime, et le stockage integres")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Row Level Security (RLS) pour la securite des donnees au niveau de la base")] }),
      new Paragraph({ spacing: { after: 200 }, numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Open source et gratuit pour commencer")] }),

      // Gestion des jeux
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("3. Gestion des Donnees de Jeux")] }),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Strategie : Cache local + Refresh intelligent")] }),
      new Paragraph({ spacing: { after: 120 }, children: [new TextRun("Plutot que d'appeler les APIs externes (IGDB, RAWG) a chaque requete, nous stockons une copie locale des metadonnees dans notre table 'games'.") ]}),
      createTable(
        ["Approche", "Avantages", "Inconvenients"],
        [
          ["Cache seul", "Simple, rapide", "Donnees obsoletes"],
          ["Appels directs", "Toujours a jour", "Latence, quotas API, dependance"],
          ["Hybride (choisi)", "Rapidite + donnees fraiches", "Complexite moderee"]
        ]
      ),
      new Paragraph({ spacing: { before: 200, after: 200 }, children: [
        new TextRun({ text: "Refresh intelligent : ", bold: true }),
        new TextRun("Les jeux sont rafraichis selon leur statut. Un jeu 'upcoming' est mis a jour quotidiennement (les dates changent souvent), tandis qu'un jeu sorti depuis plus d'un an est rafraichi mensuellement.")
      ]}),

      // Plateformes vs Services
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("4. Separation Plateformes / Services")] }),
      new Paragraph({ spacing: { after: 120 }, children: [new TextRun("Une distinction importante a ete faite entre les plateformes (hardware) et les services (stores/launchers).") ]}),
      createTable(
        ["Concept", "Exemples", "Role"],
        [
          ["Plateforme", "PC, PS5, Xbox, Switch", "Le hardware ou on joue"],
          ["Service", "Steam, Epic, PSN, Xbox Live", "D'ou vient le jeu, ou sont les achievements"]
        ]
      ),
      new Paragraph({ spacing: { before: 200 }, heading: HeadingLevel.HEADING_2, children: [new TextRun("Justification")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Un meme jeu PC peut etre possede sur Steam ET Epic (deux achats, une plateforme)")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Xbox Live donne acces a Xbox ET PC (via Game Pass)")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Permet des statistiques precises : '60% de jeu sur PC' vs '60% sur Steam'")] }),
      new Paragraph({ spacing: { after: 200 }, numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Architecture flexible pour les evolutions futures")] }),

      // Relations sociales
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("5. Systeme Social : Relations Directionnelles")] }),
      new Paragraph({ spacing: { after: 120 }, children: [new TextRun("Pour la gestion des amis, j'ai opte pour une relation directionnelle plutot que symetrique.") ]}),
      createTable(
        ["Approche", "Description", "Choix"],
        [
          ["Symetrique", "1 ligne par amitie : (A,B)", "Non retenu"],
          ["Directionnelle", "2 lignes par amitie : (A,B) + (B,A)", "Retenu"]
        ]
      ),
      new Paragraph({ spacing: { before: 200 }, heading: HeadingLevel.HEADING_2, children: [new TextRun("Justification")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Requetes simplifiees : SELECT * FROM friendships WHERE user_id = X")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Permet d'evoluer vers un systeme de follow (comme Steam) sans refactoring")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Le blocage est unidirectionnel par nature")] }),
      new Paragraph({ spacing: { after: 200 }, numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("RLS Supabase plus simple a implementer")] }),

      // Messagerie
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("6. Messagerie : Systeme de Conversations")] }),
      new Paragraph({ spacing: { after: 120 }, children: [new TextRun("Plutot que des messages directs simples (sender_id, receiver_id, content), j'ai opte pour un systeme de conversations.") ]}),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Structure")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Table 'conversations' : contient les metadonnees (type, date de creation)")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Table 'conversation_members' : lie les utilisateurs aux conversations avec last_read_at")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Table 'messages' : les messages avec reference a la conversation")] }),
      new Paragraph({ spacing: { before: 200 }, heading: HeadingLevel.HEADING_2, children: [new TextRun("Justification")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("'X messages non lus' = simple a calculer avec last_read_at")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Supabase Realtime peut s'abonner a une conversation specifique")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Architecture prete pour les groupes de discussion futurs")] }),
      new Paragraph({ spacing: { after: 200 }, numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Pagination de l'historique par conversation")] }),

      // Notifications
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("7. Notifications : Retention 90 jours")] }),
      new Paragraph({ spacing: { after: 120 }, children: [new TextRun("Les notifications lues sont conservees 90 jours, les non-lues indefiniment.") ]}),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Benchmark du marche")] }),
      createTable(
        ["Plateforme", "Retention"],
        [
          ["Steam", "3-6 mois"],
          ["Discord", "~60 jours"],
          ["PlayStation/Xbox", "30-60 jours"],
          ["Standard apps mobiles", "30-90 jours"]
        ]
      ),
      new Paragraph({ spacing: { before: 200, after: 200 }, children: [
        new TextRun({ text: "Justification : ", bold: true }),
        new TextRun("90 jours est le consensus du marche. Cela evite une table qui explose tout en couvrant largement les besoins utilisateurs. Un cron job supprime les notifications lues de plus de 90 jours.")
      ]}),

      // Wishlist
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("8. Wishlist : Statut unifie dans user_games")] }),
      new Paragraph({ spacing: { after: 120 }, children: [new TextRun("La wishlist n'est pas une table separee mais un statut dans la table user_games.") ]}),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Statuts disponibles")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("wishlist : Jeu souhaite, pas encore achete")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("backlog : Jeu possede, pas encore commence")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("playing : En cours de jeu")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("completed : Jeu termine")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("abandoned : Jeu abandonne")] }),
      new Paragraph({ spacing: { before: 200 }, heading: HeadingLevel.HEADING_2, children: [new TextRun("Justification")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Transition naturelle : wishlist -> backlog -> playing -> completed")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Une seule table a interroger pour 'tous mes jeux'")] }),
      new Paragraph({ spacing: { after: 200 }, numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("C'est l'approche utilisee par Steam")] }),

      // Recommandations IA
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("9. Recommandations IA : Notes + Tags + Feedback")] }),
      new Paragraph({ spacing: { after: 120 }, children: [new TextRun("Le systeme de recommandations s'appuie sur trois types de donnees utilisateur.") ]}),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Structure des donnees")] }),
      createTable(
        ["Donnee", "Table", "Usage IA"],
        [
          ["Note 1-10", "user_games.rating", "Preferences quantitatives"],
          ["Tags", "user_game_tags", "Preferences qualitatives (relaxant, difficile...)"],
          ["Feedback", "recommendations.feedback", "Apprentissage continu"]
        ]
      ),
      new Paragraph({ spacing: { before: 200, after: 200 }, children: [
        new TextRun({ text: "Justification : ", bold: true }),
        new TextRun("Les tags alimentent mieux l'IA qu'une simple note. 'Tu aimes les jeux relaxants' est plus actionnable que 'Tu notes en moyenne 7/10'. Le feedback permet d'ameliorer les suggestions au fil du temps.")
      ]}),

      // Badges
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("10. Badges : Separation interne/externe")] }),
      new Paragraph({ spacing: { after: 120 }, children: [new TextRun("Les badges NextQuest (gamification interne) sont separes des achievements externes (trophees PSN, succes Steam).") ]}),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Justification")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Badges NextQuest : controles par nous, recompensent l'utilisation de l'app")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Achievements externes : donnees en lecture seule, importees des APIs")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Requetes differentes : 'mes badges NextQuest' vs 'mes trophees Elden Ring'")] }),
      new Paragraph({ spacing: { after: 200 }, numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Pas de confusion entre les deux systemes pour l'utilisateur")] }),

      // Feed
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("11. Fil d'Actualite : Fan-out on Read")] }),
      new Paragraph({ spacing: { after: 120 }, children: [new TextRun("Pour le feed social, j'ai choisi l'approche 'fan-out on read' avec une table activities centrale.") ]}),
      createTable(
        ["Approche", "Principe", "Adapte pour"],
        [
          ["Fan-out on write", "Ecrire dans le feed de chaque ami", "Twitter (millions de followers)"],
          ["Fan-out on read", "Construire le feed a la lecture", "Apps avec ~100-200 amis max"]
        ]
      ),
      new Paragraph({ spacing: { before: 200, after: 200 }, children: [
        new TextRun({ text: "Justification : ", bold: true }),
        new TextRun("Avec ~100-200 amis max par utilisateur, une requete JOIN sur les activites des amis reste triviale pour PostgreSQL. Fan-out on write serait du gaspillage de ressources. C'est l'approche utilisee par Backloggd, Letterboxd, et Goodreads.")
      ]}),

      // Jeux custom
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("12. Jeux Custom : Flag dans la table games")] }),
      new Paragraph({ spacing: { after: 120 }, children: [new TextRun("Les jeux ajoutes manuellement par les utilisateurs sont dans la meme table 'games' avec un flag is_custom.") ]}),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Justification")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Meme structure, memes requetes que les jeux officiels")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Le jeu peut etre dans user_games normalement")] }),
      new Paragraph({ numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Possibilite future : partager/valider des jeux custom par la communaute")] }),
      new Paragraph({ spacing: { after: 200 }, numbering: { reference: "bullet-list", level: 0 }, children: [new TextRun("Evite la duplication de logique entre deux tables")] }),

      // Conclusion
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("13. Conclusion")] }),
      new Paragraph({ spacing: { after: 200 }, children: [
        new TextRun("Ces choix de conception ont ete guides par les bonnes pratiques du secteur, l'analyse des concurrents (Steam, Backloggd, Letterboxd), et les besoins specifiques de NextQuest. L'architecture est concue pour etre evolutive tout en restant simple a maintenir pour une equipe de deux developpeurs.")
      ]}),
      new Paragraph({ children: [
        new TextRun("Le schema complet est disponible dans le fichier "),
        new TextRun({ text: "docs/database/schema.dbml", bold: true }),
        new TextRun(" au format DBML, importable sur dbdiagram.io pour visualisation.")
      ]}),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("/Users/jayb/Desktop/NextQuest/docs/database/Justification_Choix_BDD_NextQuest.docx", buffer);
  console.log("Document cree : Justification_Choix_BDD_NextQuest.docx");
});
