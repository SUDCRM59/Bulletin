const firebaseConfig = {
  apiKey: "AIzaSyAmu14nCF6x0cblWBFmP44uHJ3tI1McDSA",
  authDomain: "sudcrm59.firebaseapp.com",
  projectId: "sudcrm59",
  storageBucket: "sudcrm59.firebasestorage.app",
  messagingSenderId: "487748398932",
  appId: "1:487748398932:web:679ff7f5fcd8b1d6d762c1"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

const DRAFT_COLLECTION = "bulletin_v3_drafts";
const PUBLIC_COLLECTION = "bulletin_v3_public";
const EMAIL_COLLECTION = "bulletin_v3_emails";
const DEFAULT_DRAFT_ID = "draft_live";

const DEFAULT_GRID = {
  columns: 4,
  rowHeight: 180,
  gap: 16
};

let cardsData = [];
let selectedCardId = null;
let currentDraftId = DEFAULT_DRAFT_ID;
let archiveList = [];
let shortTextQuill = null;
let longTextQuill = null;
let toastTimer = null;

let dragState = {
  active: false,
  cardId: null,
  startX: 0,
  startY: 0,
  offsetX: 0,
  offsetY: 0,
  originX: 1,
  originY: 1
};
let resizeState = {
  active: false,
  cardId: null,
  startX: 0,
  startY: 0,
  originW: 1,
  originH: 1,
  x: 1,
  y: 1
};
const DOM = {};

document.addEventListener("DOMContentLoaded", async () => {
  bindDom();
  initEditors();
  bindEvents();
  applyBoardSettings(DEFAULT_GRID);
  initAuthObserver();
  renderBoard();
});

function bindDom() {
  DOM.bulletinPeriod = document.getElementById("bulletinPeriod");
  DOM.bulletinTitle = document.getElementById("bulletinTitle");

  DOM.gridColumns = document.getElementById("gridColumns");
  DOM.gridRowHeight = document.getElementById("gridRowHeight");
  DOM.gridGap = document.getElementById("gridGap");

  DOM.addCardBtn = document.getElementById("addCardBtn");
  DOM.saveDraftBtn = document.getElementById("saveDraftBtn");
  DOM.publishWebBtn = document.getElementById("publishWebBtn");
  DOM.publishEmailBtn = document.getElementById("publishEmailBtn");
  DOM.openArchivesBtn = document.getElementById("openArchivesBtn");
  DOM.logoutBtn = document.getElementById("logoutBtn");

  DOM.toggleGridBtn = document.getElementById("toggleGridBtn");
  DOM.fitBoardBtn = document.getElementById("fitBoardBtn");

  DOM.boardCanvas = document.getElementById("boardCanvas");
  DOM.boardGrid = document.getElementById("boardGrid");
  DOM.cardsLayer = document.getElementById("cardsLayer");

  DOM.selectedCardInfo = document.getElementById("selectedCardInfo");
  DOM.quickCardActions = document.getElementById("quickCardActions");
  DOM.editSelectedCardBtn = document.getElementById("editSelectedCardBtn");
  DOM.duplicateSelectedCardBtn = document.getElementById("duplicateSelectedCardBtn");
  DOM.deleteSelectedCardBtn = document.getElementById("deleteSelectedCardBtn");

  DOM.cardModal = document.getElementById("cardModal");
  DOM.closeModal = document.getElementById("closeModal");
  DOM.saveCardBtn = document.getElementById("saveCardBtn");
  DOM.deleteCardBtn = document.getElementById("deleteCardBtn");
  DOM.duplicateCardBtn = document.getElementById("duplicateCardBtn");

  DOM.archiveModal = document.getElementById("archiveModal");
  DOM.archiveSelect = document.getElementById("archiveSelect");
  DOM.loadArchiveBtn = document.getElementById("loadArchiveBtn");

  DOM.cardTitle = document.getElementById("cardTitle");
  DOM.cardType = document.getElementById("cardType");
  DOM.cardIcon = document.getElementById("cardIcon");
  DOM.cardLink = document.getElementById("cardLink");
  DOM.cardImage = document.getElementById("cardImage");
  DOM.cardBgColor = document.getElementById("cardBgColor");
  DOM.cardTextColorMode = document.getElementById("cardTextColorMode");
  DOM.cardEmailText = document.getElementById("cardEmailText");
  DOM.cardX = document.getElementById("cardX");
  DOM.cardY = document.getElementById("cardY");
  DOM.cardW = document.getElementById("cardW");
  DOM.cardH = document.getElementById("cardH");

  DOM.toast = document.getElementById("toast");
  DOM.toastText = document.getElementById("toastText");
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
  DOM.saveDraftBtn?.addEventListener("click", async () => {
    try {
      await saveDraftToFirestore();
      showToast("Brouillon enregistré");
    } catch (error) {
      console.error(error);
      alert("Impossible d'enregistrer le brouillon.");
    }
  });

  DOM.publishWebBtn?.addEventListener("click", publishWebBulletin);
  DOM.publishEmailBtn?.addEventListener("click", publishEmailBulletin);
  DOM.openArchivesBtn?.addEventListener("click", openArchivesModal);

  DOM.logoutBtn?.addEventListener("click", async () => {
    try {
      await auth.signOut();
      showToast("Déconnecté");
    } catch (error) {
      console.error(error);
      alert("Erreur lors de la déconnexion.");
    }
  });

  DOM.toggleGridBtn?.addEventListener("click", () => {
    DOM.boardCanvas.classList.toggle("show-grid");
  });

  DOM.fitBoardBtn?.addEventListener("click", () => {
    DOM.boardCanvas?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  DOM.gridColumns?.addEventListener("change", handleBoardSettingsChange);
  DOM.gridRowHeight?.addEventListener("change", handleBoardSettingsChange);
  DOM.gridGap?.addEventListener("change", handleBoardSettingsChange);

  DOM.bulletinPeriod?.addEventListener("change", saveDraftMeta);
  DOM.bulletinPeriod?.addEventListener("blur", saveDraftMeta);
  DOM.bulletinTitle?.addEventListener("change", saveDraftMeta);
  DOM.bulletinTitle?.addEventListener("blur", saveDraftMeta);

  DOM.editSelectedCardBtn?.addEventListener("click", () => {
    if (selectedCardId) openCardEditor(selectedCardId);
  });

  DOM.duplicateSelectedCardBtn?.addEventListener("click", async () => {
    if (selectedCardId) await duplicateCard(selectedCardId);
  });

  DOM.deleteSelectedCardBtn?.addEventListener("click", async () => {
    if (selectedCardId) await deleteCardById(selectedCardId);
  });

  DOM.closeModal?.addEventListener("click", () => closeModal(DOM.cardModal));
  DOM.saveCardBtn?.addEventListener("click", saveCurrentCard);
  DOM.deleteCardBtn?.addEventListener("click", async () => {
    if (selectedCardId) await deleteCardById(selectedCardId, true);
  });
  DOM.duplicateCardBtn?.addEventListener("click", async () => {
    if (selectedCardId) await duplicateCard(selectedCardId, true);
  });

  DOM.loadArchiveBtn?.addEventListener("click", loadSelectedPublishedArchive);

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

 document.addEventListener("pointermove", (event) => {
  handlePointerMove(event);
  handleResizeMove(event);
});

document.addEventListener("pointerup", async (event) => {
  await handlePointerUp(event);
  await handleResizeEnd(event);
});
}

function initAuthObserver() {
  auth.onAuthStateChanged(async (user) => {
    console.log("Utilisateur Firebase :", user ? user.email : "non connecté");
    await loadLatestDraft();
  });
}

/* =========================
   BOARD SETTINGS
========================= */

function getBoardSettings() {
  return {
    columns: clampNumber(Number(DOM.gridColumns?.value || DEFAULT_GRID.columns), 4, 6),
    rowHeight: clampNumber(Number(DOM.gridRowHeight?.value || DEFAULT_GRID.rowHeight), 120, 260),
    gap: clampNumber(Number(DOM.gridGap?.value || DEFAULT_GRID.gap), 8, 32)
  };
}

function applyBoardSettings(settings) {
  if (!DOM.boardCanvas) return;

  DOM.boardCanvas.style.setProperty("--board-columns", settings.columns);
  DOM.boardCanvas.style.setProperty("--board-row-height", `${settings.rowHeight}px`);
  DOM.boardCanvas.style.setProperty("--board-gap", `${settings.gap}px`);

  if (DOM.gridColumns) DOM.gridColumns.value = String(settings.columns);
  if (DOM.gridRowHeight) DOM.gridRowHeight.value = String(settings.rowHeight);
  if (DOM.gridGap) DOM.gridGap.value = String(settings.gap);
}

async function handleBoardSettingsChange() {
  applyBoardSettings(getBoardSettings());
  renderBoard();

  try {
    await saveDraftToFirestore();
    showToast("Grille mise à jour");
  } catch (error) {
    console.error(error);
  }
}

/* =========================
   DATA MODEL
========================= */

function createEmptyCard() {
  const settings = getBoardSettings();
  const position = findFirstAvailablePosition(1, 1, settings.columns);

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
    textColorMode: "auto",
    x: position.x,
    y: position.y,
    w: 1,
    h: 1
  };
}

function getCardById(cardId) {
  return cardsData.find((item) => item.id === cardId);
}

function getCardIndexById(cardId) {
  return cardsData.findIndex((item) => item.id === cardId);
}

function getMaxRows() {
  if (!cardsData.length) return 8;
  return Math.max(
    8,
    ...cardsData.map((card) => Number(card.y || 1) + Number(card.h || 1) - 1)
  );
}
async function handleAddCard() {
  const newCard = createEmptyCard();
  cardsData.push(newCard);
  selectedCardId = newCard.id;

  try {
    await saveDraftToFirestore();
    renderBoard();
    updateSelectedCardPanel();
    openCardEditor(newCard.id);
    showToast("Nouvelle carte ajoutée");
  } catch (error) {
    console.error("Erreur ajout carte :", error);
    alert("Impossible d'ajouter la carte.");
  }
}
/* =========================
   RENDER
========================= */

function renderBoard() {
  renderGridBackground();
  renderCards();
  updateSelectedCardPanel();
}

function renderGridBackground() {
  if (!DOM.boardGrid) return;

  const settings = getBoardSettings();
  const rows = getMaxRows() + 2;

  DOM.boardGrid.innerHTML = "";

  for (let i = 0; i < settings.columns * rows; i += 1) {
    const cell = document.createElement("div");
    cell.className = "grid-cell";
    DOM.boardGrid.appendChild(cell);
  }

  if (DOM.cardsLayer) {
    DOM.cardsLayer.style.gridTemplateColumns = `repeat(${settings.columns}, minmax(0, 1fr))`;
    DOM.cardsLayer.style.gridAutoRows = `${settings.rowHeight}px`;
    DOM.cardsLayer.style.gap = `${settings.gap}px`;
  }

  DOM.boardGrid.style.gridTemplateColumns = `repeat(${settings.columns}, minmax(0, 1fr))`;
  DOM.boardGrid.style.gridAutoRows = `${settings.rowHeight}px`;
  DOM.boardGrid.style.gap = `${settings.gap}px`;
}

function renderCards() {
  if (!DOM.cardsLayer) return;

  DOM.cardsLayer.innerHTML = "";

  cardsData.forEach((card) => {
    const cardElement = createCardElement(card);
    DOM.cardsLayer.appendChild(cardElement);
  });
}

function createCardElement(card) {
  const article = document.createElement("article");
  article.className = "v3-card";
  article.dataset.id = card.id;
  article.style.gridColumn = `${card.x} / span ${card.w}`;
  article.style.gridRow = `${card.y} / span ${card.h}`;

  if (card.image) {
    article.classList.add("has-image");
    article.style.backgroundImage = `url("${escapeHtmlAttribute(card.image)}")`;
  } else {
    article.style.background = normalizeColor(card.bgColor || "#ffffff");
  }

  if (shouldUseLightText(card)) {
    article.classList.add("text-light");
  }

  if (selectedCardId === card.id) {
    article.classList.add("selected");
  }

  const shortTextPlain = stripHtml(card.shortText || "");
  const shortTextPreview = truncateText(shortTextPlain, 180);

  article.innerHTML = `
    <div class="v3-card-toolbar">
      <span class="v3-card-badge">${escapeHtml(getTypeLabel(card.type))}</span>
      <div class="v3-card-menu">
        <button class="v3-card-icon-btn drag-handle" type="button" title="Déplacer">⋮⋮</button>
        <button class="v3-card-icon-btn js-duplicate-card" type="button" title="Dupliquer">⧉</button>
        <button class="v3-card-icon-btn js-edit-card" type="button" title="Modifier">✏️</button>
      </div>
    </div>

    <div class="v3-card-body">
      <div class="v3-card-icon">${escapeHtml(card.icon || "📄")}</div>
      <h3 class="v3-card-title">${escapeHtml(card.title || "Sans titre")}</h3>
      <p class="v3-card-short">${escapeHtml(shortTextPreview || "Aucun texte court")}</p>

      <div class="v3-card-footer">
        <span class="v3-card-meta">x:${card.x} y:${card.y} · ${card.w}×${card.h}</span>
        ${card.link ? `<a class="v3-card-link" href="${escapeHtmlAttribute(card.link)}" target="_blank" rel="noopener noreferrer">Voir</a>` : `<span class="v3-card-link"></span>`}
      </div>
    </div>

    <button class="resize-handle" type="button" title="Redimensionner">↘</button>
  `;

  const editButton = article.querySelector(".js-edit-card");
  const duplicateButton = article.querySelector(".js-duplicate-card");
  const dragHandle = article.querySelector(".drag-handle");
  const resizeHandle = article.querySelector(".resize-handle");

  article.addEventListener("click", (event) => {
    if (
      event.target.closest(".js-edit-card") ||
      event.target.closest(".js-duplicate-card") ||
      event.target.closest(".drag-handle") ||
      event.target.closest(".resize-handle")
    ) {
      return;
    }

    selectCard(card.id);
  });

  editButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    selectCard(card.id);
    openCardEditor(card.id);
  });

  duplicateButton?.addEventListener("click", async (event) => {
    event.stopPropagation();
    await duplicateCard(card.id);
  });

  dragHandle?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    startDraggingCard(event, card, article);
  });

  resizeHandle?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    startResizingCard(event, card, article);
  });

  return article;
}

function selectCard(cardId) {
  selectedCardId = cardId;
  renderCards();
  updateSelectedCardPanel();
}

function updateSelectedCardPanel() {
  if (!DOM.selectedCardInfo || !DOM.quickCardActions) return;

  const card = getCardById(selectedCardId);

  if (!card) {
    DOM.selectedCardInfo.textContent = "Aucune carte sélectionnée";
    DOM.quickCardActions.classList.add("hidden");
    return;
  }

  DOM.selectedCardInfo.innerHTML = `
    <strong>${escapeHtml(card.title || "Sans titre")}</strong><br>
    Type : ${escapeHtml(getTypeLabel(card.type))}<br>
    Position : colonne ${card.x}, ligne ${card.y}<br>
    Taille : ${card.w} × ${card.h}
  `;

  DOM.quickCardActions.classList.remove("hidden");
}

/* =========================
   MODAL
========================= */

function openCardEditor(cardId) {
  const card = getCardById(cardId);
  if (!card) return;

  selectedCardId = cardId;

  DOM.cardTitle.value = card.title || "";
  DOM.cardType.value = card.type || "news";
  DOM.cardIcon.value = card.icon || "";
  DOM.cardLink.value = card.link || "";
  DOM.cardImage.value = card.image || "";
  DOM.cardBgColor.value = normalizeColor(card.bgColor || "#ffffff");
  DOM.cardTextColorMode.value = card.textColorMode || "auto";
  DOM.cardEmailText.value = card.emailText || "";

  DOM.cardX.value = String(card.x || 1);
  DOM.cardY.value = String(card.y || 1);
  DOM.cardW.value = String(card.w || 1);
  DOM.cardH.value = String(card.h || 1);

  shortTextQuill.root.innerHTML = card.shortText || "";
  longTextQuill.root.innerHTML = card.longText || "";

  openModal(DOM.cardModal);
}

async function saveCurrentCard() {
  if (!selectedCardId) return;

  const card = getCardById(selectedCardId);
  if (!card) return;

  const settings = getBoardSettings();

  const updatedCard = {
    ...card,
    title: DOM.cardTitle.value.trim(),
    type: DOM.cardType.value,
    icon: DOM.cardIcon.value.trim(),
    link: DOM.cardLink.value.trim(),
    image: DOM.cardImage.value.trim(),
    bgColor: DOM.cardBgColor.value,
    textColorMode: DOM.cardTextColorMode.value || "auto",
    emailText: DOM.cardEmailText.value.trim(),
    shortText: shortTextQuill.root.innerHTML,
    longText: longTextQuill.root.innerHTML,
    x: clampNumber(Number(DOM.cardX.value), 1, settings.columns),
    y: Math.max(1, Number(DOM.cardY.value) || 1),
    w: clampNumber(Number(DOM.cardW.value), 1, settings.columns),
    h: clampNumber(Number(DOM.cardH.value), 1, 4)
  };

  if (updatedCard.x + updatedCard.w - 1 > settings.columns) {
    updatedCard.x = Math.max(1, settings.columns - updatedCard.w + 1);
  }

  if (!isPositionFreeForCard(updatedCard.id, updatedCard.x, updatedCard.y, updatedCard.w, updatedCard.h)) {
    alert("Cette position est déjà occupée par une autre carte.");
    return;
  }

  const index = getCardIndexById(updatedCard.id);
  if (index === -1) return;

  cardsData[index] = updatedCard;

  try {
    await saveDraftToFirestore();
    renderBoard();
    closeModal(DOM.cardModal);
    showToast("Carte enregistrée");
  } catch (error) {
    console.error(error);
    alert("Impossible d'enregistrer la carte.");
  }
}

async function duplicateCard(cardId, closeAfter = false) {
  const sourceCard = getCardById(cardId);
  if (!sourceCard) return;

  const settings = getBoardSettings();
  const duplicatedCard = {
    ...sourceCard,
    id: generateId(),
    title: sourceCard.title ? `${sourceCard.title} (copie)` : "Copie de carte"
  };

  const newPosition = findAvailablePositionNearCard(sourceCard, settings.columns);
  duplicatedCard.x = newPosition.x;
  duplicatedCard.y = newPosition.y;

  cardsData.push(duplicatedCard);
  selectedCardId = duplicatedCard.id;

  try {
    await saveDraftToFirestore();
    renderBoard();
    updateSelectedCardPanel();

    if (closeAfter) {
      closeModal(DOM.cardModal);
    }

    showToast("Carte dupliquée");
  } catch (error) {
    console.error(error);
    alert("Impossible de dupliquer la carte.");
  }
}

async function deleteCardById(cardId, closeAfter = false) {
  const card = getCardById(cardId);
  if (!card) return;

  const ok = window.confirm(`Supprimer la carte "${card.title || "Sans titre"}" ?`);
  if (!ok) return;

  cardsData = cardsData.filter((item) => item.id !== cardId);

  if (selectedCardId === cardId) {
    selectedCardId = null;
  }

  try {
    await saveDraftToFirestore();
    renderBoard();
    updateSelectedCardPanel();

    if (closeAfter) {
      closeModal(DOM.cardModal);
    }

    showToast("Carte supprimée");
  } catch (error) {
    console.error(error);
    alert("Impossible de supprimer la carte.");
  }
}

function openModal(modal) {
  if (!modal) return;
  modal.classList.add("open");
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove("open");
}

/* =========================
   DRAG & DROP V3
========================= */

function startDraggingCard(event, card, article) {
  selectCard(card.id);

  const rect = article.getBoundingClientRect();

  dragState = {
    active: true,
    cardId: card.id,
    startX: event.clientX,
    startY: event.clientY,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    originX: card.x,
    originY: card.y
  };

  article.classList.add("is-dragging");
}

function handlePointerMove(event) {
  if (!dragState.active || !dragState.cardId) return;

  const draggedCard = getCardById(dragState.cardId);
  if (!draggedCard || !DOM.cardsLayer) return;

  const metrics = getBoardMetrics();
  if (!metrics) return;

  const nextX = clampNumber(
    Math.floor((event.clientX - metrics.left) / metrics.colWidth) + 1,
    1,
    metrics.columns
  );

  const nextY = Math.max(
    1,
    Math.floor((event.clientY - metrics.top) / metrics.rowHeightStep) + 1
  );

  let finalX = nextX;
  if (finalX + draggedCard.w - 1 > metrics.columns) {
    finalX = Math.max(1, metrics.columns - draggedCard.w + 1);
  }

  const canPlace = isPositionFreeForCard(draggedCard.id, finalX, nextY, draggedCard.w, draggedCard.h);

  previewDraggedCard(draggedCard.id, finalX, nextY, canPlace);
}

async function handlePointerUp(event) {
  if (!dragState.active || !dragState.cardId) return;

  const draggedCard = getCardById(dragState.cardId);
  const cardId = dragState.cardId;

  clearDragPreview();

  if (!draggedCard) {
    resetDragState();
    return;
  }

  const metrics = getBoardMetrics();
  if (!metrics) {
    resetDragState();
    return;
  }

  let targetX = clampNumber(
    Math.floor((event.clientX - metrics.left) / metrics.colWidth) + 1,
    1,
    metrics.columns
  );

  const targetY = Math.max(
    1,
    Math.floor((event.clientY - metrics.top) / metrics.rowHeightStep) + 1
  );

  if (targetX + draggedCard.w - 1 > metrics.columns) {
    targetX = Math.max(1, metrics.columns - draggedCard.w + 1);
  }

  if (isPositionFreeForCard(cardId, targetX, targetY, draggedCard.w, draggedCard.h)) {
    const index = getCardIndexById(cardId);
    if (index !== -1) {
      cardsData[index] = {
        ...cardsData[index],
        x: targetX,
        y: targetY
      };

      try {
        await saveDraftToFirestore();
        showToast("Carte déplacée");
      } catch (error) {
        console.error(error);
      }
    }
  }

  resetDragState();
  renderBoard();
}

function resetDragState() {
  dragState = {
    active: false,
    cardId: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    originX: 1,
    originY: 1
  };
}

function previewDraggedCard(cardId, x, y, valid) {
  const element = DOM.cardsLayer?.querySelector(`.v3-card[data-id="${cardId}"]`);
  const card = getCardById(cardId);

  if (!element || !card) return;

  element.style.gridColumn = `${x} / span ${card.w}`;
  element.style.gridRow = `${y} / span ${card.h}`;
  element.classList.add("is-dragging");
  element.classList.toggle("drag-preview", !!valid);
  element.classList.toggle("invalid-drop", !valid);
}

function clearDragPreview() {
  DOM.cardsLayer?.querySelectorAll(".v3-card").forEach((element) => {
    element.classList.remove("drag-preview");
    element.classList.remove("invalid-drop");
    element.classList.remove("is-dragging");
  });
}

function getBoardMetrics() {
  if (!DOM.cardsLayer) return null;

  const rect = DOM.cardsLayer.getBoundingClientRect();
  const settings = getBoardSettings();
  const columns = settings.columns;
  const gap = settings.gap;
  const totalGap = gap * (columns - 1);
  const colWidth = (rect.width - totalGap) / columns;

  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    columns,
    gap,
    colWidth: colWidth + gap,
    rowHeightStep: settings.rowHeight + gap
  };
}
function startResizingCard(event, card, article) {
  selectCard(card.id);

  resizeState = {
    active: true,
    cardId: card.id,
    startX: event.clientX,
    startY: event.clientY,
    originW: card.w,
    originH: card.h,
    x: card.x,
    y: card.y
  };

  article.classList.add("is-resizing");
}

function handleResizeMove(event) {
  if (!resizeState.active || !resizeState.cardId) return;

  const card = getCardById(resizeState.cardId);
  if (!card) return;

  const metrics = getBoardMetrics();
  if (!metrics) return;

  const deltaX = event.clientX - resizeState.startX;
  const deltaY = event.clientY - resizeState.startY;

  let nextW = resizeState.originW + Math.round(deltaX / metrics.colWidth);
  let nextH = resizeState.originH + Math.round(deltaY / metrics.rowHeightStep);

  nextW = Math.max(1, nextW);
  nextH = Math.max(1, nextH);

  const maxW = metrics.columns - resizeState.x + 1;
  nextW = Math.min(nextW, maxW);

  const valid = isPositionFreeForCard(
    card.id,
    resizeState.x,
    resizeState.y,
    nextW,
    nextH
  );

  previewResizedCard(card.id, resizeState.x, resizeState.y, nextW, nextH, valid);
}

async function handleResizeEnd(event) {
  if (!resizeState.active || !resizeState.cardId) return;

  const card = getCardById(resizeState.cardId);
  if (!card) {
    resetResizeState();
    return;
  }

  const metrics = getBoardMetrics();
  if (!metrics) {
    resetResizeState();
    return;
  }

  const deltaX = event.clientX - resizeState.startX;
  const deltaY = event.clientY - resizeState.startY;

  let nextW = resizeState.originW + Math.round(deltaX / metrics.colWidth);
  let nextH = resizeState.originH + Math.round(deltaY / metrics.rowHeightStep);

  nextW = Math.max(1, nextW);
  nextH = Math.max(1, nextH);

  const maxW = metrics.columns - resizeState.x + 1;
  nextW = Math.min(nextW, maxW);

  clearResizePreview();

  if (isPositionFreeForCard(card.id, resizeState.x, resizeState.y, nextW, nextH)) {
    const index = getCardIndexById(card.id);
    if (index !== -1) {
      cardsData[index] = {
        ...cardsData[index],
        w: nextW,
        h: nextH
      };

      try {
        await saveDraftToFirestore();
        showToast("Taille mise à jour");
      } catch (error) {
        console.error(error);
      }
    }
  }

  resetResizeState();
  renderBoard();
}

function previewResizedCard(cardId, x, y, w, h, valid) {
  const element = DOM.cardsLayer?.querySelector(`.v3-card[data-id="${cardId}"]`);
  if (!element) return;

  element.style.gridColumn = `${x} / span ${w}`;
  element.style.gridRow = `${y} / span ${h}`;
  element.classList.add("is-resizing");
  element.classList.toggle("drag-preview", !!valid);
  element.classList.toggle("invalid-drop", !valid);
}

function clearResizePreview() {
  DOM.cardsLayer?.querySelectorAll(".v3-card").forEach((element) => {
    element.classList.remove("drag-preview");
    element.classList.remove("invalid-drop");
    element.classList.remove("is-resizing");
  });
}

function resetResizeState() {
  resizeState = {
    active: false,
    cardId: null,
    startX: 0,
    startY: 0,
    originW: 1,
    originH: 1,
    x: 1,
    y: 1
  };
}
/* =========================
   POSITION / COLLISION
========================= */

function isPositionFreeForCard(cardId, x, y, w, h) {
  const settings = getBoardSettings();

  if (x < 1 || y < 1 || w < 1 || h < 1) return false;
  if (x + w - 1 > settings.columns) return false;

  const candidate = {
    x,
    y,
    w,
    h
  };

  return !cardsData.some((card) => {
    if (card.id === cardId) return false;
    return rectanglesOverlap(candidate, card);
  });
}

function rectanglesOverlap(a, b) {
  const aLeft = a.x;
  const aRight = a.x + a.w - 1;
  const aTop = a.y;
  const aBottom = a.y + a.h - 1;

  const bLeft = b.x;
  const bRight = b.x + b.w - 1;
  const bTop = b.y;
  const bBottom = b.y + b.h - 1;

  return !(
    aRight < bLeft ||
    aLeft > bRight ||
    aBottom < bTop ||
    aTop > bBottom
  );
}

function findFirstAvailablePosition(w, h, columns) {
  for (let y = 1; y <= 50; y += 1) {
    for (let x = 1; x <= columns; x += 1) {
      if (x + w - 1 > columns) continue;
      if (isPositionFreeForCard(null, x, y, w, h)) {
        return { x, y };
      }
    }
  }

  return { x: 1, y: getMaxRows() + 1 };
}

function findAvailablePositionNearCard(sourceCard, columns) {
  const candidates = [
    { x: sourceCard.x + sourceCard.w, y: sourceCard.y },
    { x: sourceCard.x, y: sourceCard.y + sourceCard.h },
    { x: sourceCard.x + 1, y: sourceCard.y + 1 },
    { x: sourceCard.x, y: sourceCard.y }
  ];

  for (const pos of candidates) {
    const safeX = Math.max(1, Math.min(pos.x, columns));
    const safeY = Math.max(1, pos.y);

    let finalX = safeX;
    if (finalX + sourceCard.w - 1 > columns) {
      finalX = Math.max(1, columns - sourceCard.w + 1);
    }

    if (isPositionFreeForCard(null, finalX, safeY, sourceCard.w, sourceCard.h)) {
      return { x: finalX, y: safeY };
    }
  }

  return findFirstAvailablePosition(sourceCard.w, sourceCard.h, columns);
}

/* =========================
   FIRESTORE
========================= */

async function loadLatestDraft() {
  try {
    const doc = await db.collection(DRAFT_COLLECTION).doc(DEFAULT_DRAFT_ID).get();

    if (!doc.exists) {
      cardsData = [];
      currentDraftId = DEFAULT_DRAFT_ID;
      DOM.bulletinPeriod.value = "";
      DOM.bulletinTitle.value = "Frequence SUD";
      applyBoardSettings(DEFAULT_GRID);
      renderBoard();
      await saveDraftToFirestore();
      return;
    }

    const data = doc.data();

    currentDraftId = doc.id;
    cardsData = Array.isArray(data.cards) ? sanitizeCards(data.cards) : [];
    DOM.bulletinPeriod.value = data.period || "";
    DOM.bulletinTitle.value = data.title || "Frequence SUD";

    applyBoardSettings({
      columns: Number(data.columns || DEFAULT_GRID.columns),
      rowHeight: Number(data.rowHeight || DEFAULT_GRID.rowHeight),
      gap: Number(data.gap || DEFAULT_GRID.gap)
    });

    renderBoard();
  } catch (error) {
    console.error("Erreur chargement brouillon :", error);
    alert("Impossible de charger le brouillon.");
  }
}

async function saveDraftMeta() {
  try {
    await saveDraftToFirestore();
  } catch (error) {
    console.error("Erreur sauvegarde meta brouillon :", error);
  }
}

async function saveDraftToFirestore() {
  const settings = getBoardSettings();

  const payload = {
    period: DOM.bulletinPeriod.value.trim(),
    title: DOM.bulletinTitle.value.trim() || "Frequence SUD",
    columns: settings.columns,
    rowHeight: settings.rowHeight,
    gap: settings.gap,
    cards: cardsData.map((card) => ({ ...card })),
    isDraft: true,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  await db.collection(DRAFT_COLLECTION).doc(currentDraftId).set(payload, { merge: true });
}

async function openArchivesModal() {
  try {
    const snapshot = await db.collection(PUBLIC_COLLECTION).orderBy("timestamp", "desc").get();

    archiveList = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }));

    DOM.archiveSelect.innerHTML = "";

    if (!archiveList.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Aucune archive disponible";
      DOM.archiveSelect.appendChild(option);
    } else {
      archiveList.forEach((archive) => {
        const option = document.createElement("option");
        option.value = archive.id;
        option.textContent = archive.period || archive.id;
        DOM.archiveSelect.appendChild(option);
      });
    }

    openModal(DOM.archiveModal);
  } catch (error) {
    console.error(error);
    alert("Impossible de charger les archives.");
  }
}

async function loadSelectedPublishedArchive() {
  const archiveId = DOM.archiveSelect.value;
  if (!archiveId) return;

  try {
    const doc = await db.collection(PUBLIC_COLLECTION).doc(archiveId).get();
    if (!doc.exists) {
      alert("Archive introuvable.");
      return;
    }

    const data = doc.data();

    cardsData = Array.isArray(data.cards) ? sanitizeCards(data.cards) : [];
    DOM.bulletinPeriod.value = data.period || "";
    DOM.bulletinTitle.value = data.title || "Frequence SUD";

    applyBoardSettings({
      columns: Number(data.columns || DEFAULT_GRID.columns),
      rowHeight: Number(data.rowHeight || DEFAULT_GRID.rowHeight),
      gap: Number(data.gap || DEFAULT_GRID.gap)
    });

    await saveDraftToFirestore();
    renderBoard();
    closeModal(DOM.archiveModal);
    showToast("Archive chargée dans le brouillon");
  } catch (error) {
    console.error(error);
    alert("Impossible de charger cette archive.");
  }
}

async function publishWebBulletin() {
  try {
    const payload = buildPublishPayload();
    const publishedId = buildPublishedDocId(payload.period);

    await db.collection(PUBLIC_COLLECTION).doc(publishedId).set({
      ...payload,
      sourceDraftId: currentDraftId,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    showToast("Bulletin web publié");
  } catch (error) {
    console.error(error);
    alert("Erreur lors de la publication web.");
  }
}

async function publishEmailBulletin() {
  try {
    const payload = buildPublishPayload();
    const emailHtml = generateEmailHtml(payload);

    await db.collection(EMAIL_COLLECTION).add({
      ...payload,
      htmlContent: emailHtml,
      sourceDraftId: currentDraftId,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

    showToast("Email publié");
  } catch (error) {
    console.error(error);
    alert("Erreur lors de la publication email.");
  }
}

function buildPublishPayload() {
  const settings = getBoardSettings();

  return {
    period: DOM.bulletinPeriod.value.trim(),
    title: DOM.bulletinTitle.value.trim() || "Frequence SUD",
    columns: settings.columns,
    rowHeight: settings.rowHeight,
    gap: settings.gap,
    cards: cardsData.map((card) => ({ ...card }))
  };
}

/* =========================
   EMAIL HTML
========================= */

function generateEmailHtml(payload) {
  const cardsSorted = [...payload.cards].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });

  const cardsHtml = cardsSorted.map((card) => {
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
  }).join("");

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
              <div style="font-size:28px;font-weight:700;">${escapeHtml(payload.title || "Frequence SUD")}</div>
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

/* =========================
   HELPERS
========================= */

function sanitizeCards(cards) {
  return cards.map((card) => ({
    id: card.id || generateId(),
    type: card.type || "news",
    title: card.title || "Sans titre",
    icon: card.icon || "📄",
    shortText: card.shortText || "",
    longText: card.longText || "",
    emailText: card.emailText || "",
    link: card.link || "",
    image: card.image || "",
    bgColor: normalizeColor(card.bgColor || "#ffffff"),
    textColorMode: card.textColorMode || "auto",
    x: Math.max(1, Number(card.x || 1)),
    y: Math.max(1, Number(card.y || 1)),
    w: Math.max(1, Number(card.w || 1)),
    h: Math.max(1, Number(card.h || 1))
  }));
}

function getTypeLabel(type) {
  const labels = {
    news: "Actu",
    event: "Événement",
    info: "Info",
    link: "Lien",
    app: "Application",
    image: "Image",
    custom: "Personnalisée"
  };

  return labels[type] || "Carte";
}

function shouldUseLightText(card) {
  if (card.textColorMode === "light") return true;
  if (card.textColorMode === "dark") return false;
  if (card.image) return true;
  return isDarkColor(card.bgColor || "#ffffff");
}

function buildPublishedDocId(period) {
  const base = (period || `bulletin_${Date.now()}`)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .toLowerCase();

  return base || `bulletin_${Date.now()}`;
}

function showToast(message) {
  if (!DOM.toast || !DOM.toastText) return;

  DOM.toastText.textContent = message;
  DOM.toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    DOM.toast.classList.remove("show");
  }, 2200);
}

function clampNumber(value, min, max) {
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

function generateId() {
  return `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
