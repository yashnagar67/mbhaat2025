const STALLS_ENDPOINT = "stalls.json";

// Firebase Configuration - Replace with your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyB1IN-K39FrRZZpv2rYiGJ0zlnPhnjxcAQ",
  authDomain: "mv-haat.firebaseapp.com",
  projectId: "mv-haat",
  storageBucket: "mv-haat.firebasestorage.app",
  messagingSenderId: "53410657472",
  appId: "1:53410657472:web:420882eec56a0934ed6925",
  measurementId: "G-GGB3W93K0E"
};

// Initialize Firebase
let db = null;
const initFirebase = () => {
  try {
    if (typeof firebase !== 'undefined') {
      if (firebase.apps.length === 0) {
        firebase.initializeApp(firebaseConfig);
      }
      db = firebase.firestore();
      console.log("Firebase initialized successfully");
    } else {
      console.warn("Firebase SDK not loaded");
    }
  } catch (error) {
    console.error("Firebase initialization error:", error);
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFirebase);
} else {
  initFirebase();
}

let stallsConfig = [];
const appData = {
  summary: [],
};

const reactionsMap = {
  1: "😶‍🌫️ Needs a pinch more magic.",
  2: "🙂 Decent vibes, room to grow!",
  3: "😋 Yummy fun, keep it going!",
  4: "🤩 Loved it a lot!",
  5: "🔥 You loved it!",
};

const zoneEmojiMap = {
  food: "🌮",
  games: "🎯",
  crafts: "🎨",
  default: "⭐",
};

const storageKey = "mbhaat-feedback-2025";
const ADMIN_HASHES = Object.freeze({
  username: "262cc47030b1803064844b94c1cb0054a247d1e550e26bb33f215149d8b2c72e",
  password: "d44c23622245f9042ccc470f1186c6866b84a81a161604db1f0ab11d44b5f5a3",
});

const formatLabel = (value) =>
  value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const storedData = (() => {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.warn("Unable to parse stored feedback", error);
    return {};
  }
})();

const state = {
  ratings: structuredClone(storedData.ratings || {}),
  submittedStalls: new Set(storedData.submittedStalls || []),
  adminAuthenticated: false,
};

const userInfoKey = "mbhaat-user-info";
const getUserInfo = () => {
  try {
    const raw = localStorage.getItem(userInfoKey);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("Failed to parse stored user info", error);
    return null;
  }
};

const getAllStallIds = () =>
  stallsConfig.flatMap((zone) =>
    (zone.stalls || []).map((stall) => stall.id)
  );

const findStallById = (stallId) => {
  for (const zone of stallsConfig) {
    const stall = zone.stalls?.find((item) => item.id === stallId);
    if (stall) {
      return { stall, zone };
    }
  }
  return null;
};

const loadStallsConfig = async () => {
  const populateSubmittedFromLegacy = () => {
    if (
      storedData.submitted &&
      (!Array.isArray(storedData.submittedStalls) ||
        storedData.submittedStalls.length === 0)
    ) {
      state.submittedStalls = new Set(getAllStallIds());
    }
  };

  try {
    const response = await fetch(STALLS_ENDPOINT, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Unable to fetch stalls.json (${response.status})`);
    }
    const data = await response.json();
    if (Array.isArray(data)) {
      stallsConfig = data;
      populateSubmittedFromLegacy();
    } else {
      throw new Error("Invalid stalls.json format.");
    }
  } catch (error) {
    console.error("Failed to load stalls configuration:", error);
    stallsConfig = [];
  }
};

const isStallSubmitted = (stallId) => state.submittedStalls.has(stallId);

const getStallEmoji = (stall, zone) =>
  stall.emoji ||
  zone?.emoji ||
  zoneEmojiMap[zone?.zone] ||
  zoneEmojiMap.default;

const createStallCard = (stall, zone) => {
  const card = document.createElement("article");
  card.className = "stall-card";
  card.dataset.stall = stall.id;

  const body = document.createElement("div");
  body.className = "stall-card__body";

  const iconWrapper = document.createElement("div");
  iconWrapper.className = "stall-card__icon";
  
  // Use image if provided, otherwise use emoji
  if (stall.image && stall.image.trim() !== "") {
    const image = document.createElement("img");
    image.className = "stall-card__icon-image";
    image.src = stall.image;
    image.alt = `${stall.name} image`;
    image.loading = "lazy";
    image.addEventListener("error", () => {
      // Fallback to emoji if image fails to load
      iconWrapper.innerHTML = "";
      const fallbackIcon = document.createElement("span");
      fallbackIcon.textContent = getStallEmoji(stall, zone);
      iconWrapper.append(fallbackIcon);
    });
    iconWrapper.append(image);
  } else {
    const icon = document.createElement("span");
    icon.textContent = getStallEmoji(stall, zone);
    iconWrapper.append(icon);
  }

  const title = document.createElement("h3");
  title.className = "stall-card__title";
  title.textContent = stall.name;

  const metaText =
    typeof stall.team === "string" && stall.team.trim().length > 0
      ? stall.team.trim().startsWith("By:")
        ? stall.team.trim()
        : `By: ${stall.team.trim()}`
      : "";
  const meta = metaText
    ? Object.assign(document.createElement("p"), {
        className: "stall-card__meta",
        textContent: metaText,
      })
    : null;

  const stars = document.createElement("div");
  stars.className = "stars";
  stars.setAttribute("data-stars", "");

  const reaction = document.createElement("p");
  reaction.className = "reaction";
  reaction.setAttribute("data-reaction", "");

  const interactions = document.createElement("div");
  interactions.className = "stall-card__interactions";
  interactions.append(stars, reaction);

  const submitButton = document.createElement("button");
  submitButton.type = "button";
  submitButton.className = "stall-card__submit is-hidden";
  submitButton.textContent = "Submit Feedback";
  submitButton.addEventListener("click", () =>
    handleStallSubmit(stall.id)
  );

  const status = document.createElement("p");
  status.className = "stall-card__status";

  const description = document.createElement("p");
  description.className = "stall-card__description";
  description.textContent =
    (typeof stall.description === "string" && stall.description.trim()) ||
    "Share your thoughts about this stall!";

  const bestBadge = document.createElement("div");
  bestBadge.className = "stall-card__best-badge";
  bestBadge.textContent = "BEST EVER!";
  bestBadge.setAttribute("aria-hidden", "true");

  const info = document.createElement("div");
  info.className = "stall-card__info";
  info.append(title);
  if (meta) {
    info.append(meta);
  }
  info.append(interactions, submitButton);

  body.append(iconWrapper, info);

  card.append(body, status, description, bestBadge);

  return card;
};

const renderStallCards = () => {
  const zoneContainers = document.querySelectorAll(".stall-list[data-zone]");

  zoneContainers.forEach((container) => {
    container.innerHTML = "";
  });

  if (stallsConfig.length === 0) {
    zoneContainers.forEach((container) => {
      container.innerHTML =
        '<p class="stall-list__empty">Stall list coming soon.</p>';
    });
    return;
  }

  stallsConfig.forEach((zone) => {
    const container = document.querySelector(
      `.stall-list[data-zone="${zone.zone}"]`
    );
    if (!container) return;

    (zone.stalls || []).forEach((stall) => {
      const card = createStallCard(stall, zone);
      container.appendChild(card);
    });
  });
};

const pruneUnknownRatings = () => {
  const validIds = new Set(getAllStallIds());
  let mutated = false;

  Object.keys(state.ratings).forEach((key) => {
    if (!validIds.has(key)) {
      delete state.ratings[key];
      mutated = true;
    }
  });

  state.submittedStalls.forEach((key) => {
    if (!validIds.has(key)) {
      state.submittedStalls.delete(key);
      mutated = true;
    }
  });

  if (mutated) {
    saveToStorage();
  }
};

const getCardElements = (stallId) => {
  const card = document.querySelector(`.stall-card[data-stall="${stallId}"]`);
  if (!card) return {};
  return {
    card,
    submitButton: card.querySelector(".stall-card__submit"),
    status: card.querySelector(".stall-card__status"),
  };
};

const setCardStatus = (stallId, message = "", variant = "info") => {
  const { status } = getCardElements(stallId);
  if (!status) return;

  status.textContent = message;
  status.classList.remove("is-success", "is-error", "show");

  if (!message) {
    return;
  }

  if (variant === "success") {
    status.classList.add("is-success");
  } else if (variant === "error") {
    status.classList.add("is-error");
  }

  status.classList.add("show");
};

const refreshSummary = async () => {
  if (!db) {
    console.warn("Firebase not initialized. Summary unavailable.");
    appData.summary = [];
    return;
  }

  try {
    const ratingsSnapshot = await db.collection("ratings").get();
    const ratingsData = [];
    
    ratingsSnapshot.forEach((doc) => {
      const data = doc.data();
      ratingsData.push({
        stallId: data.stallId,
        stars: data.stars || data.rating || 0,
        timestamp: data.timestamp || doc.id,
      });
    });

    // Calculate summary by stall
    const summaryMap = new Map();
    
    ratingsData.forEach((rating) => {
      const stallId = rating.stallId;
      if (!stallId) return;
      
      if (!summaryMap.has(stallId)) {
        summaryMap.set(stallId, {
          stallId: stallId,
          id: stallId,
          totalRatings: 0,
          sumRatings: 0,
          average: 0,
        });
      }
      
      const entry = summaryMap.get(stallId);
      entry.totalRatings += 1;
      entry.sumRatings += rating.stars;
      entry.average = entry.sumRatings / entry.totalRatings;
    });

    appData.summary = Array.from(summaryMap.values());
  } catch (error) {
    console.error("Unable to load summary data from Firebase:", error);
    appData.summary = [];
  }
};

const updateCardSubmissionState = (stallId) => {
  const { card, submitButton } = getCardElements(stallId);
  if (!card) return;

  const stars = card.querySelectorAll(".star");
  const hasRating = Boolean(state.ratings[stallId]);
  const submitted = isStallSubmitted(stallId);

  if (submitted) {
    card.classList.add("stall-card--submitted");
    stars.forEach((star) => {
      star.disabled = true;
    });
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.classList.add("is-hidden");
    }
    setCardStatus(stallId, "✅ Feedback recorded!", "success");
    return;
  }

  card.classList.remove("stall-card--submitted");
  stars.forEach((star) => {
    star.disabled = false;
  });

  if (submitButton) {
    submitButton.disabled = false;
    if (hasRating) {
      submitButton.classList.remove("is-hidden");
    } else {
      submitButton.classList.add("is-hidden");
    }
  }

  if (hasRating) {
    setCardStatus(stallId, "Tap submit to lock this rating.");
  } else {
    setCardStatus(stallId, "");
  }
};

const createStarElement = (stallId, value) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "star";
  button.dataset.value = String(value);
  button.setAttribute("aria-label", `${value} star${value > 1 ? "s" : ""}`);
  button.innerHTML = "⭐";

  button.addEventListener("click", () => handleStarClick(stallId, value));
  button.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleStarClick(stallId, value);
    }
  });

  return button;
};

const renderStars = () => {
  document.querySelectorAll(".stall-card").forEach((card) => {
    const stallId = card.dataset.stall;
    const starsContainer = card.querySelector("[data-stars]");
    if (!starsContainer) return;
    starsContainer.innerHTML = "";

    for (let index = 1; index <= 5; index += 1) {
      const starButton = createStarElement(stallId, index);
      starsContainer.appendChild(starButton);
    }
  });
};

const updateReactions = () => {
  document.querySelectorAll(".stall-card").forEach((card) => {
    const stallId = card.dataset.stall;
    const reaction = card.querySelector("[data-reaction]");
    const value = state.ratings[stallId];

    if (value) {
      reaction.textContent = reactionsMap[value] || "";
      reaction.classList.add("show");
    } else {
      reaction.textContent = "";
      reaction.classList.remove("show");
    }
  });
};

const highlightSelectedStars = () => {
  document.querySelectorAll(".stall-card").forEach((card) => {
    const stallId = card.dataset.stall;
    const value = state.ratings[stallId] || 0;

    card.querySelectorAll(".star").forEach((star) => {
      const starValue = Number(star.dataset.value);
      star.classList.toggle("selected", starValue <= value);
    });

    const bestBadge = card.querySelector(".stall-card__best-badge");
    if (bestBadge) {
      bestBadge.classList.toggle("show", value >= 4);
    }
  });
};

const saveToStorage = () => {
  const payload = {
    ratings: state.ratings,
    submittedStalls: Array.from(state.submittedStalls),
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch (error) {
    console.warn("Unable to save feedback", error);
  }
};

const handleStarClick = (stallId, value) => {
  if (isStallSubmitted(stallId)) return;

  state.ratings[stallId] = value;
  highlightSelectedStars();
  updateReactions();
  saveToStorage();
  updateCardSubmissionState(stallId);
  maybeShowBadge();
};

const handleStallSubmit = async (stallId) => {
  if (isStallSubmitted(stallId)) return;

  const { submitButton } = getCardElements(stallId);
  if (submitButton) {
    submitButton.disabled = true;
  }

  const hasRating = Boolean(state.ratings[stallId]);
  if (!hasRating) {
    setCardStatus(
      stallId,
      "Pick a star rating first to submit this stall.",
      "error"
    );
    if (submitButton) {
      submitButton.disabled = false;
    }
    return;
  }

  const userInfo = getUserInfo();

  if (!userInfo?.name || !userInfo?.course) {
    setCardStatus(
      stallId,
      "We need your name and course before submitting.",
      "error"
    );
    showUserModal();
    if (submitButton) {
      submitButton.disabled = false;
    }
    return;
  }

  setCardStatus(stallId, "Saving your feedback...");

  if (!db) {
    setCardStatus(
      stallId,
      "Firebase not configured. Please check configuration.",
      "error"
    );
    if (submitButton) {
      submitButton.disabled = false;
    }
    return;
  }

  try {
    const ratingValue = state.ratings[stallId];
    const reaction = reactionsMap[ratingValue] || "";

    // Save rating to Firebase Firestore
    await db.collection("ratings").add({
      stallId: stallId,
      stars: ratingValue,
      rating: ratingValue, // Alternative field name for compatibility
      userName: userInfo.name,
      userCourse: userInfo.course,
      reaction: reaction,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: new Date().toISOString(),
    });

    state.submittedStalls.add(stallId);
    saveToStorage();
    await refreshSummary();
    updateCardSubmissionState(stallId);
    maybeShowBadge();
  } catch (error) {
    console.error("Firebase save error:", error);
    setCardStatus(
      stallId,
      error.message || "Something went wrong. Please try again.",
      "error"
    );
    if (submitButton) {
      submitButton.disabled = false;
    }
    return;
  }

  setCardStatus(stallId, "✅ Feedback recorded!", "success");
  if (submitButton) {
    submitButton.disabled = true;
  }
};

const allSelectedFiveStars = () => {
  const stallIds = getAllStallIds();
  if (stallIds.length === 0) return false;

  return stallIds.every((stallId) => state.ratings[stallId] === 5);
};

const maybeShowBadge = () => {
  const badge = document.getElementById("allStarsBadge");
  if (!badge) return;

  if (allSelectedFiveStars()) {
    badge.classList.add("show");
  } else {
    badge.classList.remove("show");
  }
};

const hydrateView = () => {
  renderStars();
  highlightSelectedStars();
  updateReactions();
  maybeShowBadge();
  getAllStallIds().forEach(updateCardSubmissionState);
};

const adminElements = {
  modal: null,
  loginSection: null,
  dashboard: null,
  stats: null,
  loginForm: null,
  error: null,
  username: null,
  password: null,
  openBtn: null,
  closeBtn: null,
  resetBtn: null,
  unlockBtn: null,
  exportBtn: null,
  winnerBtn: null,
};

const winnerElements = {
  overlay: null,
  countdown: null,
  card: null,
  stall: null,
  zone: null,
  rating: null,
  reaction: null,
  closeBtn: null,
  backdrop: null,
};

let winnerCountdownTimer = null;

const cacheAdminElements = () => {
  adminElements.modal = document.getElementById("adminModal");
  adminElements.loginSection = document.getElementById("adminLoginSection");
  adminElements.dashboard = document.getElementById("adminDashboard");
  adminElements.stats = document.getElementById("adminStats");
  adminElements.loginForm = document.getElementById("adminLoginForm");
  adminElements.error = document.getElementById("adminError");
  adminElements.username = document.getElementById("adminUsername");
  adminElements.password = document.getElementById("adminPassword");
  adminElements.openBtn = document.getElementById("openAdmin");
  adminElements.closeBtn = document.getElementById("closeAdmin");
  adminElements.resetBtn = document.getElementById("resetRatings");
  adminElements.unlockBtn = document.getElementById("unlockFeedback");
  adminElements.exportBtn = document.getElementById("exportRatings");
  adminElements.winnerBtn = document.getElementById("revealWinner");
};

const cacheWinnerElements = () => {
  winnerElements.overlay = document.getElementById("winnerOverlay");
  winnerElements.countdown = document.getElementById("winnerCountdown");
  winnerElements.card = document.getElementById("winnerCard");
  winnerElements.stall = document.getElementById("winnerStall");
  winnerElements.zone = document.getElementById("winnerZone");
  winnerElements.rating = document.getElementById("winnerRating");
  winnerElements.reaction = document.getElementById("winnerReaction");
  winnerElements.closeBtn = document.getElementById("closeWinner");
  winnerElements.backdrop = winnerElements.overlay?.querySelector(
    "[data-close-winner]"
  );
};

const userElements = {
  modal: null,
  form: null,
  name: null,
  course: null,
  error: null,
};

const cacheUserElements = () => {
  userElements.modal = document.getElementById("userModal");
  userElements.form = document.getElementById("userInfoForm");
  userElements.name = document.getElementById("userName");
  userElements.course = document.getElementById("userCourse");
  userElements.error = document.getElementById("userFormError");
};

const setUserError = (message = "") => {
  if (userElements.error) {
    userElements.error.textContent = message;
  }
};

const hashString = async (value) => {
  if (window.crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(value);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  throw new Error("Secure hashing not supported in this browser.");
};

const setAdminError = (message = "") => {
  if (adminElements.error) {
    adminElements.error.textContent = message;
  }
};

const openAdminModal = () => {
  if (!adminElements.modal) return;
  adminElements.modal.classList.add("show");
  adminElements.modal.setAttribute("aria-hidden", "false");

  if (!state.adminAuthenticated) {
    adminElements.loginSection?.classList.remove("hidden");
    adminElements.dashboard?.classList.add("hidden");
    setAdminError("");
    adminElements.username?.focus();
    if (adminElements.loginForm) {
      adminElements.loginForm.reset();
    }
  } else {
    showAdminDashboard();
  }
};

const closeAdminModal = () => {
  if (!adminElements.modal) return;
  adminElements.modal.classList.remove("show");
  adminElements.modal.setAttribute("aria-hidden", "true");
};

const renderAdminOverview = () => {
  if (!adminElements.stats) return;

  if (stallsConfig.length === 0) {
    adminElements.stats.innerHTML = `
      <div class="admin-stats__item">
        <h3>Status</h3>
        <p class="admin-stats__rating">Stall data unavailable. Please ensure the API is reachable.</p>
      </div>
    `;
    return;
  }

  const summaryMap = new Map(
    appData.summary.map((item) => [item.stallId || item.id, item])
  );
  const totalServerRatings = appData.summary.reduce(
    (sum, item) => sum + (item.totalRatings || 0),
    0
  );
  const totalStalls = appData.summary.length || getAllStallIds().length;
  const summaryStatus = `Server records: ${totalServerRatings} ratings across ${totalStalls} stalls.`;

  const items = stallsConfig
    .map(({ zone, title, stalls }) => {
      const zoneTitle = title || formatLabel(zone);

      const stallItems = (stalls || [])
        .map((stall) => {
          const summaryEntry = summaryMap.get(stall.id);
          const average = summaryEntry?.average ?? 0;
          const votes = summaryEntry?.totalRatings ?? 0;
          const userValue = state.ratings[stall.id];
          const submitted = state.submittedStalls.has(stall.id);

          const lines = [
            votes > 0
              ? `Average: ${average.toFixed(2)} ⭐ (${votes} vote${
                  votes === 1 ? "" : "s"
                })`
              : "Average: No feedback yet.",
            userValue
              ? `Your rating: ${"⭐".repeat(userValue)} (${userValue}/5)`
              : "Your rating: Not set",
            `Submitted: ${submitted ? "Yes ✅" : "Pending"}`,
          ];

          return `
            <div class="admin-stats__item">
              <h3>${zoneTitle} • ${stall.name}</h3>
              ${lines
                .map((line) => `<p class="admin-stats__rating">${line}</p>`)
                .join("")}
            </div>
          `;
        })
        .join("");

      return stallItems;
    })
    .join("");

  adminElements.stats.innerHTML = `
    <div class="admin-stats__item">
      <h3>Status</h3>
      <p class="admin-stats__rating">${summaryStatus}</p>
      <p class="admin-stats__rating">${state.submittedStalls.size} stall submissions from this device.</p>
    </div>
    ${items}
  `;
};

const showAdminDashboard = async () => {
  if (!adminElements.loginSection || !adminElements.dashboard) return;
  adminElements.loginSection.classList.add("hidden");
  adminElements.dashboard.classList.remove("hidden");
  await refreshSummary();
  renderAdminOverview();
};

const handleAdminLogin = async (event) => {
  event.preventDefault();
  const username = adminElements.username?.value.trim();
  const password = adminElements.password?.value.trim();

  try {
    const [usernameHash, passwordHash] = await Promise.all([
      hashString(username || ""),
      hashString(password || ""),
    ]);

    if (
      usernameHash === ADMIN_HASHES.username &&
      passwordHash === ADMIN_HASHES.password
    ) {
      state.adminAuthenticated = true;
      setAdminError("");
      await showAdminDashboard();
      return;
    }
  } catch (error) {
    console.error(error);
    setAdminError(
      "Secure login is unavailable in this browser. Please update to a modern browser."
    );
    return;
  }

  setAdminError("Incorrect username or password. Try again.");
};

const exportRatings = async () => {
  if (!db) {
    alert("Firebase not configured. Cannot export ratings.");
    return;
  }

  try {
    const ratingsSnapshot = await db.collection("ratings").get();
    const allRatings = [];
    
    ratingsSnapshot.forEach((doc) => {
      const data = doc.data();
      allRatings.push({
        id: doc.id,
        ...data,
      });
    });

    const data = {
      ratings: allRatings,
      localRatings: state.ratings,
      submittedStalls: Array.from(state.submittedStalls),
      summary: appData.summary,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mbhaat-feedback-ratings-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Export error:", error);
    alert("Failed to export ratings. Check console for details.");
  }
};

const resetRatings = async () => {
  const confirmReset = window.confirm(
    "Delete all ratings from Firebase and unlock the form? This cannot be undone."
  );
  if (!confirmReset) return;

  if (db) {
    try {
      const batch = db.batch();
      const ratingsSnapshot = await db.collection("ratings").get();
      
      ratingsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log("All ratings deleted from Firebase");
    } catch (error) {
      console.error("Error deleting ratings from Firebase:", error);
      alert("Failed to delete ratings from Firebase. Check console for details.");
    }
  }

  state.ratings = {};
  state.submittedStalls.clear();
  saveToStorage();
  hydrateView();
  await refreshSummary();
  renderAdminOverview();
};

const unlockFeedbackFromAdmin = async () => {
  if (state.submittedStalls.size === 0) {
    alert("Feedback form is already open.");
    return;
  }

  state.submittedStalls.clear();
  saveToStorage();
  hydrateView();
  await refreshSummary();
  renderAdminOverview();
};

const closeWinnerOverlay = () => {
  if (!winnerElements.overlay) return;

  if (winnerCountdownTimer) {
    clearInterval(winnerCountdownTimer);
    winnerCountdownTimer = null;
  }

  winnerElements.overlay.classList.remove("show", "countdown-finished");
  winnerElements.overlay.setAttribute("aria-hidden", "true");
  winnerElements.card?.classList.remove("show");
};

const findWinner = () => {
  if (!appData.summary.length) return null;

  const bestEntry = appData.summary.reduce((best, entry) => {
    const votes = entry.totalRatings || 0;
    const avg = entry.average ?? 0;
    if (votes === 0) return best;

    if (!best) return entry;

    if (avg > best.average) return entry;
    if (avg === best.average && votes > (best.totalRatings || 0)) return entry;
    return best;
  }, null);

  if (!bestEntry) return null;

  const info = findStallById(bestEntry.stallId);
  const stallDetails = info?.stall || {
    id: bestEntry.stallId,
    name: bestEntry.name,
    description: "",
  };
  const zoneDetails = info?.zone || {
    zone: bestEntry.zone,
    title: bestEntry.zoneTitle || formatLabel(bestEntry.zone || "zone"),
  };

  return {
    stall: stallDetails,
    zone: zoneDetails,
    average: bestEntry.average ?? 0,
    totalRatings: bestEntry.totalRatings ?? 0,
  };
};

const startWinnerCountdown = () => {
  if (
    !winnerElements.countdown ||
    !winnerElements.overlay ||
    !winnerElements.card
  ) {
    return;
  }

  if (winnerCountdownTimer) {
    clearInterval(winnerCountdownTimer);
    winnerCountdownTimer = null;
  }

  winnerElements.overlay.classList.remove("countdown-finished");
  winnerElements.card.classList.remove("show");
  winnerElements.countdown.textContent = "3";

  let count = 3;
  winnerCountdownTimer = setInterval(() => {
    count -= 1;
    if (count > 0) {
      winnerElements.countdown.textContent = String(count);
    } else {
      clearInterval(winnerCountdownTimer);
      winnerCountdownTimer = null;
      winnerElements.overlay.classList.add("countdown-finished");
      requestAnimationFrame(() => {
        winnerElements.card.classList.add("show");
      });
    }
  }, 900);
};

const triggerWinnerReveal = async () => {
  await refreshSummary();
  const winner = findWinner();

  if (!winner) {
    alert("No ratings yet! Encourage visitors to share their stars first.");
    return;
  }

  if (!winnerElements.overlay) {
    console.warn("Winner overlay elements not available.");
    return;
  }

  winnerElements.stall.textContent = winner.stall.name;
  winnerElements.zone.textContent =
    winner.zone.title || `${formatLabel(winner.zone.zone)} Zone`;
  winnerElements.rating.textContent = `Average Rating: ${winner.average.toFixed(
    2
  )} ⭐ (${winner.totalRatings} vote${winner.totalRatings === 1 ? "" : "s"})`;
  const reactionIndex = Math.round(Math.min(Math.max(winner.average, 1), 5));
  winnerElements.reaction.textContent =
    reactionsMap[reactionIndex] || "This stall wowed the crowd!";

  winnerElements.overlay.classList.add("show");
  winnerElements.overlay.setAttribute("aria-hidden", "false");

  startWinnerCountdown();
};

const attachAdminHandlers = () => {
  if (!adminElements.openBtn || !adminElements.modal) return;

  adminElements.openBtn.addEventListener("click", openAdminModal);
  adminElements.closeBtn?.addEventListener("click", closeAdminModal);

  adminElements.modal
    .querySelectorAll("[data-close-modal]")
    .forEach((element) => element.addEventListener("click", closeAdminModal));

  adminElements.loginForm?.addEventListener("submit", handleAdminLogin);
  adminElements.resetBtn?.addEventListener("click", resetRatings);
  adminElements.unlockBtn?.addEventListener(
    "click",
    unlockFeedbackFromAdmin
  );
  adminElements.exportBtn?.addEventListener("click", exportRatings);
  adminElements.winnerBtn?.addEventListener("click", triggerWinnerReveal);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && adminElements.modal?.classList.contains("show")) {
      closeAdminModal();
    }
    if (event.key === "Escape" && winnerElements.overlay?.classList.contains("show")) {
      closeWinnerOverlay();
    }
  });
};

const initAdminPanel = () => {
  cacheAdminElements();
  cacheWinnerElements();

  if (adminElements.openBtn) {
    attachAdminHandlers();
  }

  winnerElements.closeBtn?.addEventListener("click", closeWinnerOverlay);
  winnerElements.backdrop?.addEventListener("click", closeWinnerOverlay);
};

const showUserModal = () => {
  if (!userElements.modal) return;
  userElements.modal.classList.add("show");
  userElements.modal.setAttribute("aria-hidden", "false");
  setUserError("");
  userElements.form?.reset();
  requestAnimationFrame(() => {
    userElements.name?.focus();
  });
};

const closeUserModal = () => {
  if (!userElements.modal) return;
  userElements.modal.classList.remove("show");
  userElements.modal.setAttribute("aria-hidden", "true");
};

const handleUserSubmit = (event) => {
  event.preventDefault();

  const name = userElements.name?.value.trim() || "";
  const course = userElements.course?.value.trim() || "";

  if (!name || !course) {
    setUserError("Please share both your name and course to continue.");
    return;
  }

  try {
    localStorage.setItem(
      userInfoKey,
      JSON.stringify({
        name,
        course,
        capturedAt: Date.now(),
      })
    );
    setUserError("");
    closeUserModal();
  } catch (error) {
    console.error("Failed to save user info", error);
    setUserError(
      "We could not save your info. Please check storage settings and try again."
    );
  }
};

const ensureUserProfile = () => {
  if (!userElements.form || !userElements.modal) return;

  const existing = getUserInfo();
  if (!existing?.name || !existing?.course) {
    showUserModal();
  }

  userElements.form.addEventListener("submit", handleUserSubmit);
};

const initApp = async () => {
  // Ensure Firebase is initialized
  if (typeof firebase !== 'undefined' && !db) {
    initFirebase();
    // Wait a bit for Firebase to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  cacheUserElements();
  ensureUserProfile();
  await loadStallsConfig();
  renderStallCards();
  pruneUnknownRatings();
  hydrateView();
  initAdminPanel();
  
  // Load summary from Firebase if available
  if (db) {
    await refreshSummary();
  }
};

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

