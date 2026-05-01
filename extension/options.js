const DEFAULT_SETTINGS = {
  serverUrl: "ws://127.0.0.1:8000/captcha_ws",
  apiKey: "",
  routeKey: "",
  clientLabel: "",
  managedApiKeyId: ""
};

const $ = (id) => document.getElementById(id);

function normalizeSettings(values) {
  return {
    serverUrl: (values.serverUrl || DEFAULT_SETTINGS.serverUrl).trim(),
    apiKey: (values.apiKey || "").trim(),
    routeKey: (values.routeKey || "").trim(),
    clientLabel: (values.clientLabel || "").trim(),
    managedApiKeyId: (values.managedApiKeyId || "").trim()
  };
}

function setStatus(message, isError = false) {
  const status = $("status");
  status.textContent = message;
  status.style.color = isError ? "#b91c1c" : "#065f46";
}

function isValidWsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "ws:" || url.protocol === "wss:";
  } catch (e) {
    return false;
  }
}

function loadSettings() {
  chrome.storage.local.get(DEFAULT_SETTINGS, (stored) => {
    const settings = normalizeSettings(stored);
    $("serverUrl").value = settings.serverUrl;
    $("apiKey").value = settings.apiKey;
    $("routeKey").value = settings.routeKey;
    $("clientLabel").value = settings.clientLabel;
    $("managedApiKeyId").value = settings.managedApiKeyId;
  });
}

function saveSettings() {
  const settings = normalizeSettings({
    serverUrl: $("serverUrl").value,
    apiKey: $("apiKey").value,
    routeKey: $("routeKey").value,
    clientLabel: $("clientLabel").value,
    managedApiKeyId: $("managedApiKeyId").value
  });

  if (!isValidWsUrl(settings.serverUrl)) {
    setStatus("WebSocket URL 必须以 ws:// 或 wss:// 开头。", true);
    return;
  }
  if (!settings.apiKey) {
    setStatus("API Key 不能为空。", true);
    return;
  }
  if (settings.managedApiKeyId && !/^\d+$/.test(settings.managedApiKeyId)) {
    setStatus("Managed API Key ID 必须为数字。", true);
    return;
  }

  chrome.storage.local.set(settings, () => {
    if (chrome.runtime.lastError) {
      setStatus(`保存失败：${chrome.runtime.lastError.message}`, true);
      return;
    }
    setStatus("已保存，后台连接会自动重连。");
  });
}

function updateRuntimeStatus(state) {
  const el = $("runtimeStatus");
  if (!state) {
    el.textContent = "连接状态：未知";
    return;
  }
  const ws = state.wsStatus || "unknown";
  const route = state.routeKey || "(empty)";
  const managed = state.managedApiKeyId || "-";
  const ack = state.lastRegisterStatus || "unknown";
  const last = state.lastError ? `，错误：${state.lastError}` : "";
  el.textContent = `连接状态：${ws}，route=${route}，managed_key=${managed}，register=${ack}${last}`;
}

function refreshRuntimeStatus() {
  chrome.runtime.sendMessage({ type: "get_status" }, (resp) => {
    if (chrome.runtime.lastError) return;
    if (resp && resp.success) updateRuntimeStatus(resp.state);
  });
}

function reconnectNow() {
  chrome.runtime.sendMessage({ type: "reconnect_now" }, (resp) => {
    if (chrome.runtime.lastError) {
      setStatus(`重连失败：${chrome.runtime.lastError.message}`, true);
      return;
    }
    if (!resp || !resp.success) {
      setStatus(`重连失败：${(resp && resp.error) || "unknown"}`, true);
      return;
    }
    setStatus("已触发重连。");
    setTimeout(refreshRuntimeStatus, 400);
  });
}

function runTokenTest() {
  setStatus("测试中，请稍候...");
  chrome.runtime.sendMessage({ type: "test_token", action: "IMAGE_GENERATION" }, (resp) => {
    if (chrome.runtime.lastError) {
      setStatus(`测试失败：${chrome.runtime.lastError.message}`, true);
      return;
    }
    if (resp && resp.success) {
      setStatus("测试成功：已获取 token。");
    } else {
      setStatus(`测试失败：${(resp && resp.error) || "unknown error"}`, true);
    }
    refreshRuntimeStatus();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  $("saveBtn").addEventListener("click", saveSettings);
  $("reconnectBtn").addEventListener("click", reconnectNow);
  $("testBtn").addEventListener("click", runTokenTest);
  refreshRuntimeStatus();
  setInterval(refreshRuntimeStatus, 3000);
});
