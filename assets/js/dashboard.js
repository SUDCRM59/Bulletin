const firebaseConfig = {
  apiKey: "AIzaSyAmu14nCF6x0cblWBFmP44uHJ3tI1McDSA",
  authDomain: "sudcrm59.firebaseapp.com",
  projectId: "sudcrm59",
  storageBucket: "sudcrm59.firebasestorage.app",
  messagingSenderId: "487748398932",
  appId: "1:487748398932:web:679ff7f5fcd8b1d6d762c1"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

let cardsData = [];
let selectedCardId = null;
let shortTextQuill = null;
let longTextQuill = null;
let archiveList = [];
let currentArchiveId = null;

const DOM = {};

document.addEventListener("DOMContentLoaded", () => {
  bindDom();
  initEditors();
  bindEvents();
  initAuthObserver();
  renderBoard();
});

function bindDom() {
  DOM.bulletinPeriod = document.getElementById("bulletinPeriod");
  DOM.bentoBoard = document.getElementById("bentoBoard");
  DOM.addCardBtn = document.getElementById("addCardBtn");
  DOM.addCardTile = document.getElementById("addCardTile");

  DOM.publishWebBtn = document.getElementById("publishWebBtn");
  DOM.publishEmailBtn = document.getElementById("publishEmailBtn");
  DOM.openArchivesBtn = document.getElementById("openArchivesBtn");
  DOM.logoutBtn = document.getElementById("logoutBtn");

  DOM.cardModal = document.getElementById("cardModal");
  DOM.closeModal = document.getElementById("closeModal");
  DOM.saveCardBtn = document.getElementById("saveCardBtn");
  DOM.deleteCardBtn = document.getElementById("deleteCardBtn");

  DOM.archiveModal = document.getElementById("archiveModal");
  DOM.archiveSelect = document.getElementById("archiveSelect");
  DOM.loadArchiveBtn = document.getElementById("loadArchiveBtn");

  DOM.cardTitle = document.getElementById("cardTitle");
  DOM.cardType = document.getElementById("cardType");
  DOM.cardIcon = document.getElementById("cardIcon");
  DOM.cardLink = document.getElementById("cardLink");
  DOM.cardImage = document.getElementById("cardImage");
  DOM.cardBgColor = document.getElementById("cardBgColor");
  DOM.cardColSpan = document.getElementById("cardColSpan");
  DOM.cardRowSpan = document.getElementById("cardRowSpan");
  DOM.cardEmailText = document.getElementById("cardEmailText");
}

function initEditors() {
  shortTextQuill = new Quill("#shortTextEditor", {
    theme: "snow",
    placeholder: "Texte court affiché dans la carte...",
    modules: {
      toolbar: [
        ["bold", "italic", "underline"],
        [{ list: "ordered" }, { list: "bullet" }],
        ["link"],
        ["clean"]
      ]
    }
  });

  longTextQuill = new Quill("#longTextEditor", {
    theme: "snow",
    placeholder: "Texte long / contenu détaillé...",
    modules: {
      toolbar: [
        ["bold", "italic", "underline"],
        [{ header: [2, 3, false] }],
        [{ list: "ordered" }, { list: "bullet" }],
        ["blockquote", "link"],
        ["clean"]
      ]
    }
  });
}

function bindEvents() {
  DOM.addCardBtn?.addEventListener("click", handleAddCard);
  DOM.addCardTile?.addEventListener("click", handleAddCard);

  DOM.closeModal?.addEventListener("click", () => closeModal(DOM.cardModal));
  DOM.saveCardBtn?.addEventListener("click", saveCurrentCard);
  DOM.deleteCardBtn?.addEventListener("click", deleteCurrentCard);

  DOM.openArchivesBtn?.addEventListener("click", async () => {
    await loadArchivesList();
    openModal(DOM.archiveModal);
  });

  DOM.loadArchiveBtn?.addEventListener("click", loadSelectedArchive);

  DOM.publishWebBtn?.addEventListener("click", publishWebBulletin);
  DOM.publishEmailBtn?.addEventListener("click", publishEmailBulletin);

  DOM.logoutBtn?.addEventListener("click", async () => {
    try {
      await auth.signOut();
      alert("Déconnecté.");
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la déconnexion.");
    }
  });

  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => {
      const modalId = button.getAttribute("data-close");
      const modal = document.getElementById(modalId);
      closeModal(modal);
    });
  });

  [DOM.cardModal, DOM.archiveModal].forEach((modal) => {
    modal?.addEventListener("click", (event) => {
      if (event.target === modal) {
        closeModal(modal);
      }
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeModal(DOM.cardModal);
      closeModal(DOM.archiveModal);
    }
  });
}

function initAuthObserver() {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      console.warn("Aucun utilisateur connecté.");
      return;
    }

    await loadLatestProject();
  });
}

function createEmptyCard() {
  return {
    id: generateId(),
    type: "news",
    title: "Nouvelle carte",
    icon: "📢",
    shortText: "",
    longText: "",
    emailText: "",
    link: "",
    image: "",
    bgColor: "#ffffff",
    colSpan: 1,
    rowSpan: 1
  };
}

function handleAddCard() {
  const newCard = createEmptyCard();
  cardsData.push(newCard);
  selectedCardId = newCard.id;
  renderBoard();
  fillModal(newCard);
  openModal(DOM.cardModal);
}

function renderBoard() {
  if (!DOM.bentoBoard) return;

  DOM.bentoBoard.querySelectorAll(".admin-card").forEach((card) => card.remove());

  cardsData.forEach((card) => {
    const cardElement = createCardElement(card);
    DOM.bentoBoard.appendChild(cardElement);
  });
}

function createCardElement(card) {
  const article = document.createElement("article");
  article.className = buildCardClassName(card);

  if (card.bgColor && !card.image) {
    article.style.background = card.bgColor;
  }

  if (card.image) {
    article.style.backgroundImage = `url("${escapeHtmlAttribute(card.image)}")`;
  }

  if (shouldUseLightText(card)) {
    article.classList.add("text-light");
  }

  article.dataset.id = card.id;

  const typeLabel = getTypeLabel(card.type);
  const shortTextPlain = stripHtml(card.shortText || "");
  const shortTextPreview = truncateText(shortTextPlain, 160);

  article.innerHTML = `
    <div class="admin-card-toolbar">
      <span class="admin-card-badge">${escapeHtml(typeLabel)}</span>
      <div class="admin-card-menu">
        <button class="admin-card-icon-btn js-edit-card" type="button" title="Modifier">✏️</button>
      </div>
    </div>

    <div class="admin-card-icon">${escapeHtml(card.icon || "📄")}</div>

    <h3 class="admin-card-title">${escapeHtml(card.title || "Sans titre")}</h3>

    <p class="admin-card-short">${escapeHtml(shortTextPreview || "Aucun texte court")}</p>

    <div class="admin-card-footer">
      <span class="admin-card-meta">${card.colSpan} col · ${card.rowSpan} ligne</span>
      ${card.link ? `<a class="admin-card-link" href="${escapeHtmlAttribute(card.link)}" target="_blank" rel="noopener noreferrer">Voir lien</a>` : `<span class="admin-card-link"></span>`}
    </div>
  `;

  article.addEventListener("click", (event) => {
    if (event.target.closest(".js-edit-card")) {
      event.stopPropagation();
    }
    openCardEditor(card.id);
  });

  const editButton = article.querySelector(".js-edit-card");
  editButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    openCardEditor(card.id);
  });

  return article;
}

function openCardEditor(cardId) {
  const card = cardsData.find((item) => item.id === cardId);
  if (!card) return;

  selectedCardId = cardId;
  fillModal(card);
  openModal(DOM.cardModal);
}

function fillModal(card) {
  DOM.cardTitle.value = card.title || "";
  DOM.cardType.value = card.type || "news";
  DOM.cardIcon.value = card.icon || "";
  DOM.cardLink.value = card.link || "";
  DOM.cardImage.value = card.image || "";
  DOM.cardBgColor.value = normalizeColor(card.bgColor || "#ffffff");
  DOM.cardColSpan.value = String(card.colSpan || 1);
  DOM.cardRowSpan.value = String(card.rowSpan || 1);
  DOM.cardEmailText.value = card.emailText || "";

  shortTextQuill.root.innerHTML = card.shortText || "";
  longTextQuill.root.innerHTML = card.longText || "";
}

function saveCurrentCard() {
  if (!selectedCardId) return;

  const cardIndex = cardsData.findIndex((item) => item.id === selectedCardId);
  if (cardIndex === -1) return;

  const updatedCard = {
    ...cardsData[cardIndex],
    title: DOM.cardTitle.value.trim(),
    type: DOM.cardType.value,
    icon: DOM.cardIcon.value.trim(),
    link: DOM.cardLink.value.trim(),
    image: DOM.cardImage.value.trim(),
    bgColor: DOM.cardBgColor.value,
    colSpan: clampSpan(Number(DOM.cardColSpan.value), 1, 4),
    rowSpan: clampSpan(Number(DOM.cardRowSpan.value), 1, 2),
    shortText: shortTextQuill.root.innerHTML,
    longText: longTextQuill.root.innerHTML,
    emailText: DOM.cardEmailText.value.trim()
  };

  cardsData[cardIndex] = updatedCard;
  renderBoard();
  closeModal(DOM.cardModal);
}

function deleteCurrentCard() {
  if (!selectedCardId) return;

  const card = cardsData.find((item) => item.id === selectedCardId);
  if (!card) return;

  const confirmDelete = window.confirm(`Supprimer la carte "${card.title || "Sans titre"}" ?`);
  if (!confirmDelete) return;

  cardsData = cardsData.filter((item) => item.id !== selectedCardId);
  selectedCardId = null;
  renderBoard();
  closeModal(DOM.cardModal);
}

function openModal(modal) {
  if (!modal) return;
  modal.classList.add("open");
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove("open");
}

async function loadLatestProject() {
  try {
    const snapshot = await db
      .collection("bulletin_archives")
      .orderBy("timestamp", "desc")
      .limit(1)
      .get();

    if (snapshot.empty) {
      cardsData = [];
      DOM.bulletinPeriod.value = "";
      renderBoard();
      return;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    currentArchiveId = doc.id;
    cardsData = Array.isArray(data.cards) ? data.cards : [];
    DOM.bulletinPeriod.value = data.period || "";

    renderBoard();
  } catch (error) {
    console.error("Erreur chargement dernier projet :", error);
    alert("Impossible de charger le dernier projet.");
  }
}

async function loadArchivesList() {
  try {
    const snapshot = await db
      .collection("bulletin_archives")
      .orderBy("timestamp", "desc")
      .get();

    archiveList = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    DOM.archiveSelect.innerHTML = "";

    if (archiveList.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Aucune archive disponible";
      DOM.archiveSelect.appendChild(option);
      return;
    }

    archiveList.forEach((archive) => {
      const option = document.createElement("option");
      option.value = archive.id;
      option.textContent = archive.period || archive.id;
      DOM.archiveSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Erreur chargement archives :", error);
    alert("Impossible de charger les archives.");
  }
}

async function loadSelectedArchive() {
  const archiveId = DOM.archiveSelect.value;
  if (!archiveId) return;

  try {
    const doc = await db.collection("bulletin_archives").doc(archiveId).get();

    if (!doc.exists) {
      alert("Archive introuvable.");
      return;
    }

    const data = doc.data();
    currentArchiveId = doc.id;
    cardsData = Array.isArray(data.cards) ? data.cards : [];
    DOM.bulletinPeriod.value = data.period || "";

    renderBoard();
    closeModal(DOM.archiveModal);
  } catch (error) {
    console.error("Erreur chargement archive :", error);
    alert("Impossible de charger cette archive.");
  }
}

async function publishWebBulletin() {
  try {
    const payload = buildPublishPayload();

    await db.collection("bulletin_archives").add({
      ...payload,
      publishedTo: "web",
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    await db.collection("bulletin_current").doc("live").set({
      ...payload,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert("Bulletin web publié.");
  } catch (error) {
    console.error("Erreur publication web :", error);
    alert("Erreur lors de la publication web.");
  }
}

async function publishEmailBulletin() {
  try {
    const payload = buildPublishPayload();
    const emailHtml = generateEmailHtml(payload);

    const docRef = await db.collection("email_archives").add({
      period: payload.period,
      cards: payload.cards,
      htmlContent: emailHtml,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert(`Email publié. ID : ${docRef.id}`);
  } catch (error) {
    console.error("Erreur publication email :", error);
    alert("Erreur lors de la publication email.");
  }
}

function buildPublishPayload() {
  return {
    period: DOM.bulletinPeriod.value.trim(),
    cards: cardsData.map((card) => ({
      ...card
    }))
  };
}

function generateEmailHtml(payload) {
  const cardsHtml = payload.cards
    .map((card) => {
      const title = escapeHtml(card.title || "");
      const icon = escapeHtml(card.icon || "📄");
      const emailText = escapeHtml(card.emailText || stripHtml(card.shortText || ""));
      const link = card.link
        ? `<p style="margin:12px 0 0;"><a href="${escapeHtmlAttribute(card.link)}" style="color:#ed1e79;text-decoration:none;font-weight:600;">Lire la suite</a></p>`
        : "";

      return `
        <tr>
          <td style="padding:0 0 18px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#ffffff;border-radius:18px;border:1px solid #e6eaf2;">
              <tr>
                <td style="padding:20px;font-family:Arial,sans-serif;color:#1e2430;">
                  <div style="font-size:24px;line-height:1;margin-bottom:10px;">${icon}</div>
                  <div style="font-size:20px;font-weight:700;margin-bottom:8px;">${title}</div>
                  <div style="font-size:14px;line-height:1.6;color:#475569;">${emailText}</div>
                  ${link}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${escapeHtml(payload.period || "Bulletin")}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#f4f6fb;">
    <tr>
      <td align="center" style="padding:30px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;max-width:700px;">
          <tr>
            <td style="background:#ed1e79;color:#ffffff;padding:28px 24px;border-radius:22px 22px 0 0;text-align:center;">
              <div style="font-size:28px;font-weight:700;">Frequence SUD</div>
              <div style="font-size:15px;margin-top:8px;opacity:.95;">${escapeHtml(payload.period || "")}</div>
            </td>
          </tr>
          <tr>
            <td style="background:#ffffff;padding:24px 20px 10px;border-left:1px solid #e6eaf2;border-right:1px solid #e6eaf2;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                ${cardsHtml}
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#ed1e79;color:#ffffff;padding:18px 24px;border-radius:0 0 22px 22px;text-align:center;font-size:13px;">
              Bulletin généré automatiquement
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function getTypeLabel(type) {
  const labels = {
    news: "Actu",
    event: "Événement",
    info: "Info",
    link: "Lien",
    app: "Application",
    custom: "Personnalisée"
  };

  return labels[type] || "Carte";
}

function buildCardClassName(card) {
  const classes = [
    "admin-card",
    `col-span-${clampSpan(Number(card.colSpan), 1, 4)}`,
    `row-span-${clampSpan(Number(card.rowSpan), 1, 2)}`
  ];

  if (card.image) {
    classes.push("has-image");
  }

  return classes.join(" ");
}

function shouldUseLightText(card) {
  if (card.image) return true;
  return isDarkColor(card.bgColor || "#ffffff");
}

function generateId() {
  return `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function clampSpan(value, min, max) {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function normalizeColor(value) {
  if (!value || typeof value !== "string") return "#ffffff";
  if (/^#[0-9A-Fa-f]{6}$/.test(value)) return value;
  return "#ffffff";
}

function stripHtml(html) {
  const div = document.createElement("div");
  div.innerHTML = html || "";
  return (div.textContent || div.innerText || "").trim();
}

function truncateText(text, maxLength) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}…`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeHtmlAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function isDarkColor(hexColor) {
  if (!hexColor || !/^#[0-9A-Fa-f]{6}$/.test(hexColor)) return false;

  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);

  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 150;
}
