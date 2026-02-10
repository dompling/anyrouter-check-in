const STORAGE_KEY = "anyrouter-config-v1";
const STORAGE_VERSION = 3;

const defaultState = {
  accounts: [
    {
      name: "",
      api_user: "",
      cookies: [{ key: "session", value: "" }],
      provider: "",
    },
  ],
  providers: [],
};

const elements = {
  accounts: document.getElementById("accounts"),
  providers: document.getElementById("providers"),
  accountsJson: document.getElementById("accountsJson"),
  providersJson: document.getElementById("providersJson"),
  addAccount: document.getElementById("addAccount"),
  copyAccounts: document.getElementById("copyAccounts"),
  copyProviders: document.getElementById("copyProviders"),
  clearCache: document.getElementById("clearCache"),
  cacheStatus: document.getElementById("cacheStatus"),
  cacheTime: document.getElementById("cacheTime"),
  importAccounts: document.getElementById("importAccounts"),
  importProviders: document.getElementById("importProviders"),
  importAccountsBtn: document.getElementById("importAccountsBtn"),
  importProvidersBtn: document.getElementById("importProvidersBtn"),
  importMessage: document.getElementById("importMessage"),
  openImport: document.getElementById("openImport"),
  importModal: document.getElementById("importModal"),
  closeImport: document.getElementById("closeImport"),
  openProviders: document.getElementById("openProviders"),
  providerModal: document.getElementById("providerModal"),
  closeProviders: document.getElementById("closeProviders"),
};

let state = loadState();
let lastSavedAt = state.savedAt || null;
let accountsSwiper = null;
let providersSwiper = null;
const modalState = {
  selectAccountIndex: null,
  providersFocusIndex: null,
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...defaultState, savedAt: null };
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.data) {
      return { ...defaultState, savedAt: null };
    }
    if (parsed.version === STORAGE_VERSION) {
      return { ...defaultState, ...parsed.data, savedAt: parsed.savedAt || null };
    }
    if (parsed.version === 2) {
      return migrateV2(parsed);
    }
    if (parsed.version === 1) {
      return migrateV1(parsed);
    }
    return { ...defaultState, savedAt: null };
  } catch (error) {
    return { ...defaultState, savedAt: null };
  }
}

function migrateV1(parsed) {
  const data = parsed.data || {};
  const accounts = Array.isArray(data.accounts)
    ? data.accounts.map((account) => ({
        name: account.name || "",
        api_user: account.api_user || "",
        cookies: Array.isArray(account.cookies) ? account.cookies : [{ key: "session", value: "" }],
        provider: account.provider || "",
      }))
    : defaultState.accounts;

  return {
    accounts,
    providers: Array.isArray(data.providers) ? data.providers : [],
    savedAt: parsed.savedAt || null,
  };
}

function migrateV2(parsed) {
  const data = parsed.data || {};
  const accounts = Array.isArray(data.accounts)
    ? data.accounts.map((account) => {
        const providerValue = Array.isArray(account.providers) ? account.providers[0] : account.provider;
        return {
          name: account.name || "",
          api_user: account.api_user || "",
          cookies: Array.isArray(account.cookies) ? account.cookies : [{ key: "session", value: "" }],
          provider: providerValue || "",
        };
      })
    : defaultState.accounts;

  return {
    accounts,
    providers: Array.isArray(data.providers) ? data.providers : [],
    savedAt: parsed.savedAt || null,
  };
}

function saveState() {
  lastSavedAt = Date.now();
  const payload = {
    version: STORAGE_VERSION,
    savedAt: lastSavedAt,
    data: {
      accounts: state.accounts,
      providers: state.providers,
    },
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  updateCacheMeta();
}

function updateCacheMeta() {
  if (!elements.cacheStatus || !elements.cacheTime) return;
  const cached = Boolean(localStorage.getItem(STORAGE_KEY));
  elements.cacheStatus.textContent = cached ? "已缓存" : "无缓存";
  elements.cacheTime.textContent = lastSavedAt
    ? new Date(lastSavedAt).toLocaleString("zh-CN", { hour12: false })
    : "-";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getProviderOptions() {
  const builtins = ["anyrouter", "agentrouter"];
  const custom = state.providers
    .map((provider) => (provider.key || "").trim())
    .filter(Boolean);
  const combined = [...builtins, ...custom];
  return Array.from(new Set(combined));
}

function render(focusIndex = null) {
  elements.accounts.innerHTML = renderAccounts();
  elements.providers.innerHTML = renderProviders();
  updateOutputs();
  updateCacheMeta();
  setupAccountsSwiper(focusIndex);
  setupProvidersSwiper(modalState.providersFocusIndex);
  modalState.providersFocusIndex = null;
}

function renderAccounts() {
  if (!state.accounts.length) {
    return `<div class="swiper-slide"><div class="card"><p>暂无账号配置，请点击“新增账号”。</p></div></div>`;
  }

  return state.accounts
    .map((account, index) => {
      const cookies = account.cookies.length
        ? account.cookies
        : [{ key: "session", value: "" }];

      const currentProvider = account.provider || "";
      const providerOptions = getProviderOptions();
      if (currentProvider && !providerOptions.includes(currentProvider)) {
        providerOptions.push(currentProvider);
      }

      return `
        <div class="swiper-slide">
          <div class="card" data-account-card="${index}">
            <div class="card-header">
              <strong>账号 ${index + 1}</strong>
            <div class="card-actions">
              <button class="secondary" data-copy-account="${index}">复制</button>
              <button class="ghost" data-remove-account="${index}">删除</button>
            </div>
            </div>
            <div class="field">
              <label>名称 (可选)</label>
              <input type="text" value="${escapeHtml(account.name)}" data-account-index="${index}" data-field="name" placeholder="例如：我的主账号" />
            </div>
            <div class="field">
              <label>API User</label>
              <input type="text" value="${escapeHtml(account.api_user)}" data-account-index="${index}" data-field="api_user" placeholder="例如：12345" />
            </div>
            <div class="field">
              <label>Provider (可选)</label>
              <select data-account-index="${index}" data-provider-select="true">
                <option value="">不设置</option>
                ${providerOptions
                  .map((providerKey) => {
                    const isSelected = providerKey === currentProvider;
                    return `
                      <option value="${escapeHtml(providerKey)}" ${isSelected ? "selected" : ""}>${escapeHtml(providerKey)}</option>
                    `;
                  })
                  .join("")}
              </select>
              <button class="secondary" data-add-provider="${index}">+ 配置 Provider</button>
              <p class="provider-note">如需新增 Provider，请先在弹窗中维护。</p>
            </div>
            <div class="field">
              <label>Cookies</label>
              <div class="cookie-list">
                ${cookies
                  .map(
                    (cookie, cookieIndex) => `
                      <div class="cookie-item">
                        <input type="text" value="${escapeHtml(cookie.key)}" data-account-index="${index}" data-cookie-index="${cookieIndex}" data-cookie-field="key" placeholder="cookie 名称" />
                        <input type="text" value="${escapeHtml(cookie.value)}" data-account-index="${index}" data-cookie-index="${cookieIndex}" data-cookie-field="value" placeholder="cookie 值" />
                        <button class="ghost" data-remove-cookie="${index}" data-cookie-index="${cookieIndex}">移除</button>
                      </div>
                    `
                  )
                  .join("")}
              </div>
              <button class="secondary" data-add-cookie="${index}">新增 Cookie</button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderProviders() {
  if (!state.providers.length) {
    return `
      <div class="swiper-slide">
        <div class="card provider-card">
          <p>暂无自定义 Provider，需要时可新增。</p>
          <button class="secondary" data-add-provider-item>新增服务商</button>
        </div>
      </div>
    `;
  }

  return state.providers
    .map((provider, index) => {
      const selectAction =
        modalState.selectAccountIndex !== null && provider.key
          ? `<button class="secondary" data-select-provider="${index}">设为当前账号</button>`
          : "";

      return `
        <div class="swiper-slide">
          <div class="card provider-card" data-provider-card="${index}">
            <div class="card-header">
            <strong>服务商 ${index + 1}</strong>
              <div class="card-actions provider-card-actions">
                <button class="secondary" data-add-provider-item>新增</button>
                ${selectAction}
                <button class="secondary" data-copy-provider="${index}">复制</button>
                <button class="ghost" data-remove-provider="${index}">删除</button>
              </div>
            </div>
            <div class="field">
            <label>服务商标识</label>
              <input type="text" value="${escapeHtml(provider.key)}" data-provider-index="${index}" data-provider-field="key" placeholder="例如：customrouter" />
            </div>
            <div class="field">
            <label>域名</label>
              <input type="text" value="${escapeHtml(provider.domain)}" data-provider-index="${index}" data-provider-field="domain" placeholder="https://custom.example.com" />
            </div>
            <div class="field">
            <label>登录路径 (可选)</label>
              <input type="text" value="${escapeHtml(provider.login_path)}" data-provider-index="${index}" data-provider-field="login_path" placeholder="/login" />
            </div>
            <div class="field">
            <label>签到路径 (可选)</label>
              <input type="text" value="${escapeHtml(provider.sign_in_path)}" data-provider-index="${index}" data-provider-field="sign_in_path" placeholder="/api/user/sign_in" />
            </div>
            <div class="field">
            <label>用户信息路径 (可选)</label>
              <input type="text" value="${escapeHtml(provider.user_info_path)}" data-provider-index="${index}" data-provider-field="user_info_path" placeholder="/api/user/self" />
            </div>
            <div class="field">
            <label>API 用户标识 (可选)</label>
              <input type="text" value="${escapeHtml(provider.api_user_key)}" data-provider-index="${index}" data-provider-field="api_user_key" placeholder="new-api-user" />
            </div>
            <div class="field">
            <label>绕过方式 (可选)</label>
              <input type="text" value="${escapeHtml(provider.bypass_method)}" data-provider-index="${index}" data-provider-field="bypass_method" placeholder="waf_cookies" />
            </div>
            <div class="field">
            <label>WAF Cookie 名称 (可选)</label>
              <input type="text" value="${escapeHtml(provider.waf_cookie_names)}" data-provider-index="${index}" data-provider-field="waf_cookie_names" placeholder="acw_tc, cdn_sec_tc" />
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function normalizeAccounts() {
  return state.accounts.map((account) => {
    return buildAccountPayload(account);
  });
}

function buildAccountPayload(account) {
  const cookies = {};
  (account.cookies || []).forEach((cookie) => {
    const key = (cookie.key || "").trim();
    if (key) {
      cookies[key] = cookie.value || "";
    }
  });

  const payload = {
    cookies,
    api_user: account.api_user || "",
  };

  if (account.name) {
    payload.name = account.name;
  }

  if (account.provider) {
    payload.provider = account.provider;
  }

  return payload;
}

function makeUniqueProviderKey(baseKey) {
  const existing = new Set(
    state.providers.map((provider) => (provider.key || "").trim()).filter(Boolean)
  );
  const seed = (baseKey || "").trim() || "provider";
  if (!existing.has(seed)) return seed;

  let index = 1;
  let candidate = `${seed}-copy`;
  while (existing.has(candidate)) {
    index += 1;
    candidate = `${seed}-copy-${index}`;
  }
  return candidate;
}

function normalizeProviders() {
  const providers = {};
  state.providers.forEach((provider) => {
    const key = (provider.key || "").trim();
    if (!key) return;

    const payload = {};
    if (provider.domain) payload.domain = provider.domain;
    if (provider.login_path) payload.login_path = provider.login_path;
    if (provider.sign_in_path) payload.sign_in_path = provider.sign_in_path;
    if (provider.user_info_path) payload.user_info_path = provider.user_info_path;
    if (provider.api_user_key) payload.api_user_key = provider.api_user_key;
    if (provider.bypass_method) payload.bypass_method = provider.bypass_method;

    if (provider.waf_cookie_names) {
      const names = provider.waf_cookie_names
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);
      if (names.length) {
        payload.waf_cookie_names = names;
      }
    }

    providers[key] = payload;
  });

  return providers;
}

function updateOutputs() {
  const accounts = normalizeAccounts();
  const providers = normalizeProviders();
  elements.accountsJson.value = JSON.stringify(accounts, null, 2);

  if (Object.keys(providers).length) {
    elements.providersJson.value = JSON.stringify(providers, null, 2);
  } else {
    elements.providersJson.value = "";
  }
}

function setupAccountsSwiper(focusIndex = null) {
  if (typeof Swiper === "undefined") return;

  const maxIndex = Math.max(0, state.accounts.length - 1);
  const targetIndex =
    focusIndex === null ? null : Math.min(Math.max(0, focusIndex), maxIndex);

  if (accountsSwiper) {
    accountsSwiper.destroy(true, true);
  }

  accountsSwiper = new Swiper(".accounts-swiper", {
    slidesPerView: 1,
    spaceBetween: 16,
    autoHeight: true,
    pagination: {
      el: ".accounts-swiper .swiper-pagination",
      clickable: true,
    },
    navigation: {
      nextEl: "#accountsNext",
      prevEl: "#accountsPrev",
    },
    observer: true,
    observeParents: true,
  });

  if (targetIndex !== null && accountsSwiper.slides.length) {
    accountsSwiper.slideTo(targetIndex, 0);
  }
}

function getActiveSlideIndex() {
  return accountsSwiper ? accountsSwiper.activeIndex : 0;
}

function setupProvidersSwiper(focusIndex = null) {
  if (typeof Swiper === "undefined") return;

  if (!elements.providerModal.classList.contains("is-open")) {
    if (providersSwiper) {
      providersSwiper.destroy(true, true);
      providersSwiper = null;
    }
    return;
  }

  const maxIndex = Math.max(0, state.providers.length - 1);
  const targetIndex =
    focusIndex === null ? null : Math.min(Math.max(0, focusIndex), maxIndex);

  if (providersSwiper) {
    providersSwiper.destroy(true, true);
  }

  requestAnimationFrame(() => {
    providersSwiper = new Swiper(".providers-swiper", {
      slidesPerView: 1,
      spaceBetween: 16,
      autoHeight: false,
      loop: false,
      pagination: {
        el: ".providers-swiper .swiper-pagination",
        clickable: true,
      },
      navigation: {
        nextEl: "#providersNext",
        prevEl: "#providersPrev",
      },
      observer: true,
      observeParents: true,
    });

    if (targetIndex !== null && providersSwiper.slides.length) {
      providersSwiper.slideTo(targetIndex, 0);
    }
    providersSwiper.update();
  });
}

function getActiveProviderIndex() {
  return providersSwiper ? providersSwiper.activeIndex : 0;
}

function copyToClipboard(value, message) {
  if (!value) {
    showImportMessage("暂无可复制内容。", true);
    return;
  }

  navigator.clipboard
    .writeText(value)
    .then(() => {
      showImportMessage(message, false);
    })
    .catch(() => {
      showImportMessage("复制失败，请手动复制。", true);
    });
}

function showImportMessage(text, isError) {
  elements.importMessage.textContent = text;
  elements.importMessage.style.color = isError ? "#b91c1c" : "#0f766e";
}

function addAccount() {
  state.accounts.push({
    name: "",
    api_user: "",
    cookies: [{ key: "session", value: "" }],
    provider: "",
  });
  saveState();
  render(state.accounts.length - 1);
}

function addProvider() {
  state.providers.push({
    key: "",
    domain: "",
    login_path: "",
    sign_in_path: "",
    user_info_path: "",
    api_user_key: "",
    bypass_method: "",
    waf_cookie_names: "",
  });
  saveState();
  modalState.providersFocusIndex = state.providers.length - 1;
  render(getActiveSlideIndex());
}

function duplicateAccount(index) {
  const original = state.accounts[index];
  if (!original) return;
  const copy = JSON.parse(JSON.stringify(original));
  state.accounts.splice(index + 1, 0, copy);
  saveState();
  render(index + 1);
  showImportMessage("已复制一份账号配置。", false);
}

function duplicateProvider(index) {
  const original = state.providers[index];
  if (!original) return;
  const copy = JSON.parse(JSON.stringify(original));
  copy.key = makeUniqueProviderKey(copy.key);
  state.providers.splice(index + 1, 0, copy);
  saveState();
  modalState.providersFocusIndex = index + 1;
  render(getActiveSlideIndex());
  showImportMessage("已复制一份服务商配置。", false);
}

function resetState() {
  state = JSON.parse(JSON.stringify(defaultState));
  lastSavedAt = null;
  localStorage.removeItem(STORAGE_KEY);
  render(0);
}

function importAccounts() {
  try {
    const data = JSON.parse(elements.importAccounts.value);
    if (!Array.isArray(data)) {
      throw new Error("账号配置必须是数组");
    }

    state.accounts = data.map((item) => {
      const cookies = item.cookies && typeof item.cookies === "object" ? item.cookies : {};
      const cookieList = Object.entries(cookies).map(([key, value]) => ({
        key,
        value: String(value ?? ""),
      }));
      return {
        name: item.name || "",
        api_user: item.api_user || "",
        cookies: cookieList.length ? cookieList : [{ key: "session", value: "" }],
        provider: item.provider ? String(item.provider) : "",
      };
    });

    saveState();
    render(0);
    showImportMessage("账号配置导入成功。", false);
  } catch (error) {
    showImportMessage(`导入失败：${error.message}`, true);
  }
}

function importProviders() {
  try {
    const data = JSON.parse(elements.importProviders.value);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Provider 配置必须是对象");
    }

    state.providers = Object.entries(data).map(([key, value]) => {
      const provider = value || {};
      return {
        key,
        domain: provider.domain || "",
        login_path: provider.login_path || "",
        sign_in_path: provider.sign_in_path || "",
        user_info_path: provider.user_info_path || "",
        api_user_key: provider.api_user_key || "",
        bypass_method: provider.bypass_method || "",
        waf_cookie_names: Array.isArray(provider.waf_cookie_names)
          ? provider.waf_cookie_names.join(", ")
          : "",
      };
    });

    saveState();
    modalState.providersFocusIndex = 0;
    render(getActiveSlideIndex());
    showImportMessage("Provider 配置导入成功。", false);
  } catch (error) {
    showImportMessage(`导入失败：${error.message}`, true);
  }
}

function openProviderModal(selectAccountIndex = null) {
  modalState.selectAccountIndex = selectAccountIndex;
  elements.providerModal.classList.add("is-open");
  elements.providerModal.setAttribute("aria-hidden", "false");
  modalState.providersFocusIndex = getActiveProviderIndex();
  render(getActiveSlideIndex());
}

function openImportModal() {
  elements.importModal.classList.add("is-open");
  elements.importModal.setAttribute("aria-hidden", "false");
}

function closeProviderModal() {
  modalState.selectAccountIndex = null;
  elements.providerModal.classList.remove("is-open");
  elements.providerModal.setAttribute("aria-hidden", "true");
}

function closeImportModal() {
  elements.importModal.classList.remove("is-open");
  elements.importModal.setAttribute("aria-hidden", "true");
}

function closeAllModals() {
  closeProviderModal();
  closeImportModal();
}

function handleInput(event) {
  const target = event.target;
  const accountIndex = target.dataset.accountIndex;
  const providerIndex = target.dataset.providerIndex;

  if (accountIndex !== undefined) {
    const index = Number(accountIndex);
    if (!state.accounts[index]) return;

    if (target.dataset.field) {
      state.accounts[index][target.dataset.field] = target.value;
    }

    if (target.dataset.cookieField) {
      const cookieIndex = Number(target.dataset.cookieIndex);
      const cookie = state.accounts[index].cookies[cookieIndex];
      if (cookie) {
        cookie[target.dataset.cookieField] = target.value;
      }
    }

    if (target.dataset.providerSelect) {
      state.accounts[index].provider = target.value;
    }

    saveState();
    updateOutputs();
    return;
  }

  if (providerIndex !== undefined) {
    const index = Number(providerIndex);
    if (!state.providers[index]) return;

    if (target.dataset.providerField) {
      if (target.dataset.providerField === "key") {
        const oldKey = state.providers[index].key;
        state.providers[index][target.dataset.providerField] = target.value;
        if (oldKey && oldKey !== target.value) {
          state.accounts.forEach((account) => {
            if (account.provider === oldKey) {
              account.provider = target.value;
            }
          });
        }
      } else {
        state.providers[index][target.dataset.providerField] = target.value;
      }
    }

    saveState();
    updateOutputs();
  }
}

function handleClick(event) {
  const target = event.target;

  if (target.matches("[data-remove-account]")) {
    const index = Number(target.dataset.removeAccount);
    state.accounts.splice(index, 1);
    saveState();
    render(Math.min(index, Math.max(0, state.accounts.length - 1)));
    return;
  }

  if (target.matches("[data-add-cookie]")) {
    const index = Number(target.dataset.addCookie);
    state.accounts[index].cookies.push({ key: "", value: "" });
    saveState();
    render(getActiveSlideIndex());
    return;
  }

  if (target.matches("[data-remove-cookie]")) {
    const index = Number(target.dataset.removeCookie);
    const cookieIndex = Number(target.dataset.cookieIndex);
    state.accounts[index].cookies.splice(cookieIndex, 1);
    if (!state.accounts[index].cookies.length) {
      state.accounts[index].cookies.push({ key: "session", value: "" });
    }
    saveState();
    render(getActiveSlideIndex());
    return;
  }

  if (target.matches("[data-add-provider]")) {
    const index = Number(target.dataset.addProvider);
    openProviderModal(index);
    return;
  }

  if (target.matches("[data-add-provider-item]")) {
    addProvider();
    return;
  }

  if (target.matches("[data-copy-account]")) {
    const index = Number(target.dataset.copyAccount);
    duplicateAccount(index);
    return;
  }

  if (target.matches("[data-remove-provider]")) {
    const index = Number(target.dataset.removeProvider);
    const removedKey = state.providers[index].key;
    state.providers.splice(index, 1);
    if (removedKey) {
      state.accounts.forEach((account) => {
        if (account.provider === removedKey) {
          account.provider = "";
        }
      });
    }
    saveState();
    modalState.providersFocusIndex = Math.min(index, Math.max(0, state.providers.length - 1));
    render(getActiveSlideIndex());
    return;
  }

  if (target.matches("[data-copy-provider]")) {
    const index = Number(target.dataset.copyProvider);
    duplicateProvider(index);
    return;
  }

  if (target.matches("[data-select-provider]")) {
    const providerIndex = Number(target.dataset.selectProvider);
    const providerKey = (state.providers[providerIndex]?.key || "").trim();
    if (!providerKey) return;

    const accountIndex = modalState.selectAccountIndex;
    if (accountIndex === null || !state.accounts[accountIndex]) return;
    state.accounts[accountIndex].provider = providerKey;
    saveState();
    render(getActiveSlideIndex());
    return;
  }

  if (target.matches("[data-close-modal]")) {
    closeAllModals();
  }
}

function bindEvents() {
  elements.addAccount.addEventListener("click", addAccount);
  elements.copyAccounts.addEventListener("click", () =>
    copyToClipboard(elements.accountsJson.value, "ANYROUTER_ACCOUNTS 已复制。")
  );
  elements.copyProviders.addEventListener("click", () =>
    copyToClipboard(elements.providersJson.value, "PROVIDERS 已复制。")
  );
  elements.clearCache.addEventListener("click", resetState);
  elements.importAccountsBtn.addEventListener("click", importAccounts);
  elements.importProvidersBtn.addEventListener("click", importProviders);
  elements.openImport.addEventListener("click", openImportModal);
  elements.openProviders.addEventListener("click", () => openProviderModal(null));
  elements.closeProviders.addEventListener("click", closeProviderModal);
  elements.closeImport.addEventListener("click", closeImportModal);
  document.addEventListener("input", handleInput);
  document.addEventListener("change", handleInput);
  document.addEventListener("click", handleClick);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllModals();
    }
  });
}

function init() {
  bindEvents();
  render();
}

init();
