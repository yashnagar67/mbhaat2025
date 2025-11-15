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

// Normalize userName: convert to lowercase and remove all spaces
const normalizeUserName = (userName) => {
  if (!userName || typeof userName !== 'string') return '';
  return userName.toLowerCase().replace(/\s+/g, '');
};

// Check if user has already rated this stall
const hasUserRatedStall = async (stallId, userName, userCourse) => {
  if (!db || !stallId || !userName || !userCourse) return false;
  
  try {
    const normalizedUserName = normalizeUserName(userName);
    const normalizedCourse = userCourse.toLowerCase().trim();
    
    // Get the stall document
    const stallDoc = await db.collection("stalls").doc(stallId).get();
    
    if (!stallDoc.exists) {
      return false; // Stall doesn't exist yet, so no duplicate
    }
    
    const stallData = stallDoc.data();
    const ratings = stallData.ratings || [];
    
    // Check if any rating matches the normalized userName + userCourse
    const hasRated = ratings.some((rating) => {
      const existingNormalizedName = rating.userNameNormalized || normalizeUserName(rating.userName || '');
      const existingCourse = (rating.userCourse || '').toLowerCase().trim();
      
      return existingNormalizedName === normalizedUserName && 
             existingCourse === normalizedCourse;
    });
    
    return hasRated;
  } catch (error) {
    console.error("Error checking duplicate rating:", error);
    // If there's an error checking, allow submission to proceed
    return false;
  }
};

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
  
  // Improved event handling with debouncing and touch support
  let isSubmitting = false;
  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isSubmitting || isStallSubmitted(stall.id)) return;
    
    isSubmitting = true;
    submitButton.disabled = true;
    
    try {
      await handleStallSubmit(stall.id);
    } catch (error) {
      console.error("Submit error:", error);
    } finally {
      // Re-enable after a short delay to prevent double-clicks
      setTimeout(() => {
        isSubmitting = false;
        if (!isStallSubmitted(stall.id)) {
          submitButton.disabled = false;
        }
      }, 500);
    }
  };
  
  submitButton.addEventListener("click", handleClick);
  submitButton.addEventListener("touchend", handleClick, { passive: false });

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

  // Add swipe functionality
  addSwipeHandlers(card, stall.id);

  return card;
};

// Swipe rating functionality
const addSwipeHandlers = (card, stallId) => {
  if (isStallSubmitted(stallId)) return; // Don't add swipe to submitted cards

  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let currentY = 0;
  let isSwiping = false;
  let swipeDirection = null;

  // Create swipe overlay for visual feedback
  const swipeOverlay = document.createElement("div");
  swipeOverlay.className = "swipe-overlay";
  swipeOverlay.innerHTML = `
    <div class="swipe-indicator swipe-indicator--right">
      <span class="swipe-emoji">⭐</span>
      <span class="swipe-text">5 Stars!</span>
    </div>
    <div class="swipe-indicator swipe-indicator--left">
      <span class="swipe-emoji">😕</span>
      <span class="swipe-text">1 Star</span>
    </div>
    <div class="swipe-indicator swipe-indicator--up">
      <span class="swipe-emoji">👍</span>
      <span class="swipe-text">4 Stars</span>
    </div>
    <div class="swipe-indicator swipe-indicator--down">
      <span class="swipe-emoji">👎</span>
      <span class="swipe-text">2 Stars</span>
    </div>
  `;
  card.appendChild(swipeOverlay);

  const handleStart = (clientX, clientY, target) => {
    if (isStallSubmitted(stallId)) return;
    
    // Don't start swipe if clicking on interactive elements
    if (target.closest('.star') || 
        target.closest('.stall-card__submit') || 
        target.closest('button') ||
        target.closest('a')) {
      return;
    }
    
    startX = clientX;
    startY = clientY;
    isSwiping = false;
    card.classList.add("swipe-active");
  };

  const handleMove = (clientX, clientY) => {
    if (isStallSubmitted(stallId)) return;
    
    currentX = clientX - startX;
    currentY = clientY - startY;
    const distance = Math.sqrt(currentX * currentX + currentY * currentY);

    if (distance > 10) {
      isSwiping = true;
      const angle = Math.atan2(currentY, currentX) * (180 / Math.PI);
      
      // Determine swipe direction
      if (Math.abs(currentX) > Math.abs(currentY)) {
        swipeDirection = currentX > 0 ? "right" : "left";
      } else {
        swipeDirection = currentY > 0 ? "down" : "up";
      }

      // Update card position and rotation
      const rotation = currentX * 0.1;
      card.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rotation}deg)`;
      card.style.transition = "none";

      // Show swipe indicator
      swipeOverlay.classList.add("swipe-active");
      swipeOverlay.classList.add(`swipe-${swipeDirection}`);
      
      // Calculate rating based on swipe distance and direction
      const maxDistance = 150;
      const normalizedDistance = Math.min(distance / maxDistance, 1);
      
      let rating = 0;
      if (swipeDirection === "right") {
        rating = Math.max(1, Math.round(3 + normalizedDistance * 2)); // 3-5 stars
      } else if (swipeDirection === "up") {
        rating = 4; // 4 stars
      } else if (swipeDirection === "down") {
        rating = 2; // 2 stars
      } else if (swipeDirection === "left") {
        rating = 1; // 1 star
      }

      // Update swipe indicator text
      const indicator = swipeOverlay.querySelector(`.swipe-indicator--${swipeDirection}`);
      if (indicator) {
        const textEl = indicator.querySelector(".swipe-text");
        if (swipeDirection === "right") {
          textEl.textContent = `${rating} Stars! ⭐`;
        } else if (swipeDirection === "up") {
          textEl.textContent = "4 Stars 👍";
        } else if (swipeDirection === "down") {
          textEl.textContent = "2 Stars 👎";
        } else {
          textEl.textContent = "1 Star 😕";
        }
      }
    }
  };

  const handleEnd = () => {
    if (!isSwiping || isStallSubmitted(stallId)) {
      resetCard();
      return;
    }

    const distance = Math.sqrt(currentX * currentX + currentY * currentY);
    const threshold = 80; // Minimum swipe distance

    if (distance > threshold) {
      // Calculate rating
      const maxDistance = 150;
      const normalizedDistance = Math.min(distance / maxDistance, 1);
      
      let rating = 0;
      if (swipeDirection === "right") {
        rating = Math.max(3, Math.round(3 + normalizedDistance * 2)); // 3-5 stars
      } else if (swipeDirection === "up") {
        rating = 4;
      } else if (swipeDirection === "down") {
        rating = 2;
      } else if (swipeDirection === "left") {
        rating = 1;
      }

      // Apply rating
      if (rating > 0) {
        state.ratings[stallId] = rating;
        saveToStorage();
        highlightSelectedStars();
        updateReactions();
        updateCardSubmissionState(stallId);
        maybeShowBadge();
        
        // Animate card out
        const exitX = swipeDirection === "right" ? window.innerWidth : 
                     swipeDirection === "left" ? -window.innerWidth : currentX;
        const exitY = swipeDirection === "up" ? -window.innerHeight :
                     swipeDirection === "down" ? window.innerHeight : currentY;
        
        card.style.transform = `translate(${exitX}px, ${exitY}px) rotate(${currentX * 0.2}deg)`;
        card.style.opacity = "0";
        card.style.transition = "all 0.4s ease-out";
        
        setTimeout(() => {
          resetCard();
          card.style.opacity = "1";
        }, 400);
      } else {
        resetCard();
      }
    } else {
      resetCard();
    }
  };

  const resetCard = () => {
    card.style.transform = "";
    card.style.transition = "";
    card.style.opacity = "";
    card.classList.remove("swipe-active");
    swipeOverlay.classList.remove("swipe-active", "swipe-right", "swipe-left", "swipe-up", "swipe-down");
    isSwiping = false;
    startX = 0;
    startY = 0;
    currentX = 0;
    currentY = 0;
  };

  // Touch events
  card.addEventListener("touchstart", (e) => {
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    
    // Don't prevent default if clicking on interactive elements
    if (target && (target.closest('.star') || 
                   target.closest('.stall-card__submit') || 
                   target.closest('button'))) {
      return;
    }
    
    e.preventDefault();
    handleStart(touch.clientX, touch.clientY, target);
  }, { passive: false });

  card.addEventListener("touchmove", (e) => {
    if (!isSwiping && !card.classList.contains("swipe-active")) return;
    e.preventDefault();
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
  }, { passive: false });

  card.addEventListener("touchend", (e) => {
    if (!isSwiping && !card.classList.contains("swipe-active")) return;
    e.preventDefault();
    handleEnd();
  }, { passive: false });

  // Mouse events (for desktop)
  card.addEventListener("mousedown", (e) => {
    // Don't start swipe if clicking on interactive elements
    if (e.target.closest('.star') || 
        e.target.closest('.stall-card__submit') || 
        e.target.closest('button') ||
        e.target.closest('a')) {
      return;
    }
    
    e.preventDefault();
    handleStart(e.clientX, e.clientY, e.target);
    
    const handleMouseMove = (e) => {
      if (!isSwiping && !card.classList.contains("swipe-active")) {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        return;
      }
      handleMove(e.clientX, e.clientY);
    };
    
    const handleMouseUp = () => {
      handleEnd();
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  });
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
    // Get all stall documents
    const stallsSnapshot = await db.collection("stalls").get();
    const summary = [];
    
    stallsSnapshot.forEach((doc) => {
      const data = doc.data();
      const stallId = data.stallId || doc.id;
      
      if (!stallId) return;
      
      // Use stored values or calculate from ratings array
      const totalRatings = data.totalRatings || (data.ratings || []).length;
      const sumRatings = data.sumRatings || 
        (data.ratings || []).reduce((sum, r) => sum + (r.stars || r.rating || 0), 0);
      const average = data.average || (totalRatings > 0 ? sumRatings / totalRatings : 0);
      
      summary.push({
        stallId: stallId,
        id: stallId,
        totalRatings: totalRatings,
        sumRatings: sumRatings,
        average: average,
      });
    });

    appData.summary = summary;
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

  setCardStatus(stallId, "Checking for duplicate...");

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

  // Check if user has already rated this stall
  const alreadyRated = await hasUserRatedStall(
    stallId,
    userInfo.name,
    userInfo.course
  );

  if (alreadyRated) {
    setCardStatus(
      stallId,
      "⚠️ You have already rated this stall!",
      "error"
    );
    if (submitButton) {
      submitButton.disabled = false;
    }
    return;
  }

  setCardStatus(stallId, "Saving your feedback...");

  try {
    const ratingValue = state.ratings[stallId];
    const reaction = reactionsMap[ratingValue] || "";
    const normalizedUserName = normalizeUserName(userInfo.name);

    // Create new rating object
    // Note: Cannot use FieldValue.serverTimestamp() inside arrays
    // Using regular Date object instead
    const now = new Date();
    const newRating = {
      stars: ratingValue,
      rating: ratingValue, // Alternative field name for compatibility
      userName: userInfo.name,
      userNameNormalized: normalizedUserName,
      userCourse: userInfo.course,
      reaction: reaction,
      timestamp: now.toISOString(),
      timestampMillis: now.getTime(), // Store as milliseconds for easy sorting
      createdAt: now.toISOString(),
    };

    // Get or create stall document
    const stallRef = db.collection("stalls").doc(stallId);
    const stallDoc = await stallRef.get();

    if (stallDoc.exists) {
      // Update existing stall document
      const stallData = stallDoc.data();
      const ratings = stallData.ratings || [];
      
      // Add new rating to array
      ratings.push(newRating);
      
      // Calculate new totals
      const totalRatings = ratings.length;
      const sumRatings = ratings.reduce((sum, r) => sum + (r.stars || r.rating || 0), 0);
      const average = sumRatings / totalRatings;
      
      // Update the stall document
      await stallRef.update({
        ratings: ratings,
        totalRatings: totalRatings,
        sumRatings: sumRatings,
        average: average,
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      // Create new stall document
      await stallRef.set({
        stallId: stallId,
        ratings: [newRating],
        totalRatings: 1,
        sumRatings: ratingValue,
        average: ratingValue,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
      });
    }

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
    // Get all stall documents
    const stallsSnapshot = await db.collection("stalls").get();
    const allStalls = [];
    
    stallsSnapshot.forEach((doc) => {
      const data = doc.data();
      allStalls.push({
        id: doc.id,
        ...data,
      });
    });

    // Flatten ratings for backward compatibility
    const allRatings = [];
    allStalls.forEach((stall) => {
      if (stall.ratings && Array.isArray(stall.ratings)) {
        stall.ratings.forEach((rating) => {
          allRatings.push({
            ...rating,
            stallId: stall.stallId || stall.id,
          });
        });
      }
    });

    const data = {
      stalls: allStalls, // New structure: each stall as a document
      ratings: allRatings, // Flattened for backward compatibility
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
      // Delete all stall documents (which contain all ratings)
      const stallsSnapshot = await db.collection("stalls").get();
      
      stallsSnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      console.log("All stalls and ratings deleted from Firebase");
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

    // Calculate logarithmic score: Average × log10(votes + 10)
    const score = avg * Math.log10(votes + 10);

    if (!best) {
      return { ...entry, score };
    }

    // Calculate best's score
    const bestVotes = best.totalRatings || 0;
    const bestAvg = best.average ?? 0;
    const bestScore = bestAvg * Math.log10(bestVotes + 10);

    // Compare scores
    if (score > bestScore) return { ...entry, score };
    // If scores are equal, prefer more votes
    if (score === bestScore && votes > bestVotes) return { ...entry, score };
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

const handleSubmitAllRatings = async () => {
  const submitBtn = document.getElementById("submitFeedback");
  const statusMsg = document.getElementById("statusMessage");
  
  if (!submitBtn || !statusMsg) return;

  const userInfo = getUserInfo();
  if (!userInfo?.name || !userInfo?.course) {
    statusMsg.textContent = "Please complete your profile first!";
    statusMsg.style.color = "#e63946";
    showUserModal();
    return;
  }

  const allStallIds = getAllStallIds();
  const unsubmittedRatings = allStallIds.filter(
    (stallId) => state.ratings[stallId] && !isStallSubmitted(stallId)
  );

  if (unsubmittedRatings.length === 0) {
    statusMsg.textContent = "All ratings have been submitted! 🎉";
    statusMsg.style.color = "#6bcb77";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting... ⏳";
  statusMsg.textContent = `Submitting ${unsubmittedRatings.length} rating(s)...`;
  statusMsg.style.color = "#4d96a9";

  let successCount = 0;
  let errorCount = 0;

  for (const stallId of unsubmittedRatings) {
    try {
      await handleStallSubmit(stallId);
      successCount++;
    } catch (error) {
      console.error(`Error submitting ${stallId}:`, error);
      errorCount++;
    }
  }

  submitBtn.disabled = false;
  submitBtn.textContent = "Submit My Ratings 🍜🎯🎨";

  if (errorCount === 0) {
    statusMsg.textContent = `✅ Successfully submitted ${successCount} rating(s)!`;
    statusMsg.style.color = "#6bcb77";
  } else {
    statusMsg.textContent = `⚠️ Submitted ${successCount}, ${errorCount} failed. Please try again.`;
    statusMsg.style.color = "#ff8c42";
  }

  setTimeout(() => {
    statusMsg.textContent = "";
  }, 5000);
};

// Get next Monday at 00:00:00
const getNextMonday = () => {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate days until next Monday
  let daysUntilMonday;
  if (dayOfWeek === 0) {
    // If today is Sunday, next Monday is tomorrow
    daysUntilMonday = 1;
  } else if (dayOfWeek === 1) {
    // If today is Monday, check if it's past midnight
    const hours = now.getHours();
    if (hours === 0 && now.getMinutes() === 0 && now.getSeconds() === 0) {
      daysUntilMonday = 0; // It's exactly Monday 00:00:00
    } else {
      daysUntilMonday = 7; // Next Monday is 7 days away
    }
  } else {
    // For Tuesday-Saturday, calculate days until next Monday
    daysUntilMonday = 8 - dayOfWeek;
  }
  
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0); // Set to midnight
  
  return nextMonday;
};

// Countdown timer function
const startCountdown = () => {
  const targetDate = getNextMonday();
  
  const updateCountdown = () => {
    const now = new Date();
    const difference = targetDate - now;
    
    if (difference <= 0) {
      // Countdown finished
      document.getElementById("days").textContent = "00";
      document.getElementById("hours").textContent = "00";
      document.getElementById("minutes").textContent = "00";
      document.getElementById("seconds").textContent = "00";
      return;
    }
    
    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);
    
    document.getElementById("days").textContent = String(days).padStart(2, "0");
    document.getElementById("hours").textContent = String(hours).padStart(2, "0");
    document.getElementById("minutes").textContent = String(minutes).padStart(2, "0");
    document.getElementById("seconds").textContent = String(seconds).padStart(2, "0");
  };
  
  // Update immediately
  updateCountdown();
  
  // Update every second
  setInterval(updateCountdown, 1000);
};

const initApp = async () => {
  // Ensure Firebase is initialized
  if (typeof firebase !== 'undefined' && !db) {
    initFirebase();
    // Wait a bit for Firebase to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Start countdown timer
  startCountdown();
  
  // Initialize admin panel (still available for admin access)
  initAdminPanel();
  
  // Load summary from Firebase if available
  if (db) {
    await refreshSummary();
  }
};

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

