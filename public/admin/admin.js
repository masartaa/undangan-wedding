const loginPanel = document.querySelector("#login-panel");
const dashboardPanel = document.querySelector("#dashboard-panel");
const loginForm = document.querySelector("#login-form");
const eventForm = document.querySelector("#event-form");
const loginStatus = document.querySelector("#login-status");
const eventStatus = document.querySelector("#event-status");
const globalStatus = document.querySelector("#global-status");
const loginButton = document.querySelector("#login-submit");
const saveButton = document.querySelector("#save-button");
const logoutButton = document.querySelector("#logout-button");

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {})
    },
    ...options
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("Respons server tidak valid.");
  }
  return { response, result };
};

const setSignedIn = (signedIn) => {
  loginPanel.hidden = signedIn;
  dashboardPanel.hidden = !signedIn;
  globalStatus.textContent = "";
};

const fillEventForm = (config) => {
  const event = config.event;
  document.querySelector("#event-date").value = event.start.slice(0, 10);
  document.querySelector("#event-start").value = event.start.slice(11, 16);
  document.querySelector("#event-end").value = event.end.slice(11, 16);
  document.querySelector("#venue-name").value = event.venue_name;
  document.querySelector("#venue-address").value = event.venue_address;
  document.querySelector("#maps-url").value = event.maps_url;
};

const loadDashboard = async () => {
  const { response: sessionResponse } = await requestJson("/api/admin/session");
  if (sessionResponse.status === 401) {
    setSignedIn(false);
    return;
  }
  if (!sessionResponse.ok) {
    throw new Error("Status login belum dapat diperiksa.");
  }

  const { response, result } = await requestJson("/api/admin/config");
  if (!response.ok || !result.event) {
    throw new Error(result.error || "Konfigurasi acara belum dapat dimuat.");
  }

  fillEventForm(result);
  setSignedIn(true);
};

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!loginForm.reportValidity()) {
    return;
  }

  loginStatus.textContent = "";
  loginButton.disabled = true;
  loginButton.textContent = "Memeriksa...";
  try {
    const formData = new FormData(loginForm);
    const { response, result } = await requestJson("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({
        username: formData.get("username"),
        password: formData.get("password")
      })
    });

    if (!response.ok) {
      loginStatus.textContent = result.error || "Login gagal. Periksa kembali data Anda.";
      return;
    }

    loginForm.reset();
    await loadDashboard();
  } catch (error) {
    console.error("Login admin gagal.", error);
    loginStatus.textContent = "Login belum dapat diproses. Silakan coba lagi.";
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Masuk";
  }
});

eventForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!eventForm.reportValidity()) {
    return;
  }

  eventStatus.textContent = "";
  saveButton.disabled = true;
  saveButton.textContent = "Menyimpan...";
  try {
    const formData = new FormData(eventForm);
    const { response, result } = await requestJson("/api/admin/config", {
      method: "PUT",
      body: JSON.stringify(Object.fromEntries(formData))
    });

    if (!response.ok) {
      eventStatus.textContent = result.error || "Perubahan belum dapat disimpan.";
      return;
    }

    fillEventForm(result.config);
    eventStatus.textContent = "Perubahan berhasil disimpan.";
  } catch (error) {
    console.error("Konfigurasi acara gagal disimpan.", error);
    eventStatus.textContent = "Perubahan belum dapat disimpan. Silakan coba lagi.";
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Simpan perubahan";
  }
});

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  try {
    const { response, result } = await requestJson("/api/admin/logout", { method: "POST" });
    if (!response.ok) {
      throw new Error(result.error || "Logout belum dapat diproses.");
    }
    setSignedIn(false);
  } catch (error) {
    console.error("Logout admin gagal.", error);
    globalStatus.textContent = "Logout belum dapat diproses. Silakan coba lagi.";
  } finally {
    logoutButton.disabled = false;
  }
});

loadDashboard().catch((error) => {
  console.error("Dashboard admin gagal dimuat.", error);
  globalStatus.textContent = "Dashboard belum dapat dimuat. Periksa koneksi, lalu coba lagi.";
});
