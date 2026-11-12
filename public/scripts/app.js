const nav = document.querySelector("#bottom-nav");
const openInvitationButton = document.querySelector("#open-invitation");
const calendarButton = document.querySelector("#calendar-download");
const musicButton = document.querySelector("#music-toggle");
const musicLabel = document.querySelector("#music-label");
const musicStatus = document.querySelector("#music-status");
const musicPlayer = document.querySelector("#background-music");
const configError = document.querySelector("#config-error");
const wishesForm = document.querySelector("#wishes-form");
const wishNameInput = document.querySelector("#wish-name");
const wishesFormStatus = document.querySelector("#wishes-form-status");
const wishesList = document.querySelector("#wishes-list");
const wishesListStatus = document.querySelector("#wishes-list-status");
const wishesEmptyState = document.querySelector("#wishes-empty");
const wishesLoadMoreButton = document.querySelector("#wishes-load-more");
const wishSubmitButton = document.querySelector("#wish-submit");
const MAX_GUEST_NAME_LENGTH = 80;
const WISH_PAGE_SIZE = 10;

let wishesPage = 1;
let wishesHaveMore = true;
let wishesLoading = false;
let wishesReloadRequested = false;

const requireText = (value, label) => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Konfigurasi "${label}" harus berupa teks yang tidak kosong.`);
  }

  return value.trim();
};

const setText = (selector, value) => {
  for (const element of document.querySelectorAll(selector)) {
    element.textContent = value;
  }
};

const formatDate = (date, timeZone, options) =>
  new Intl.DateTimeFormat("id-ID", { ...options, timeZone }).format(date);

const getSafeHttpsUrl = (value, label) => {
  const url = new URL(requireText(value, label));

  if (url.protocol !== "https:") {
    throw new Error(`Konfigurasi "${label}" harus menggunakan HTTPS.`);
  }

  return url.href;
};

const getGuestName = () => {
  const requestedName = new URLSearchParams(window.location.search).get("to");
  const name = requestedName?.trim();
  return name ? Array.from(name).slice(0, MAX_GUEST_NAME_LENGTH).join("") : "";
};

const showGuestName = () => {
  const guestName = getGuestName();

  document.querySelector("#guest-name").textContent = guestName || "Bapak/Ibu/Saudara/i";
  wishNameInput.value = guestName;
};

const updateCountdown = (start, end) => {
  const dayElement = document.querySelector('[data-countdown="days"]');
  const hourElement = document.querySelector('[data-countdown="hours"]');
  const minuteElement = document.querySelector('[data-countdown="minutes"]');
  const secondElement = document.querySelector('[data-countdown="seconds"]');
  const statusElement = document.querySelector("#countdown-status");
  let previousStatus = "";

  const tick = () => {
    const now = Date.now();
    const remaining = start.getTime() - now;
    const nextStatus =
      remaining > 0
        ? ""
        : now < end.getTime()
          ? "Acara sedang berlangsung."
          : "Acara telah berlangsung. Terima kasih atas doa dan restunya.";

    if (nextStatus !== previousStatus) {
      statusElement.textContent = nextStatus;
      previousStatus = nextStatus;
    }

    if (remaining <= 0) {
      dayElement.textContent = "000";
      hourElement.textContent = "00";
      minuteElement.textContent = "00";
      secondElement.textContent = "00";
      return nextStatus !== "";
    }

    const seconds = Math.floor(remaining / 1000);
    dayElement.textContent = String(Math.floor(seconds / 86400)).padStart(3, "0");
    hourElement.textContent = String(Math.floor((seconds % 86400) / 3600)).padStart(2, "0");
    minuteElement.textContent = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    secondElement.textContent = String(seconds % 60).padStart(2, "0");
    return false;
  };

  if (!tick()) {
    const countdownInterval = window.setInterval(() => {
      if (tick()) {
        window.clearInterval(countdownInterval);
      }
    }, 1000);
  }
};

const escapeCalendarText = (value) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");

const formatCalendarDate = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const foldCalendarLine = (line) => {
  const encoder = new TextEncoder();
  let foldedLine = "";
  let byteLength = 0;

  for (const character of line) {
    const characterLength = encoder.encode(character).length;
    if (byteLength + characterLength > 75) {
      foldedLine += "\r\n ";
      byteLength = 1;
    }

    foldedLine += character;
    byteLength += characterLength;
  }

  return foldedLine;
};

const downloadCalendarInvite = (event, groomName, brideName) => {
  const stamp = formatCalendarDate(new Date());
  const start = formatCalendarDate(event.start);
  const end = formatCalendarDate(event.end);
  const summary = escapeCalendarText(`Resepsi Pernikahan: ${groomName} & ${brideName}`);
  const location = escapeCalendarText(`${event.venueName}, ${event.venueAddress}`);
  const description = escapeCalendarText(`Resepsi pernikahan. ${event.mapsUrl}`);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Undangan Pernikahan//ID",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    "UID:resepsi-20270103@undangan-wedding.vercel.app",
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${summary}`,
    `LOCATION:${location}`,
    `DESCRIPTION:${description}`,
    `URL:${event.mapsUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
    ""
  ];
  const file = new Blob([lines.map(foldCalendarLine).join("\r\n")], {
    type: "text/calendar;charset=utf-8"
  });
  const fileUrl = URL.createObjectURL(file);
  const downloadLink = document.createElement("a");

  downloadLink.href = fileUrl;
  downloadLink.download = "undangan-pernikahan.ics";
  downloadLink.hidden = true;
  document.body.append(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  window.setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
};

const setMetaContent = (selector, value) => {
  const element = document.querySelector(selector);
  if (element) {
    element.setAttribute("content", value);
  }
};

const createWishCard = (wish) => {
  const card = document.createElement("article");
  card.className = "wish-card";

  const name = document.createElement("h4");
  name.className = "wish-card__name";
  name.textContent = wish.name;
  card.append(name);

  const date = document.createElement("time");
  date.className = "wish-card__date";

  const createdAt =
    typeof wish.created_at === "string" && !/(?:Z|[+-]\d{2}:\d{2})$/i.test(wish.created_at)
      ? `${wish.created_at.replace(" ", "T")}Z`
      : wish.created_at;
  const parsedDate = new Date(createdAt);

  if (!Number.isNaN(parsedDate.getTime())) {
    date.dateTime = parsedDate.toISOString();
    date.textContent = formatDate(parsedDate, "Asia/Jakarta", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    });
  }

  card.append(date);

  const message = document.createElement("p");
  message.className = "wish-card__message";
  message.textContent = wish.message;
  card.append(message);
  return card;
};

const loadWishes = async ({ reset = false } = {}) => {
  if (wishesLoading) {
    wishesReloadRequested ||= reset;
    return;
  }

  if (!wishesHaveMore && !reset) {
    return;
  }

  if (reset) {
    wishesPage = 1;
    wishesHaveMore = true;
    wishesList.replaceChildren();
    wishesEmptyState.hidden = true;
    wishesListStatus.textContent = "Memuat ucapan...";
  }

  wishesLoading = true;
  wishesLoadMoreButton.hidden = false;
  wishesLoadMoreButton.disabled = true;
  wishesLoadMoreButton.textContent = "Memuat...";

  try {
    const response = await fetch(`/api/wishes?page=${wishesPage}`, {
      headers: { Accept: "application/json" }
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error("Daftar ucapan belum dapat dimuat. Silakan coba lagi.");
    }

    if (
      !Array.isArray(result.wishes) ||
      result.wishes.length > WISH_PAGE_SIZE ||
      typeof result.hasMore !== "boolean" ||
      result.wishes.some(
        (wish) =>
          typeof wish.name !== "string" ||
          typeof wish.message !== "string" ||
          typeof wish.created_at !== "string"
      )
    ) {
      throw new Error("Daftar ucapan menerima data yang tidak valid.");
    }

    for (const wish of result.wishes) {
      wishesList.append(createWishCard(wish));
    }

    wishesHaveMore = result.hasMore;
    wishesPage += 1;
    wishesListStatus.textContent = "";
    wishesEmptyState.hidden = wishesList.childElementCount > 0;
    wishesLoadMoreButton.hidden = !wishesHaveMore;
    wishesLoadMoreButton.textContent = "Muat lebih banyak";
  } catch (error) {
    console.error("Daftar ucapan gagal dimuat.", error);
    wishesHaveMore = true;
    wishesListStatus.textContent =
      wishesPage === 1
        ? "Ucapan belum dapat dimuat. Periksa koneksi, lalu coba lagi."
        : "Ucapan berikutnya belum dapat dimuat. Silakan coba lagi.";
    wishesLoadMoreButton.textContent = "Coba lagi";
  } finally {
    wishesLoading = false;
    wishesLoadMoreButton.disabled = false;

    if (wishesReloadRequested) {
      wishesReloadRequested = false;
      void loadWishes({ reset: true });
    }
  }
};

const submitWish = async (event) => {
  event.preventDefault();

  if (!wishesForm.reportValidity()) {
    return;
  }

  const name = wishNameInput.value.trim().normalize("NFC");
  const message = document.querySelector("#wish-message").value.trim().normalize("NFC");

  if (!name || !message) {
    wishesFormStatus.textContent = "Nama dan ucapan tidak boleh kosong.";
    return;
  }

  wishesFormStatus.textContent = "";
  wishSubmitButton.disabled = true;
  wishSubmitButton.textContent = "Mengirim...";

  try {
    const response = await fetch("/api/wishes", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        name,
        message,
        website: document.querySelector("#wish-website").value
      })
    });
    const result = await response.json();

    if (response.status === 429) {
      wishesFormStatus.textContent = "Batas kiriman tercapai. Silakan coba lagi beberapa saat lagi.";
      return;
    }

    if (!response.ok) {
      wishesFormStatus.textContent =
        response.status === 400 && typeof result.error === "string"
          ? result.error
          : "Ucapan belum dapat dikirim. Silakan coba lagi.";
      return;
    }

    wishesForm.reset();
    showGuestName();
    wishesFormStatus.textContent = "Terima kasih, ucapan dan doa Anda berhasil dikirim.";
    await loadWishes({ reset: true });
  } catch (error) {
    console.error("Ucapan gagal dikirim.", error);
    wishesFormStatus.textContent = "Ucapan belum terkirim. Periksa koneksi, lalu coba lagi.";
  } finally {
    wishSubmitButton.disabled = false;
    wishSubmitButton.textContent = "Kirim Ucapan";
  }
};

const loadConfig = async () => {
  const response = await fetch("/api/config", {
    cache: "no-store",
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(`Gagal memuat konfigurasi undangan (${response.status}).`);
  }

  const config = await response.json();
  const eventConfig = config.event;
  const timeZone = requireText(eventConfig.time_zone, "event.time_zone");
  const start = new Date(requireText(eventConfig.start, "event.start"));
  const end = new Date(requireText(eventConfig.end, "event.end"));
  const groomName = requireText(config.couple.groom.name, "couple.groom.name");
  const brideName = requireText(config.couple.bride.name, "couple.bride.name");
  const mapsUrl = getSafeHttpsUrl(eventConfig.maps_url, "event.maps_url");

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    throw new Error("Tanggal dan waktu acara di konfigurasi tidak valid.");
  }

  setText('[data-couple-name="groom"]', groomName);
  setText('[data-couple-name="bride"]', brideName);
  setText('[data-parent-names="groom"]', requireText(config.couple.groom.parents, "couple.groom.parents"));
  setText('[data-parent-names="bride"]', requireText(config.couple.bride.parents, "couple.bride.parents"));
  setText('[data-initial="groom"]', Array.from(groomName)[0].toLocaleUpperCase("id-ID"));
  setText('[data-initial="bride"]', Array.from(brideName)[0].toLocaleUpperCase("id-ID"));
  setText("[data-welcome-message]", requireText(config.welcome_message, "welcome_message"));

  const eventDate = formatDate(start, timeZone, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const eventTime = `${formatDate(start, timeZone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}–${formatDate(end, timeZone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })} WIB`;

  setText("[data-event-date]", eventDate);
  setText("[data-event-time]", eventTime);
  setText("[data-venue-name]", requireText(eventConfig.venue_name, "event.venue_name"));
  setText("[data-venue-address]", requireText(eventConfig.venue_address, "event.venue_address"));
  document.querySelector("[data-maps-link]").href = mapsUrl;
  updateCountdown(start, end);

  const seoTitle = requireText(config.seo.title, "seo.title");
  const seoDescription = requireText(config.seo.description, "seo.description");
  const seoUrl = getSafeHttpsUrl(config.seo.url, "seo.url");
  const seoImage = getSafeHttpsUrl(config.seo.image, "seo.image");

  document.title = seoTitle;
  document.querySelector('link[rel="canonical"]').href = seoUrl;
  setMetaContent('meta[name="description"]', seoDescription);
  setMetaContent('meta[property="og:title"]', seoTitle);
  setMetaContent('meta[property="og:description"]', seoDescription);
  setMetaContent('meta[property="og:url"]', seoUrl);
  setMetaContent('meta[property="og:image"]', seoImage);
  setMetaContent('meta[property="og:image:secure_url"]', seoImage);
  setMetaContent('meta[name="twitter:title"]', seoTitle);
  setMetaContent('meta[name="twitter:description"]', seoDescription);
  setMetaContent('meta[name="twitter:image"]', seoImage);

  if (config.music !== null && config.music !== undefined) {
    const musicUrl = getSafeHttpsUrl(config.music.url, "music.url");
    musicPlayer.src = musicUrl;
    musicButton.disabled = false;
    musicButton.setAttribute("aria-pressed", "false");
    musicLabel.textContent = "Putar musik latar";
  }

  calendarButton.addEventListener("click", () =>
    downloadCalendarInvite(
      { start, end, venueName: eventConfig.venue_name, venueAddress: eventConfig.venue_address, mapsUrl },
      groomName,
      brideName
    )
  );
};

showGuestName();
wishesForm.addEventListener("submit", submitWish);
wishesLoadMoreButton.addEventListener("click", () => loadWishes());
void loadWishes({ reset: true });

openInvitationButton.addEventListener("click", () => {
  document.body.classList.add("invitation-open");
  nav.removeAttribute("inert");
  document.querySelector("#home").scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
  });
});

musicButton.addEventListener("click", async () => {
  if (musicPlayer.paused) {
    try {
      await musicPlayer.play();
    } catch (error) {
      console.error("Musik latar tidak dapat diputar.", error);
      musicStatus.textContent = "Musik latar tidak dapat diputar. Silakan coba lagi.";
    }
    return;
  }

  musicPlayer.pause();
});

musicPlayer.addEventListener("play", () => {
  musicLabel.textContent = "Jeda musik latar";
  musicButton.setAttribute("aria-pressed", "true");
  musicStatus.textContent = "Musik latar sedang diputar.";
});

musicPlayer.addEventListener("pause", () => {
  musicLabel.textContent = "Putar musik latar";
  musicButton.setAttribute("aria-pressed", "false");
  musicStatus.textContent = "Musik latar dijeda.";
});

musicPlayer.addEventListener("ended", () => {
  musicLabel.textContent = "Putar musik latar";
  musicButton.setAttribute("aria-pressed", "false");
  musicStatus.textContent = "Musik latar selesai.";
});

loadConfig().catch((error) => {
  console.error("Informasi undangan tidak dapat dimuat.", error);
  configError.hidden = false;
});
